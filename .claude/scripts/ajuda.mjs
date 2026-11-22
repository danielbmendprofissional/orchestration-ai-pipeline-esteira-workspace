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
const md = process.argv.includes('--md'); // markdown (tabelas) para o chat; sem a flag, texto alinhado para o terminal
const larg = Math.max(12, ...comandos.map((c) => c.nome.length + 1), ...skills.map((s) => s.nome.length + 1));
const celula = (s) => s.replace(/\|/g, '\\|');
const titulo = (t) => console.log(md ? `\n### ${t}\n\n| Comando | O que faz |\n|---|---|` : `\n${t}`);
const linha = (nome, arq) => console.log(md ? `| \`/${nome}\` | ${celula(descricao(arq))} |` : `  /${nome.padEnd(larg - 1)} ${descricao(arq)}`);

titulo('COMANDOS DO PROJETO');
for (const c of comandos) linha(c.nome, c.arq);

const entrada = ENTRADA.map((n) => skills.find((s) => s.nome === n)).filter(Boolean);
if (entrada.length) {
  titulo('SKILLS DE ENTRADA (as que você chama de vez em quando)');
  for (const s of entrada) linha(s.nome, s.arq);
}

// Comandos nativos do Claude Code (não vivem em .claude/commands): gasto e contexto
const NATIVOS = [
  ['context', 'Mostra de onde vem o contexto da sessão agora: prompt do sistema, ferramentas, MCPs, CLAUDE.md/memórias, skills e mensagens, com tokens de cada parte'],
  ['mcp', 'Liga/desliga os servidores MCP (GitHub, GitLab, Figma...). Desligue os que o projeto não usa: cada um reenvia suas ferramentas a toda chamada. Fica gravado por projeto'],
  ['cost','Tokens e custo estimado desta sessão (no plano, o custo é só estimativa)'],
  ['usage', 'Uso do seu plano e quanto falta para o limite da sessão/semana'],
  ['clear', 'Zera o contexto e começa conversa nova (o histórico antigo fica em disco; para apagar de verdade: /limpar)'],
  ['compact', 'Resume a conversa para liberar contexto sem perder o fio'],
];
console.log(md ? '\n### NATIVOS DO CLAUDE CODE (gasto e contexto)\n\n| Comando | O que faz |\n|---|---|' : '\nNATIVOS DO CLAUDE CODE (gasto e contexto)');
for (const [n, d] of NATIVOS) console.log(md ? `| \`/${n}\` | ${d} |` : `  /${n.padEnd(larg - 1)} ${d}`);
console.log(`${md ? '\n' : ''}Para o gasto por ticket e por subagente da fatia: \`/gasto\` (do projeto, lê os transcritos sem gastar token).`);

if (tudo) {
  const resto = skills.filter((s) => !ENTRADA.includes(s.nome));
  titulo(`TODAS AS OUTRAS SKILLS (${resto.length}: segurança, auditoria, escrita... só quando você pedir)`);
  for (const s of resto) linha(s.nome, s.arq);
} else if (skills.length) {
  console.log(`\n${md ? '**' : ''}Há mais ${skills.length - entrada.length} skills instaladas (segurança, auditoria, escrita...). Para ver todas: /ajuda tudo${md ? '**' : ''}`);
}

console.log('\nPerdido sobre o que fazer agora? `/proximo` · Estado do git? `/situacao` · Detalhe de cada comando: docs-human/glossario-de-comandos.md');
