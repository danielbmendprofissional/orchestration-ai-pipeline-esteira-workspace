#!/usr/bin/env node
// Situação de todos os repositórios e áreas de trabalho: em que branch cada um está e o que fazer
// (commitar, subir, mergear MR, alinhar, apagar). Somente leitura (faz `git fetch`). Rode da raiz do workspace.
//
//   node .claude/scripts/situacao.mjs            # workspace + repositórios de código + áreas (<workspace>.wt/) + repos do orquestracao-ai
//   node .claude/scripts/situacao.mjs --sem-mr   # não consulta as MRs abertas no GitLab (glab)
//   node .claude/scripts/situacao.mjs --so-projeto   # sem os repositórios do orquestracao-ai
//
// Saída 1 se houver pendência de prioridade 1 ou 2 (algo seu a fazer antes da próxima fatia).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const semMr = args.includes('--sem-mr');
const soProjeto = args.includes('--so-projeto');
const root = resolve('.');

const git = (repo, ...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
const tryGit = (repo, ...a) => { try { return git(repo, ...a); } catch { return null; } };
const ok = (repo, ...a) => tryGit(repo, ...a) !== null;
const isRepo = (p) => existsSync(join(p, '.git'));

// ---- quais repositórios
const repos = [{ nome: basename(root) + ' (workspace)', path: root, tipo: 'workspace' }];
for (const d of readdirSync(root, { withFileTypes: true }))
  if (d.isDirectory() && isRepo(join(root, d.name))) repos.push({ nome: d.name, path: join(root, d.name), tipo: 'codigo' });
const wtDir = join(dirname(root), basename(root) + '.wt');
if (existsSync(wtDir)) for (const a of readdirSync(wtDir, { withFileTypes: true })) if (a.isDirectory()) {
  const areaPath = join(wtDir, a.name);
  if (isRepo(areaPath)) repos.push({ nome: `área ${a.name} (workspace)`, path: areaPath, tipo: 'area' });
  for (const d of readdirSync(areaPath, { withFileTypes: true })) if (d.isDirectory() && isRepo(join(areaPath, d.name))) repos.push({ nome: `área ${a.name}/${d.name}`, path: join(areaPath, d.name), tipo: 'area' });
}
if (!soProjeto) {
  let up = dirname(root);
  for (let i = 0; i < 4 && up !== dirname(up); i++, up = dirname(up)) {
    if (existsSync(join(up, 'ai-base')) && existsSync(join(up, 'ai-ops'))) {
      for (const r of ['ai-base', 'ai-infra', 'ai-ops', 'ai-pipeline/template-ci']) if (isRepo(join(up, r))) repos.push({ nome: r, path: join(up, r), tipo: 'orquestracao' });
      break;
    }
  }
}

const protegidas = new Set(['dev', 'qa', 'hml', 'main', 'master']);
const acoes = []; // {p, repo, texto, cmd}
const add = (p, repo, texto, cmd) => acoes.push({ p, repo, texto, cmd });
const out = [];

const caminhoGitlab = (repo) => {
  const u = tryGit(repo, 'remote', 'get-url', 'origin') ?? '';
  const m = u.match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
  return m ? m[1] : null;
};
const mrsAbertas = (repo) => {
  if (semMr) return null;
  const proj = caminhoGitlab(repo);
  if (!proj) return null;
  try {
    return JSON.parse(execFileSync('glab', ['mr', 'list', '-R', proj, '-F', 'json', '--per-page', '100'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }) || '[]');
  } catch { return null; }
};

for (const r of repos) {
  tryGit(r.path, 'fetch', 'origin', '--prune');
  const atual = tryGit(r.path, 'branch', '--show-current') || '(detached)';
  const baseNome = ok(r.path, 'rev-parse', '--verify', 'origin/dev') ? 'dev'
    : (tryGit(r.path, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD') ?? 'origin/main').replace('origin/', '');
  const base = `origin/${baseNome}`;
  const temBase = ok(r.path, 'rev-parse', '--verify', base);
  const dirty = (tryGit(r.path, 'status', '--porcelain') ?? '').split('\n').filter(Boolean);
  const mrs = mrsAbertas(r.path);
  const mrPorBranch = new Map((mrs ?? []).map((m) => [m.source_branch, m]));
  const linhas = [];

  if (dirty.length) {
    linhas.push(`  alterações locais: ${dirty.length} arquivo(s)`);
    add(1, r.nome, `${dirty.length} arquivo(s) com alteração não comitada em ${atual}: comitar ou descartar`, `git -C "${r.path}" status -s`);
  }

  const refs = (tryGit(r.path, 'for-each-ref', 'refs/heads', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)') ?? '').split('\n').filter(Boolean);
  for (const linha of refs) {
    const [b, up, track = ''] = linha.split('|');
    const ehBase = protegidas.has(b);
    const aheadBase = temBase ? Number(tryGit(r.path, 'rev-list', '--count', `${base}..${b}`) ?? 0) : 0;
    const mergeada = temBase && ok(r.path, 'merge-base', '--is-ancestor', b, base);
    const remotaExiste = ok(r.path, 'rev-parse', '--verify', `origin/${b}`);
    const aheadUp = Number(track.match(/ahead (\d+)/)?.[1] ?? 0);
    const behindUp = Number(track.match(/behind (\d+)/)?.[1] ?? 0);
    const gone = /gone/.test(track);
    const mr = mrPorBranch.get(b);
    const marca = b === atual ? '*' : ' ';
    let estado;

    if (ehBase) {
      if (b === baseNome && temBase) {
        const atras = Number(tryGit(r.path, 'rev-list', '--count', `${b}..${base}`) ?? 0);
        const adiante = Number(tryGit(r.path, 'rev-list', '--count', `${base}..${b}`) ?? 0);
        estado = adiante ? `${adiante} commit(s) LOCAIS fora do GitLab` : atras ? `${atras} atrás do GitLab` : 'alinhada';
        if (adiante) add(1, r.nome, `a branch ${b} tem ${adiante} commit(s) local(is) que não estão no GitLab (push direto na ${b} é bloqueado): mover para uma branch de feature e abrir MR`, `git -C "${r.path}" log ${base}..${b} --oneline`);
        else if (atras && b !== atual) add(3, r.nome, `${b} está ${atras} commit(s) atrás do GitLab`, `git -C "${r.path}" switch ${b} && git -C "${r.path}" pull --ff-only`);
        else if (atras) add(3, r.nome, `${b} está ${atras} commit(s) atrás do GitLab`, `git -C "${r.path}" pull --ff-only`);
      } else estado = 'protegida';
    } else if (mr) {
      estado = `MR !${mr.iid} aberta`;
      add(2, r.nome, `revisar e mergear a MR !${mr.iid} (${b}): ${mr.web_url}`, null);
      if (aheadUp) add(1, r.nome, `${b} tem ${aheadUp} commit(s) ainda não enviados à MR`, `git -C "${r.path}" push`);
    } else if (mergeada) {
      estado = remotaExiste ? `já mergeada em ${baseNome} · remota ainda existe` : `já mergeada em ${baseNome}`;
      if (b === atual) add(3, r.nome, `${b} já foi mergeada; voltar para ${baseNome} e atualizar`, `git -C "${r.path}" switch ${baseNome} && git -C "${r.path}" pull --ff-only`);
      else add(4, r.nome, `apagar a branch local ${b} (já mergeada)`, `git -C "${r.path}" branch -d ${b}`);
      if (remotaExiste) add(4, r.nome, `apagar a branch remota ${b} (já mergeada)`, `git -C "${r.path}" push origin --delete ${b}`);
    } else if (gone) {
      estado = 'remota apagada, mas há commits não mergeados';
      add(1, r.nome, `${b}: a remota sumiu e a branch local tem ${aheadBase} commit(s) que NÃO estão em ${baseNome} — conferir antes de apagar`, `git -C "${r.path}" log ${base}..${b} --oneline`);
    } else if (!up && aheadBase > 0) {
      estado = `${aheadBase} commit(s), nunca enviada`;
      add(1, r.nome, `${b} nunca foi enviada ao GitLab (${aheadBase} commit(s)): subir e abrir a MR`, `git -C "${r.path}" push -u origin ${b}`);
    } else if (aheadUp) {
      estado = `${aheadUp} commit(s) não enviado(s)`;
      add(1, r.nome, `${b}: ${aheadUp} commit(s) não enviado(s)`, `git -C "${r.path}" push`);
    } else if (aheadBase > 0) {
      estado = `${aheadBase} commit(s) à frente de ${baseNome}, sem MR aberta${mrs === null ? ' (MRs não consultadas)' : ''}`;
      if (mrs !== null) add(2, r.nome, `${b} está no GitLab sem MR aberta: abrir a MR para ${baseNome} (ou apagar, se foi abandonada)`, null);
    } else {
      estado = 'sem commits novos';
      add(4, r.nome, `${b} não tem commit novo em relação a ${baseNome}: apagar se não for usar`, `git -C "${r.path}" branch -d ${b}`);
    }
    if (behindUp && !ehBase) add(3, r.nome, `${b} está ${behindUp} commit(s) atrás da remota`, `git -C "${r.path}" pull --ff-only`);
    linhas.push(`${marca} ${b.padEnd(34)} ${estado}`);
  }

  // branches remotas sem branch local
  const locais = new Set(refs.map((l) => l.split('|')[0]));
  const remotas = (tryGit(r.path, 'for-each-ref', 'refs/remotes/origin', '--format=%(refname:short)') ?? '').split('\n')
    .map((x) => x.replace('origin/', '')).filter((x) => x && x !== 'HEAD' && x !== 'origin' && !protegidas.has(x) && !locais.has(x));
  for (const b of remotas) {
    const mergeada = temBase && ok(r.path, 'merge-base', '--is-ancestor', `origin/${b}`, base);
    const mr = mrPorBranch.get(b);
    if (mr) { linhas.push(`  (remota) ${b.padEnd(25)} MR !${mr.iid} aberta`); add(2, r.nome, `revisar e mergear a MR !${mr.iid} (${b}): ${mr.web_url}`, null); }
    else if (mergeada) { linhas.push(`  (remota) ${b.padEnd(25)} já mergeada`); add(4, r.nome, `apagar a branch remota ${b} (já mergeada)`, `git -C "${r.path}" push origin --delete ${b}`); }
    else { linhas.push(`  (remota) ${b.padEnd(25)} sem MR e não mergeada`); if (mrs !== null) add(2, r.nome, `branch remota ${b} sem MR e não mergeada: abrir MR ou apagar`, null); }
  }

  const worktrees = (tryGit(r.path, 'worktree', 'list') ?? '').split('\n').filter(Boolean);
  out.push(`\n== ${r.nome} — base ${baseNome} — atual: ${atual}${dirty.length ? ' (com alterações)' : ''}\n   ${r.path}`);
  out.push(...linhas);
  if (worktrees.length > 1) out.push(`  worktrees: ${worktrees.length - 1} adicional(is)`);
  if (mrs === null && !semMr) out.push('  (MRs: glab indisponível ou sem acesso)');
}

console.log(out.join('\n'));
const nomes = { 1: 'COMMITAR / SUBIR (seu, agora)', 2: 'MERGEAR / ABRIR MR (decisão sua)', 3: 'ALINHAR', 4: 'LIMPAR (seguro: só branches já mergeadas)' };
console.log('\n=== O QUE FAZER ===');
if (!acoes.length) console.log('Nada. Tudo alinhado.');
for (const p of [1, 2, 3, 4]) {
  const lst = acoes.filter((a) => a.p === p);
  if (!lst.length) continue;
  console.log(`\n${p}. ${nomes[p]}`);
  lst.forEach((a, i) => console.log(`   ${p}.${i + 1} [${a.repo}] ${a.texto}${a.cmd ? `\n         ${a.cmd}` : ''}`));
}
const bloqueia = acoes.some((a) => a.p <= 2);
console.log(`\nPronto para começar a próxima fatia? ${bloqueia ? 'NÃO — resolva as pendências de prioridade 1 e 2' : acoes.some((a) => a.p === 3) ? 'QUASE — alinhe (prioridade 3) antes' : 'SIM'}`);
process.exit(bloqueia ? 1 : 0);
