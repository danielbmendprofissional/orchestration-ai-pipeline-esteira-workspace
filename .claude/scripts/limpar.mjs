#!/usr/bin/env node
// Lista e apaga de verdade as sessões do Claude Code da máquina (todos os projetos). Zero token.
//
//   node .claude/scripts/limpar.mjs                          # lista (tabela markdown), mais recentes primeiro
//   node .claude/scripts/limpar.mjs --apagar a1b2c3,d4e5f6   # MOSTRA o que apagaria (não apaga)
//   node .claude/scripts/limpar.mjs --mais-antigas 30        # idem, para as sessões com mais de 30 dias
//   ... --sim                                                # apaga de verdade (depois do humano ter visto o plano)
//   ... --sem-resumo                                         # não grava o resumo do /gasto antes de apagar
//   ... --forcar                                             # permite apagar sessão que parece aberta agora
//
// Por que existe: transcrito antigo NÃO gasta token (o modelo nunca o lê); o gasto vem do contexto da sessão aberta.
// Apagar libera disco e tira do disco o que foi dito/rodado nelas. Antes de apagar, o resumo do /gasto de cada
// sessão é gravado em ~/.claude/gasto-resumos/ (padrão), para a medição não se perder.
//
// Apaga só: <projeto>/<id>.jsonl, <projeto>/<id>/ (subagentes), file-history/<id>, session-env/<id>.
// Nunca toca em CLAUDE.md, memórias (<projeto>/memory), settings.json nem history.jsonl.
import { readFileSync, readdirSync, existsSync, statSync, rmSync, openSync, readSync, closeSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const CLAUDE = join(homedir(), '.claude');
const PROJ = join(CLAUDE, 'projects');
const ABERTA_MS = 15 * 60 * 1000; // modificada há menos de 15 min = provavelmente aberta

if (!existsSync(PROJ)) { console.log(`Nada em ${PROJ}.`); process.exit(0); }

const tamanho = (p) => {
  try {
    const s = statSync(p);
    if (!s.isDirectory()) return s.size;
    return readdirSync(p).reduce((a, f) => a + tamanho(join(p, f)), 0);
  } catch { return 0; }
};
const humano = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function cabecalho(arq) {
  // lê só o começo do arquivo: cwd e a primeira mensagem do humano
  const fd = openSync(arq, 'r');
  const buf = Buffer.alloc(96 * 1024);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  let cwd = null, titulo = null;
  for (const l of buf.toString('utf8', 0, n).split('\n')) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    cwd ??= e.cwd ?? null;
    if (!titulo && e.type === 'user' && !e.isMeta) {
      const c = e.message?.content;
      const t = typeof c === 'string' ? c : (c || []).find((b) => b.type === 'text')?.text;
      if (t) {
        const cmd = t.match(/<command-name>([^<]+)<\/command-name>(?:\s*<command-message>[^<]*<\/command-message>)?(?:\s*<command-args>([^<]*)<\/command-args>)?/);
        titulo = (cmd ? `${cmd[1]} ${cmd[2] ?? ''}` : t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
      }
    }
    if (cwd && titulo) break;
  }
  return { cwd, titulo: titulo || '(sem texto)' };
}

const sessoes = [];
for (const d of readdirSync(PROJ, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dirProj = join(PROJ, d.name);
  for (const f of readdirSync(dirProj)) {
    if (!f.endsWith('.jsonl')) continue;
    const id = f.replace(/\.jsonl$/, '');
    const arq = join(dirProj, f);
    const st = statSync(arq);
    const h = cabecalho(arq);
    const alvos = [arq, join(dirProj, id), join(CLAUDE, 'file-history', id), join(CLAUDE, 'session-env', id)].filter(existsSync);
    sessoes.push({
      id, dirProj, arq, alvos, mtime: st.mtimeMs,
      cwd: h.cwd, titulo: h.titulo,
      projeto: h.cwd ? h.cwd.split(/[\\/]/).slice(-2).join('/') : d.name.slice(-30),
      bytes: alvos.reduce((a, p) => a + tamanho(p), 0),
      aberta: Date.now() - st.mtimeMs < ABERTA_MS,
    });
  }
}
sessoes.sort((a, b) => b.mtime - a.mtime);
// ID curto: 6 caracteres, ou mais se colidir
for (const s of sessoes) { let n = 6; while (sessoes.some((o) => o !== s && o.id.startsWith(s.id.slice(0, n)))) n++; s.curto = s.id.slice(0, n); }

const data = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

// --- seleção
let alvo = null;
if (val('--apagar')) {
  const ids = val('--apagar').split(',').map((x) => x.trim()).filter(Boolean);
  alvo = [];
  for (const i of ids) {
    const achadas = sessoes.filter((s) => s.id.startsWith(i));
    if (achadas.length !== 1) { console.log(`ID "${i}": ${achadas.length ? 'ambíguo' : 'não encontrado'}. Nada foi apagado.`); process.exit(1); }
    alvo.push(achadas[0]);
  }
} else if (val('--mais-antigas')) {
  const dias = Number(val('--mais-antigas'));
  if (!Number.isFinite(dias) || dias < 0) { console.log('--mais-antigas precisa de um número de dias.'); process.exit(1); }
  alvo = sessoes.filter((s) => Date.now() - s.mtime > dias * 86400000);
}

if (!alvo) {
  console.log(`**${sessoes.length} sessões** em ${new Set(sessoes.map((s) => s.dirProj)).size} projetos, ${humano(sessoes.reduce((a, s) => a + s.bytes, 0))} no total. Sessão antiga em disco não gasta token; apagar libera espaço e tira o conteúdo dela da máquina.\n`);
  console.log('| ID | Projeto | Última atividade | Tamanho | Começou com | |');
  console.log('|---|---|---|---|---|---|');
  for (const s of sessoes) console.log(`| \`${s.curto}\` | ${s.projeto} | ${data(s.mtime)} | ${humano(s.bytes)} | ${s.titulo.replace(/\|/g, '/')} | ${s.aberta ? '**aberta agora?**' : ''} |`);
  console.log('\n"aberta agora?" = mexida nos últimos 15 min (a sua sessão atual é uma delas); só apaga com `--forcar`.');
  process.exit(0);
}

// --- plano
const bloqueadas = alvo.filter((s) => s.aberta && !flag('--forcar'));
const apagar = alvo.filter((s) => !bloqueadas.includes(s));
console.log(`**Plano:** apagar ${apagar.length} sessão(ões), ${humano(apagar.reduce((a, s) => a + s.bytes, 0))}.\n`);
console.log('| ID | Projeto | Última atividade | Tamanho | Começou com |');
console.log('|---|---|---|---|---|');
for (const s of apagar) console.log(`| \`${s.curto}\` | ${s.projeto} | ${data(s.mtime)} | ${humano(s.bytes)} | ${s.titulo.replace(/\|/g, '/')} |`);
if (bloqueadas.length) console.log(`\nIgnoradas por parecerem abertas agora: ${bloqueadas.map((s) => `\`${s.curto}\``).join(', ')} (use \`--forcar\` se tiver certeza).`);
if (!apagar.length) process.exit(0);
if (!flag('--sim')) {
  console.log(`\nNada foi apagado. ${flag('--sem-resumo') ? 'Sem resumo do gasto.' : 'Antes de apagar, o resumo do /gasto de cada uma vai para ~/.claude/gasto-resumos/.'} Para confirmar: repita o comando com \`--sim\`.`);
  process.exit(0);
}

// --- resumo do /gasto + apagar
const gasto = join(dirname(fileURLToPath(import.meta.url)), 'gasto.mjs');
const dirResumos = join(CLAUDE, 'gasto-resumos');
let resumos = 0;
if (!flag('--sem-resumo')) {
  mkdirSync(dirResumos, { recursive: true });
  for (const s of apagar) {
    if (!s.cwd || !existsSync(gasto)) continue;
    try {
      const out = execFileSync('node', [gasto, s.id, '--pasta', s.cwd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      writeFileSync(join(dirResumos, `${new Date(s.mtime).toISOString().slice(0, 10)}-${s.curto}.md`), `# Sessão ${s.id}\nProjeto: ${s.cwd}\nComeçou com: ${s.titulo}\n\n${out}`);
      resumos++;
    } catch { /* sessão sem usage: segue sem resumo */ }
  }
}
let livre = 0, falhas = 0;
for (const s of apagar) {
  for (const p of s.alvos) {
    try { const b = tamanho(p); rmSync(p, { recursive: true, force: true }); livre += b; } catch (e) { falhas++; console.log(`Não consegui apagar ${p}: ${e.message}`); }
  }
}
console.log(`\nApagadas ${apagar.length} sessão(ões), ${humano(livre)} liberados${falhas ? `, ${falhas} falha(s)` : ''}. ${resumos ? `${resumos} resumo(s) do gasto em ${dirResumos}.` : ''}`);
