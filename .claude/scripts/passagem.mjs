#!/usr/bin/env node
// Passagem de sessão: o resumo que uma conversa deixa para a próxima, em `.claude/passagem.md` (fora do git).
// Zero token. Rode da raiz do workspace.
//
//   node .claude/scripts/passagem.mjs --cabecalho   # imprime a linha de cabeçalho (data, branch e sha de cada repositório) para o /limpar gravar no topo do arquivo
//   node .claude/scripts/passagem.mjs --ler         # hook SessionStart: se existir, imprime a passagem (vira contexto da sessão nova) e a marca como lida
//
// Lida = renomeada para `.claude/passagem.lida.md` (sobrescreve a anterior), então não é relida na sessão seguinte.
// Avisa se tem mais de 3 dias ou se a branch de algum repositório mudou desde que foi escrita.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const arq = join(raiz, '.claude', 'passagem.md');
const lida = join(raiz, '.claude', 'passagem.lida.md');

const git = (repo, ...a) => { try { return execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const repos = () => {
  const lista = [['workspace', raiz]];
  for (const d of readdirSync(raiz, { withFileTypes: true })) if (d.isDirectory() && existsSync(join(raiz, d.name, '.git'))) lista.push([d.name, join(raiz, d.name)]);
  return lista;
};
const estado = () => Object.fromEntries(repos().map(([n, p]) => [n, `${git(p, 'branch', '--show-current') || '?'}@${git(p, 'rev-parse', '--short', 'HEAD') || '?'}`]));

const modo = process.argv[2];

if (modo === '--cabecalho') {
  const est = estado();
  console.log(`<!-- passagem: ${new Date().toISOString().slice(0, 16)} | ${Object.entries(est).map(([n, v]) => `${n}=${v}`).join(' | ')} -->`);
  process.exit(0);
}

if (modo === '--ler') {
  if (!existsSync(arq)) process.exit(0); // sem passagem: não imprime nada, não custa nada
  const texto = readFileSync(arq, 'utf8');
  const m = texto.match(/<!--\s*passagem:\s*([^|]+?)\s*\|([^>]*?)-->/);
  const avisos = [];
  if (m) {
    const dias = (Date.now() - new Date(m[1].trim() + 'Z').getTime()) / 86400000;
    if (dias > 3) avisos.push(`escrita há ${Math.floor(dias)} dias: confira se ainda vale`);
    const antes = Object.fromEntries(m[2].split('|').map((s) => s.trim()).filter(Boolean).map((s) => s.split('=')).filter((p) => p.length === 2));
    const agora = estado();
    const mudou = Object.entries(antes).filter(([n, v]) => agora[n] && agora[n].split('@')[0] !== v.split('@')[0]).map(([n, v]) => `${n}: era ${v.split('@')[0]}, agora ${agora[n].split('@')[0]}`);
    if (mudou.length) avisos.push(`a branch mudou desde a passagem (${mudou.join('; ')})`);
  } else avisos.push('sem cabeçalho de data/branch: não dá para saber se está atual');
  console.log('=== PASSAGEM DA SESSÃO ANTERIOR (.claude/passagem.md) ===');
  console.log('Leia e retome daqui. Diga ao humano em UMA linha que leu a passagem e qual é a próxima ação; não repita o conteúdo. Se houver aviso abaixo, confirme com ele antes de agir.');
  if (avisos.length) console.log(`AVISO: ${avisos.join('; ')}.`);
  console.log('---');
  console.log(texto.trim());
  console.log('=== FIM DA PASSAGEM ===');
  try { renameSync(arq, lida); } catch { /* sem permissão de escrita: será lida de novo na próxima */ }
  process.exit(0);
}

console.log('uso: passagem.mjs --cabecalho | --ler');
process.exit(2);
