#!/usr/bin/env node
// Detecta spec que envelheceu: o código (ou as ADRs) mudou em `dev` depois do ponto em que ela foi escrita.
// Zero token. Rode da raiz do workspace.
//
//   node .claude/scripts/check-spec-drift.mjs                 # todas as specs do mapa ainda não "feito"
//   node .claude/scripts/check-spec-drift.mjs <spec.md> ...   # specs específicas
//   node .claude/scripts/check-spec-drift.mjs --print-base    # a linha `base:` de agora
//   node .claude/scripts/check-spec-drift.mjs --stamp <spec.md>   # grava/atualiza a linha `base:` na spec
//
// A spec registra a base numa linha: `base: workspace@1a2b3c4 · esteira-api@a8bc19f · esteira-frontend@dfb1f2e · 2026-10-25`
// (sha de origin/main do workspace e de origin/dev de cada repositório de código). Sem essa linha a spec é
// tratada como velha. Saída 1 se alguma spec estiver desatualizada ou sem base.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('.');
const args = process.argv.slice(2);

const git = (repo, ...a) => execFileSync('git', ['-C', repo === 'workspace' ? root : join(root, repo), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
const has = (repo, obj) => tryGit(repo, 'cat-file', '-e', obj) !== null;
const tryGit = (repo, ...a) => { try { return git(repo, ...a); } catch { return null; } };

const codeRepos = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, '.git')))
  .map((d) => d.name);
const tip = (repo) => (repo === 'workspace' ? (tryGit(repo, 'rev-parse', '--verify', 'origin/main') ? 'origin/main' : 'HEAD') : 'origin/dev');

for (const r of ['workspace', ...codeRepos]) tryGit(r, 'fetch', 'origin');

const baseLine = () => {
  const parts = ['workspace', ...codeRepos].map((r) => `${r}@${tryGit(r, 'rev-parse', '--short', tip(r)) ?? '?'}`);
  return `base: ${parts.join(' · ')} · ${new Date().toISOString().slice(0, 10)}`;
};

if (args[0] === '--print-base') { console.log(baseLine()); process.exit(0); }

if (args[0] === '--stamp') {
  const f = args[1];
  const lines = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const i = lines.findIndex((l) => /^base:\s/.test(l));
  if (i >= 0) lines[i] = baseLine();
  else {
    const k = lines.findIndex((l) => /^risco:\s/.test(l));
    lines.splice(k >= 0 ? k + 1 : 1, 0, ...(k >= 0 ? [] : ['']), baseLine());
  }
  writeFileSync(f, lines.join('\n'));
  console.log(`${f}: ${baseLine()}`);
  process.exit(0);
}

// --- quais specs conferir
let specs = args.filter((a) => !a.startsWith('--'));
if (!specs.length) {
  const mapa = readFileSync(join(root, 'specs/README.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  for (const l of mapa) {
    const m = l.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/); // Status | #
    if (!m || /^(Status|-+)$/.test(m[1]) || /^feito/i.test(m[1])) continue;
    const link = l.match(/\]\((feature\/[^)]+\.md)\)/);
    if (link) specs.push(`specs/${link[1]}`);
  }
}
if (!specs.length) { console.log('Nenhuma spec pendente com arquivo para conferir.'); process.exit(0); }

// --- caminhos citados na spec (entre crases)
const citados = (texto) => [...new Set([...texto.matchAll(/`([^`\s]+)`/g)].map((m) => m[1].replace(/[:#].*$/, '')))]
  .filter((p) => /\//.test(p) || /\.(cs|csproj|ts|json|md|sql|ya?ml|html|css)$/i.test(p))
  .filter((p) => !/^https?:/.test(p) && !p.startsWith('/api') && !p.includes('*') && !p.includes('<'));

let algumProblema = false;
for (const spec of specs) {
  const texto = readFileSync(resolve(root, spec), 'utf8').replace(/\r\n/g, '\n');
  const linha = texto.match(/^base:\s*(.+)$/m);
  const problemas = [];
  if (!linha) {
    problemas.push('sem linha `base:` — não dá pra saber sobre qual código foi escrita; trate como velha');
  } else {
    const bases = Object.fromEntries([...linha[1].matchAll(/([\w.-]+)@([0-9a-f]{7,40})/g)].map((m) => [m[1], m[2]]));
    const paths = citados(texto);
    for (const [repo, sha] of Object.entries(bases)) {
      if (repo !== 'workspace' && !codeRepos.includes(repo)) continue;
      const t = tip(repo);
      if (!has(repo, `${sha}^{commit}`)) { problemas.push(`${repo}: base ${sha} não existe mais no repositório`); continue; }
      const n = Number(tryGit(repo, 'rev-list', '--count', `${sha}..${t}`) ?? 0);
      if (!n) continue;
      const mudados = new Set((tryGit(repo, 'diff', '--name-only', `${sha}..${t}`) ?? '').split('\n').filter(Boolean));
      const tocados = [];
      const sumidos = [];
      for (const p of paths) {
        const cand = [p, ...(p.startsWith(`${repo}/`) ? [p.slice(repo.length + 1)] : [])];
        for (const c of cand) {
          if (!has(repo, `${sha}:${c}`)) continue; // não existia na base: arquivo novo da fatia ou de outro repo
          if (!has(repo, `${t}:${c}`)) sumidos.push(c);
          else if (mudados.has(c)) tocados.push(c);
        }
      }
      const partes = [`${n} commit(s) novos em ${repo} desde a base`];
      if (sumidos.length) partes.push(`citados que sumiram: ${sumidos.join(', ')}`);
      if (tocados.length) partes.push(`citados que mudaram: ${tocados.slice(0, 6).join(', ')}${tocados.length > 6 ? '…' : ''}`);
      // só é "desatualizada" se tocou no que a spec cita; commits em outras áreas viram aviso
      if (sumidos.length || tocados.length) problemas.push(partes.join(' · '));
      else console.log(`   (info) ${spec}: ${partes[0]}, mas nenhum arquivo citado mudou`);
    }
  }
  if (problemas.length) {
    algumProblema = true;
    console.log(`⚠ ${spec} — desatualizada\n${problemas.map((p) => `    - ${p}`).join('\n')}`);
  } else console.log(`✔ ${spec} — em dia`);
}
process.exit(algumProblema ? 1 : 0);
