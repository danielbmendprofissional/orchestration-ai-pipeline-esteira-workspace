#!/usr/bin/env node
// Área de trabalho isolada de uma fatia — o que permite um painel do Alethe por fatia sem um
// `git switch` quebrar o outro. Rode da RAIZ do workspace.
//
//   node .claude/scripts/worktree-fatia.mjs B2 result-e-problem-details [--repos api,frontend]
//   node .claude/scripts/worktree-fatia.mjs --remove B2
//
// Cria `<workspace>.wt/b2/`: um worktree do workspace (regras, docs, specs, .claude) e, dentro dele,
// um worktree de cada repositório de código na branch `feature/b2-<slug>` a partir de `origin/dev`.
// `.claude/skills` (não versionada) entra como junction pra não copiar 30 MB por painel.
// Depois: `cd <caminho impresso> && claude` e `/implement-task B2` lá dentro.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, copyFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const root = resolve('.');
const wtParent = join(dirname(root), `${basename(root)}.wt`);
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (cwd, ...a) => { try { return git(cwd, ...a); } catch { return null; } };

if (!existsSync(join(root, '.claude', 'commands'))) {
  console.error('Rode da raiz do workspace (a pasta com .claude/commands).');
  process.exit(2);
}

// repositórios de código = subpastas com .git próprio (o .gitignore do workspace as ignora)
const repos = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, '.git')))
  .map((d) => d.name);

if (args[0] === '--remove') {
  const dir = join(wtParent, (args[1] ?? '').toLowerCase());
  if (!args[1] || !existsSync(dir)) { console.error(`Sem área para "${args[1]}" em ${wtParent}.`); process.exit(2); }
  for (const r of repos) if (existsSync(join(dir, r))) git(join(root, r), 'worktree', 'remove', '--force', join(dir, r));
  git(root, 'worktree', 'remove', '--force', dir);
  console.log(`Removida: ${dir}. As branches feature/* continuam nos repositórios.`);
  process.exit(0);
}

const [fatia, slug] = args;
if (!fatia || !slug) { console.error('uso: worktree-fatia.mjs <fatia> <slug> [--repos api,frontend]'); process.exit(2); }
const only = args.includes('--repos') ? args[args.indexOf('--repos') + 1].split(',') : null;
const alvo = repos.filter((r) => !only || only.some((o) => r.endsWith(`-${o}`) || r === o));
const dir = join(wtParent, fatia.toLowerCase());
const branch = `feature/${fatia.toLowerCase()}-${slug}`;

if (existsSync(dir)) { console.log(`Já existe: ${dir}`); process.exit(0); }
mkdirSync(wtParent, { recursive: true });

// 1. workspace (detached: as branches do workspace não são deste painel)
tryGit(root, 'fetch', 'origin');
git(root, 'worktree', 'add', '--detach', dir, tryGit(root, 'rev-parse', '--verify', 'origin/main') ? 'origin/main' : 'HEAD');

// 2. repositórios de código, cada um na branch da fatia
for (const r of alvo) {
  const repo = join(root, r);
  git(repo, 'fetch', 'origin');
  const existe = tryGit(repo, 'rev-parse', '--verify', branch);
  if (existe) git(repo, 'worktree', 'add', join(dir, r), branch);
  else git(repo, 'worktree', 'add', '-b', branch, join(dir, r), 'origin/dev');
  console.log(`  ${r}: ${branch}`);
}

// 3. o que o git não leva: skills (junction) e config local
const skills = join(root, '.claude', 'skills');
if (existsSync(skills) && !existsSync(join(dir, '.claude', 'skills'))) {
  mkdirSync(join(dir, '.claude'), { recursive: true });
  symlinkSync(skills, join(dir, '.claude', 'skills'), 'junction');
}
for (const f of ['.claude/settings.local.json', '.mcp.json']) {
  if (existsSync(join(root, f)) && !existsSync(join(dir, f))) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    copyFileSync(join(root, f), join(dir, f));
  }
}

console.log(`\nPronto: ${dir}\n  cd "${dir}" && claude    # depois: /implement-task ${fatia}\nRemover ao fim: node .claude/scripts/worktree-fatia.mjs --remove ${fatia}`);
