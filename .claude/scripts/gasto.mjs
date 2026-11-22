#!/usr/bin/env node
// Gasto de tokens da sessão e dos subagentes, lido do transcrito do Claude Code. Zero token: nenhuma chamada de modelo.
//
//   node .claude/scripts/gasto.mjs [<id-da-sessão>] [--resumo] [--pasta <caminho do projeto>]
//
// Sem id: a sessão mais recente da pasta atual (a que está rodando). `--resumo`: uma linha só.
// Fonte: ~/.claude/projects/<pasta>/<sessão>.jsonl e <sessão>/subagents/*.jsonl (campo `usage` de cada resposta).
// Mede o que o transcrito registra. A fórmula de cota do plano não é pública: serve para comparar fatias/tickets, não para prever o limite.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const resumo = args.includes('--resumo');
const ip = args.indexOf('--pasta');
const pasta = ip >= 0 ? args[ip + 1] : process.cwd();
const sessaoArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--pasta');

const slug = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');
const dir = join(homedir(), '.claude', 'projects', slug(pasta));
if (!existsSync(dir)) {
  console.log(`Sem transcritos em ${dir}. Rode da raiz do workspace.`);
  process.exit(1);
}
const sessoes = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
const alvo = sessaoArg ? sessoes.find((s) => s.f.startsWith(sessaoArg)) : sessoes[0];
if (!alvo) {
  console.log('Nenhuma sessão encontrada.');
  process.exit(1);
}
const id = alvo.f.replace(/\.jsonl$/, '');

function ler(arquivo) {
  const linhas = readFileSync(arquivo, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const porMsg = new Map(); // a mesma resposta aparece em mais de uma linha: vale a última
  let ini = null, fim = null, ativo = 0;
  for (const e of linhas) {
    if (e.timestamp) { const t = new Date(e.timestamp).getTime(); ini ??= t; if (fim !== null && t - fim < 600000) ativo += t - fim; fim = t; }
    if (e.type === 'assistant' && e.message?.usage) porMsg.set(e.message.id, e.message.usage);
  }
  let chamadas = 0, cacheLido = 0, cacheGravado = 0, saida = 0, ctxSoma = 0, ctxMax = 0;
  for (const u of porMsg.values()) {
    const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    chamadas++; cacheLido += u.cache_read_input_tokens || 0; cacheGravado += u.cache_creation_input_tokens || 0;
    saida += u.output_tokens || 0; ctxSoma += ctx; ctxMax = Math.max(ctxMax, ctx);
  }
  return { chamadas, cacheLido, cacheGravado, saida, ctxMedio: chamadas ? Math.round(ctxSoma / chamadas) : 0, ctxMax, seg: Math.round(ativo / 1000) };
}

const linhas = [{ nome: 'sessão principal', ...ler(join(dir, alvo.f)) }];
const subDir = join(dir, id, 'subagents');
if (existsSync(subDir)) {
  for (const f of readdirSync(subDir).filter((x) => x.endsWith('.jsonl'))) {
    let nome = f.replace(/^agent-/, '').replace(/\.jsonl$/, '').slice(0, 8);
    try {
      const m = JSON.parse(readFileSync(join(subDir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8'));
      nome = `${m.description || nome} (${m.agentType || 'agente'})`;
    } catch { /* sem meta */ }
    linhas.push({ nome, ...ler(join(subDir, f)), ordem: statSync(join(subDir, f)).birthtimeMs });
  }
  linhas.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n));
const min = (s) => (s >= 60 ? `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}` : `${s}s`);
const tot = linhas.reduce((a, l) => ({ chamadas: a.chamadas + l.chamadas, cacheLido: a.cacheLido + l.cacheLido, cacheGravado: a.cacheGravado + l.cacheGravado, saida: a.saida + l.saida }), { chamadas: 0, cacheLido: 0, cacheGravado: 0, saida: 0 });
const subs = linhas.length - 1;

if (resumo) {
  const p = linhas[0];
  console.log(`Gasto: ${tot.chamadas} chamadas (${subs} subagente${subs === 1 ? '' : 's'}), ${k(tot.cacheLido)} de contexto lido do cache, ${k(tot.saida)} gerados; sessão principal com contexto de ${k(p.ctxMedio)} em média (máx ${k(p.ctxMax)}).`);
  process.exit(0);
}

console.log(`Gasto de tokens — sessão ${id.slice(0, 8)} (mais recente em ${pasta})\n`);
console.log('| Agente | Tempo ativo | Chamadas | Contexto médio | Contexto máx. | Cache lido | Gerado |');
console.log('|---|---|---|---|---|---|---|');
for (const l of linhas) console.log(`| ${l.nome} | ${min(l.seg)} | ${l.chamadas} | ${k(l.ctxMedio)} | ${k(l.ctxMax)} | ${k(l.cacheLido)} | ${k(l.saida)} |`);
console.log(`| **Total** | | **${tot.chamadas}** | | | **${k(tot.cacheLido)}** | **${k(tot.saida)}** |\n`);
const p = linhas[0];
const aviso = [];
if (p.ctxMedio > 150000) aviso.push(`a sessão principal relê ${k(p.ctxMedio)} de contexto a cada chamada: use \`/clear\` entre \`/fatia\` e \`/implement-task\``);
const grandes = linhas.slice(1).filter((l) => l.ctxMax > 180000);
if (grandes.length) aviso.push(`contexto perto de 200 mil em: ${grandes.map((l) => l.nome).join('; ')} (ticket grande demais: dividir)`);
if (aviso.length) console.log(`Atenção: ${aviso.join('. ')}.`);
console.log('Contexto = o que cada chamada ao modelo recebe (entrada + cache). "Cache lido" soma isso em todas as chamadas, é o que mais pesa na cota. "Gerado" é a saída (inclui raciocínio escondido).');
