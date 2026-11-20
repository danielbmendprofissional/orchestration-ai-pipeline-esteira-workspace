#!/usr/bin/env node
// Lista os comandos do projeto (zero token): lê a linha `description:` de cada arquivo em .claude/commands,
// então a lista nunca fica velha. Somente leitura. Rode da raiz do workspace.
//
//   node .claude/scripts/ajuda.mjs           # comandos + skills de entrada
//   node .claude/scripts/ajuda.mjs --tudo    # também todas as skills instaladas
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(process.cwd());
const tudo = process.argv.includes('--tudo');

// Skills que você chama de fato; o resto (segurança, auditoria, escrita) fica atrás de --tudo.
const ENTRADA = [
  'grill-with-docs', 'to-spec', 'to-tickets', 'code-review', 'wayfinder', 'prototype',
  'impeccable', 'triage', 'retro', 'handoff', 'ask-matt', 'improve-codebase-architecture',
];

function descricao(arquivo) {
  const txt = readFileSync(arquivo, 'utf8').replace(/\r/g, '');
  const fm = txt.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return '';
  const linhas = fm[1].split('\n');
  const i = linhas.findIndex((l) => /^description:/.test(l));
  if (i < 0) return '';
  let v = linhas[i].replace(/^description:\s*/, '').trim();
  if (/^[>|][-+]?$/.test(v)) v = (linhas[i + 1] || '').trim(); // bloco: pega a primeira linha
  v = v.replace(/^["']|["']$/g, '');
  const primeira = v.split(/\s[—-]\s|\. /)[0];
  const curta = primeira.length >= 25 ? primeira : v;
  return curta.length > 100 ? `${curta.slice(0, 97)}...` : curta;
}

function listar(dir, arquivoDe) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => ({ nome: e.name.replace(/\.md$/, ''), arq: arquivoDe(e) }))
    .filter((x) => x.arq && existsSync(x.arq))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

const comandos = listar(join(raiz, '.claude/commands'), (e) => (e.isFile() && e.name.endsWith('.md') ? join(raiz, '.claude/commands', e.name) : null));
const skills = listar(join(raiz, '.claude/skills'), (e) => (e.isDirectory() ? join(raiz, '.claude/skills', e.name, 'SKILL.md') : null));
const larg = Math.max(12, ...comandos.map((c) => c.nome.length + 1), ...skills.map((s) => s.nome.length + 1));
const linha = (nome, arq) => `  /${nome.padEnd(larg - 1)} ${descricao(arq)}`;

console.log('COMANDOS DO PROJETO');
for (const c of comandos) console.log(linha(c.nome, c.arq));

const entrada = ENTRADA.map((n) => skills.find((s) => s.nome === n)).filter(Boolean);
if (entrada.length) {
  console.log('\nSKILLS DE ENTRADA (as que você chama de vez em quando)');
  for (const s of entrada) console.log(linha(s.nome, s.arq));
}

if (tudo) {
  const resto = skills.filter((s) => !ENTRADA.includes(s.nome));
  console.log(`\nTODAS AS OUTRAS SKILLS (${resto.length}: segurança, auditoria, escrita... só quando você pedir)`);
  for (const s of resto) console.log(linha(s.nome, s.arq));
} else if (skills.length) {
  console.log(`\nHá mais ${skills.length - entrada.length} skills instaladas (segurança, auditoria, escrita...). Para ver todas: /ajuda tudo`);
}

console.log('\nPerdido sobre o que fazer agora? /proximo · Estado do git? /situacao · Detalhe de cada comando: docs-human/glossario-de-comandos.md');
