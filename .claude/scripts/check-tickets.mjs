#!/usr/bin/env node
// Confere que cada critério da spec virou (pelo menos) uma filha, sem ler os tickets à mão.
//
//   node .claude/scripts/check-tickets.mjs <fatia> <arquivo-da-spec> <grupo/projeto-workspace>
//
// Critério = linha numerada de "## Critérios (EARS)" ou, na fatia de fundação, cada `- [ ]` de "## Checklist"
// (numerados na ordem). Cada filha `<fatia>.<N> — …` declara na descrição `Cobre: 1, 3, 5-7`.
// Saída 1 se algum critério ficou sem filha ou se uma filha cita critério que não existe.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [fatia, specPath, project] = process.argv.slice(2);
if (!fatia || !specPath || !project) {
  console.error('uso: check-tickets.mjs <fatia> <arquivo-da-spec> <grupo/projeto-workspace>');
  process.exit(2);
}

const spec = readFileSync(specPath, 'utf8').split(/\r?\n/);
const section = (re) => {
  const i = spec.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const end = spec.findIndex((l, k) => k > i && /^## /.test(l));
  return spec.slice(i + 1, end < 0 ? undefined : end);
};
let criterios = [];
const ears = section(/^## Crit[eé]rios/i);
if (ears) criterios = ears.filter((l) => /^\d+\.\s/.test(l)).map((l) => Number(l.match(/^(\d+)\./)[1]));
else {
  const check = section(/^## Checklist/i) ?? [];
  criterios = check.filter((l) => /^\s*- \[[ x]\]/.test(l)).map((_, i) => i + 1);
}
if (!criterios.length) {
  console.log('FALHA: a spec não tem "## Critérios (EARS)" nem "## Checklist" com itens numeráveis.');
  process.exit(1);
}

let raw;
try {
  raw = execFileSync('glab', ['issue', 'list', '-R', project, '--search', `${fatia}.`, '--all', '-O', 'json', '--per-page', '100'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  console.log(`FALHA: glab não listou as issues de ${project}: ${String(e.stderr || e.message).split('\n').map((l) => l.trim()).filter((l) => l && l !== 'ERROR').join(' ') || 'erro desconhecido'}`);
  process.exit(1);
}
const filhas = JSON.parse(raw || '[]').filter((i) => new RegExp(`^${fatia}\\.\\d+ — `).test(i.title));
if (!filhas.length) {
  console.log(`FALHA: nenhuma filha "${fatia}.N — …" encontrada em ${project}.`);
  process.exit(1);
}

const parse = (txt) => {
  const m = (txt || '').match(/^\s*Cobre:\s*(.+)$/im);
  if (!m) return null;
  const out = [];
  for (const part of m[1].split(/[,;]/)) {
    const r = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!r) continue;
    for (let n = Number(r[1]); n <= Number(r[2] ?? r[1]); n++) out.push(n);
  }
  return out;
};

const cobertos = new Set();
const problemas = [];
for (const f of filhas) {
  const lista = parse(f.description);
  if (!lista) { problemas.push(`#${f.iid} ${f.title}: sem linha "Cobre: …" na descrição`); continue; }
  for (const n of lista) {
    if (!criterios.includes(n)) problemas.push(`#${f.iid} ${f.title}: cita o critério ${n}, que não existe na spec`);
    cobertos.add(n);
  }
}
const sem = criterios.filter((n) => !cobertos.has(n));
if (sem.length) problemas.push(`critérios sem filha: ${sem.join(', ')}`);

if (problemas.length) {
  console.log(problemas.map((p) => `FALHA: ${p}`).join('\n'));
  process.exit(1);
}
console.log(`OK — ${criterios.length} critério(s) em ${filhas.length} filha(s), todos cobertos.`);
