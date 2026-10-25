#!/usr/bin/env node
// Checagem mecânica do diff de uma task (zero token). Substitui o que o `review` fazia por grep:
// arquivo fora do escopo, "Não toque" mexido, teste apagado, asserção removida, skip/only adicionado.
//
//   node .claude/scripts/check-escopo.mjs <repo> <base-ref> [--allow "glob glob"] [--deny "glob glob"]
//
// <base-ref> = commit antes da task (o diff vai dele até a árvore de trabalho, inclusive o não comitado).
// Glob: `*` casa qualquer coisa (inclusive `/`), `?` um caractere. Caminhos relativos ao <repo>.
// Saída: uma linha por problema ("FALHA" bloqueia, "AVISO" pede julgamento). Código 1 se houver FALHA.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [repo, base, ...rest] = process.argv.slice(2);
if (!repo || !base) {
  console.error('uso: check-escopo.mjs <repo> <base-ref> [--allow "glob glob"] [--deny "glob glob"]');
  process.exit(2);
}
const opt = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1].split(/\s+/).filter(Boolean) : [];
};
const allow = opt('--allow');
const deny = opt('--deny');

const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const toRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
const matches = (file, globs) => globs.some((g) => toRe(g).test(file));

const isTest = (f) =>
  /(^|\/)(tests?|__tests__|spec)(\/|$)/i.test(f) || /(Tests?|Spec)\.[a-z]+$/.test(f) || /\.(spec|test)\.[a-z]+$/i.test(f);
const SKIP = /Skip\s*=|\[Ignore|@Disabled|\b(xit|xdescribe|xtest|fit|fdescribe)\(|\.(skip|only|todo)\(/;
const ASSERT = /Assert\.|\.Should|Should\(|\bexpect\(|\bassert\b|Verify\(/;

const status = git('diff', '--name-status', '--no-renames', base)
  .split('\n').filter(Boolean).map((l) => l.split('\t'));
const untracked = git('ls-files', '-o', '--exclude-standard').split('\n').filter(Boolean);
const changed = [...status.map(([s, f]) => ({ s, f })), ...untracked.map((f) => ({ s: 'A', f }))];

const problems = [];
const fail = (m) => problems.push({ nivel: 'FALHA', m });
const warn = (m) => problems.push({ nivel: 'AVISO', m });

for (const { s, f } of changed) {
  if (deny.length && matches(f, deny)) fail(`${f}: está em "Não toque"`);
  else if (allow.length && !matches(f, allow)) fail(`${f}: fora dos arquivos esperados da task`);
  if (s === 'D' && isTest(f)) fail(`${f}: teste apagado`);
}

for (const { s, f } of changed) {
  if (!isTest(f) || s === 'D') continue;
  const isNew = untracked.includes(f);
  const diff = isNew ? '' : git('diff', '-U0', base, '--', f);
  const lines = isNew ? readLines(f) : null;
  const added = isNew ? lines : diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const removed = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
  const skips = added.filter((l) => SKIP.test(l));
  if (skips.length) fail(`${f}: teste desativado/focado (${skips.map((l) => l.replace(/^\+/, '').trim()).join(' | ').slice(0, 120)})`);
  const net = removed.filter((l) => ASSERT.test(l)).length - added.filter((l) => ASSERT.test(l)).length;
  if (net > 0) warn(`${f}: ${net} asserção(ões) a menos que antes — confira se a spec cobre`);
}

function readLines(f) {
  return readFileSync(join(repo, f), 'utf8').split('\n');
}

if (!problems.length) console.log(`OK — ${changed.length} arquivo(s), nada fora do escopo, nenhum teste enfraquecido.`);
for (const p of problems) console.log(`${p.nivel}: ${p.m}`);
process.exit(problems.some((p) => p.nivel === 'FALHA') ? 1 : 0);
