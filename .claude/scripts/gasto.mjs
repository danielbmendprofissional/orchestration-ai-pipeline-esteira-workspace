#!/usr/bin/env node
// Gasto de tokens da sessão e dos subagentes, lido do transcrito do Claude Code. Zero token: nenhuma chamada de modelo.
//
//   node .claude/scripts/gasto.mjs [<id-da-sessão>] [--resumo] [--pasta <caminho do projeto>]
//
// Sem id: a sessão mais recente da pasta atual (a que está rodando). `--resumo`: uma linha só.
// Fonte: ~/.claude/projects/<pasta>/<sessão>.jsonl e <sessão>/subagents/*.jsonl (campo `usage` de cada resposta).
//
// O número que importa é UM: TOTAL = tokens NOVOS (o que o modelo leu pela primeira vez, entrada + gravação no cache)
// + GERADOS (o que ele escreveu). Os "relidos do cache" ficam fora do total: cada chamada relê a conversa inteira,
// mas isso é mais barato que token novo. A fórmula de cota do plano não é pública: o número serve para comparar
// fatias/tickets entre si, não para prever o limite.
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
  let fim = null, ativo = 0;
  for (const e of linhas) {
    if (e.timestamp) { const t = new Date(e.timestamp).getTime(); if (fim !== null && t - fim < 600000) ativo += t - fim; fim = t; }
    if (e.type === 'assistant' && e.message?.usage) porMsg.set(e.message.id, e.message.usage);
  }
  let chamadas = 0, cacheLido = 0, novos = 0, saida = 0, ctxSoma = 0, ctxMax = 0, ctxMin = Infinity, ultima = 0, ctxUltimo = 0;
  for (const u of porMsg.values()) {
    const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    if (!ctx) continue; // registro sem uso (resposta interrompida)
    ultima = u.output_tokens || 0; ctxUltimo = ctx;
    chamadas++; cacheLido += u.cache_read_input_tokens || 0;
    novos += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    saida += u.output_tokens || 0; ctxSoma += ctx; ctxMax = Math.max(ctxMax, ctx); ctxMin = Math.min(ctxMin, ctx);
  }
  // a saída de cada chamada (menos a última) volta como token "novo" na chamada seguinte (gravação no cache): está nos dois números
  return { chamadas, cacheLido, novos, saida, reentrada: Math.max(0, saida - ultima), ctxUltimo, ctxMedio: chamadas ? Math.round(ctxSoma / chamadas) : 0, ctxMax, ctxMin: chamadas ? ctxMin : 0, seg: Math.round(ativo / 1000) };
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
const tot = linhas.reduce((a, l) => ({ chamadas: a.chamadas + l.chamadas, cacheLido: a.cacheLido + l.cacheLido, novos: a.novos + l.novos, saida: a.saida + l.saida, reentrada: a.reentrada + l.reentrada }), { chamadas: 0, cacheLido: 0, novos: 0, saida: 0, reentrada: 0 });
const total = tot.novos + tot.saida;
const subs = linhas.length - 1;
const p = linhas[0];
const base = p.ctxMin; // 1ª chamada da sessão principal ≈ o que é reenviado antes de qualquer mensagem (prompt, ferramentas, MCPs, instruções)

if (resumo) {
  console.log(`Gasto: TOTAL ${k(total)} tokens (${k(tot.novos)} novos + ${k(tot.saida)} gerados) em ${tot.chamadas} chamadas${subs ? `, ${subs} subagente${subs === 1 ? '' : 's'}` : ''}; mais ${k(tot.cacheLido)} relidos do cache. Base reenviada a cada chamada: ${k(base)}. Contexto atual da sessão principal: ${k(p.ctxUltimo)}.`);
  process.exit(0);
}

console.log(`# TOTAL GASTO NESTA SESSÃO: ${k(total)} tokens\n`);
console.log(`= ${k(tot.novos)} **novos** (o que o modelo leu pela primeira vez) + ${k(tot.saida)} **gerados** (o que ele escreveu, inclui raciocínio escondido).`);
console.log(`Desses novos, ${k(tot.reentrada)} são a própria saída do modelo, regravada no cache na chamada seguinte: o total a conta duas vezes (uma ao gerar, outra ao reler). Sem ela, o que veio de fora (prompt, ferramentas, arquivos lidos) é ~${k(tot.novos - tot.reentrada)}.`);
console.log(`Fora desse total, ${k(tot.cacheLido)} foram **relidos do cache**: a cada chamada o modelo relê a conversa inteira, e isso sai mais barato que token novo. Pesa quando a sessão é grande.\n`);
console.log('| Agente | Chamadas | Novos | Gerados | **Total** | Relidos do cache |');
console.log('|---|---|---|---|---|---|');
for (const l of linhas) console.log(`| ${l.nome} | ${l.chamadas} | ${k(l.novos)} | ${k(l.saida)} | **${k(l.novos + l.saida)}** | ${k(l.cacheLido)} |`);
console.log(`| **Soma** | **${tot.chamadas}** | ${k(tot.novos)} | ${k(tot.saida)} | **${k(total)}** | ${k(tot.cacheLido)} |\n`);
const aviso = [];
if (base > 70000) aviso.push(`a base reenviada em cada chamada é ${k(base)} (prompt, ferramentas nativas, skills, agentes, instruções e MCPs). Rode \`/context\` pra ver o que pesa. Tool nativa que o projeto não usa sai com \`permissions.deny\` pelo nome (\`"CronCreate"\`; o \`Artifact\` sai com \`"enableArtifact": false\`); skills da conta claude.ai saem com \`"syncClaudeAiSkills": false\` no settings do usuário; \`/mcp\` só ajuda se houver servidor ligado`);
if (p.ctxMedio > 150000) aviso.push(`a sessão principal chegou a ${k(p.ctxMedio)} de contexto médio: abra sessão nova em vez de continuar (entre /fatia e /implement-task, use /clear)`);
const grandes = linhas.slice(1).filter((l) => l.ctxMax > 180000);
if (grandes.length) aviso.push(`contexto perto de 200 mil em: ${grandes.map((l) => l.nome).join('; ')} (ticket grande demais: dividir)`);
if (aviso.length) console.log(`Atenção: ${aviso.join('. ')}.`);
