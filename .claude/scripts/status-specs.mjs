#!/usr/bin/env node
// Status real das fatias do mapa (zero token): cruza o que o `specs/README.md` diz com a evidência —
// issue-mãe no GitLab, MR mergeada em `dev` e testes marcados com o código da fatia
// (`docs/agents/orchestration.md`, "Marca da fatia nos testes"). Somente leitura. Rode da raiz do workspace.
//
//   node .claude/scripts/status-specs.mjs                 # tabela de todas as fatias do mapa
//   node .claude/scripts/status-specs.mjs B2              # uma linha, pra o agente ler
//   node .claude/scripts/status-specs.mjs B2 --pre-entrega  # gate do /implement-task: a fatia tem teste marcado?
//   --sem-gitlab   não consulta issue/MR (só mapa + testes)       --fetch   `git fetch` antes de conferir
//
// Estados: implementada · em execução · não iniciada · inconsistente (status do mapa e evidência não batem).
// Saída 1 se alguma fatia consultada estiver inconsistente (ou, em --pre-entrega, sem teste marcado).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const alvo = args.find((a) => !a.startsWith('--'));
const semGitlab = flags.has('--sem-gitlab');
const preEntrega = flags.has('--pre-entrega');
const root = resolve('.');

const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, timeout: 60000, ...opts });
const tryRun = (cmd, a) => { try { return run(cmd, a); } catch { return null; } };
const git = (repo, ...a) => tryRun('git', ['-C', repo, ...a]);

// ---- mapa
const mapaPath = join(root, 'specs', 'README.md');
if (!existsSync(mapaPath)) { console.error('specs/README.md não encontrado: rode da raiz do workspace'); process.exit(2); }
const linhas = readFileSync(mapaPath, 'utf8').split(/\r?\n/);
const iHeader = linhas.findIndex((l) => /^\|\s*Status\s*\|/i.test(l));
if (iHeader < 0) { console.error('tabela do mapa (coluna Status) não encontrada em specs/README.md'); process.exit(2); }
const cabecalho = linhas[iHeader].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
const col = (nome) => cabecalho.findIndex((c) => c.startsWith(nome));
const cStatus = col('status'), cCodigo = col('#'), cFatia = col('fatia'), cRepo = col('reposit');

const fatias = [];
for (let i = iHeader + 2; i < linhas.length && linhas[i].trim().startsWith('|'); i++) {
  const c = linhas[i].split('|').slice(1, -1).map((x) => x.trim());
  const fatiaTxt = c[cFatia] ?? '';
  const spec = fatiaTxt.match(/\]\(([^)]+\.md)\)/)?.[1] ?? null;
  const issue = [...fatiaTxt.matchAll(/#(\d+)/g)].pop()?.[1] ?? null;
  fatias.push({ codigo: c[cCodigo], status: c[cStatus], repoTxt: (c[cRepo] ?? '').toLowerCase(), spec, issue });
}

// ---- repositórios de código (api/frontend) e GitLab
const repos = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, '.git')))
  .map((d) => ({ nome: d.name, path: join(root, d.name) }));
const gitlabPath = (dir) => (git(dir, 'remote', 'get-url', 'origin') ?? '').trim().match(/gitlab\.com[:/](.+?)(?:\.git)?$/)?.[1] ?? null;
const wsGitlab = gitlabPath(root);
for (const r of repos) r.gitlab = gitlabPath(r.path);
if (flags.has('--fetch')) for (const r of [{ path: root }, ...repos]) git(r.path, 'fetch', 'origin', '--prune');

// ---- GitLab (glab api; null = indisponível)
const glab = (rota) => {
  if (semGitlab) return null;
  try { return JSON.parse(run('glab', ['api', rota])); } catch { return null; }
};
const enc = encodeURIComponent;
// MRs mergeadas em dev, buscadas uma vez por repositório (até 10 páginas de 100) e filtradas localmente por fatia
const mrCache = new Map();
const mrsMergeadas = (r) => {
  if (mrCache.has(r.nome)) return mrCache.get(r.nome);
  let todas = r.gitlab ? [] : null;
  for (let pagina = 1; todas && pagina <= 10; pagina++) {
    const lote = glab(`projects/${enc(r.gitlab)}/merge_requests?state=merged&target_branch=dev&per_page=100&page=${pagina}`);
    if (lote === null) { todas = pagina === 1 ? null : todas; break; }
    todas.push(...lote);
    if (lote.length < 100) break;
  }
  mrCache.set(r.nome, todas);
  return todas;
};
const slugs = (cod) => [cod.toLowerCase(), cod.toLowerCase().replace(/\./g, '-')];
const ehDaFatia = (mr, cod) => new RegExp(`^${cod.replace(/\./g, '\\.')}\\b`, 'i').test(mr.title ?? '')
  || slugs(cod).some((s) => (mr.source_branch ?? '').startsWith(`feature/${s}-`));

// merge commit "Merge branch 'feature/<fatia>-…' into 'dev'" em origin/dev: vale quando a MR não está no GitLab (fatia mergeada antes do processo)
const mergeCommitNoGit = (r, cod) => {
  if (!git(r.path, 'rev-parse', '--verify', 'origin/dev')) return false;
  return slugs(cod).some((s) => (git(r.path, 'log', 'origin/dev', '--merges', '--format=%s', '--fixed-strings', `--grep=Merge branch 'feature/${s}-`) ?? '').trim() !== '');
};

// ---- testes marcados (árvore de trabalho = o que está na branch, comitado ou não; e origin/dev)
const PATHSPEC = ['*Tests.cs', '*Test.cs', '*.spec.ts', '*.test.ts', '*Tests.*'];
const marcas = (cod) => {
  const c = cod.replace(/\./g, '\\.');
  return [
    `Trait\\([[:space:]]*"Fatia"[[:space:]]*,[[:space:]]*"${c}"[[:space:]]*\\)`,
    `describe\\([[:space:]]*["'\`]\\[${c}\\]`,
    `tag:.*@${c}["'\`]`,
  ];
};
const testesMarcados = (cod) => {
  const arquivos = new Set();
  for (const r of repos) {
    const refs = [null, ...(git(r.path, 'rev-parse', '--verify', 'origin/dev') ? ['origin/dev'] : [])];
    for (const ref of refs) {
      const out = tryRun('git', ['-C', r.path, 'grep', '-l', '-E', ...marcas(cod).flatMap((m) => ['-e', m]), ...(ref ? [ref] : []), '--', ...PATHSPEC]);
      for (const l of (out ?? '').split('\n').filter(Boolean)) arquivos.add(`${r.nome}/${l.replace(/^[^:]+:/, '')}`);
    }
  }
  return arquivos.size;
};

// teste exigido? só se a spec tem seção "## Testes" que não seja "N/A"; sem spec no mapa, não se sabe → não exige
const exigeTeste = (f) => {
  if (!f.spec) return false;
  const p = join(root, 'specs', f.spec);
  if (!existsSync(p)) return false;
  const m = readFileSync(p, 'utf8').replace(/\r/g, '').match(/^## Testes[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
  return !!m && !/^\s*N\/A\b/i.test(m[1]);
};

// ---- avaliar
const reposDaFatia = (f) => {
  const t = repos.filter((r) => (f.repoTxt.includes('api') && /-api$/.test(r.nome)) || (f.repoTxt.includes('frontend') && /-frontend$/.test(r.nome)));
  return t.length ? t : repos;
};
const avaliar = (f) => {
  const motivos = [];
  const feito = /^feito$/i.test(f.status);
  const testes = testesMarcados(f.codigo);
  const exige = exigeTeste(f);
  const issue = f.issue && wsGitlab ? glab(`projects/${enc(wsGitlab)}/issues/${f.issue}`) : null;
  const tocados = reposDaFatia(f);
  // por repositório: true (MR mergeada ou merge commit da branch da fatia em origin/dev), false, ou null (sem como saber)
  const mrs = tocados.map((r) => {
    const lista = mrsMergeadas(r);
    const naoGit = mergeCommitNoGit(r, f.codigo);
    return { r, merged: naoGit || (lista === null ? null : lista.some((mr) => ehDaFatia(mr, f.codigo))) };
  });
  const faltaMr = mrs.filter((m) => m.merged === false).map((m) => m.r.nome);
  const sabe = mrs.some((m) => m.merged !== null);
  const exigeTodos = f.repoTxt.includes('api') || f.repoTxt.includes('frontend');
  const mrOk = !sabe ? null : exigeTodos ? faltaMr.length === 0 : mrs.some((m) => m.merged);
  const emExecucao = issue?.labels?.includes('em-execucao') ?? false;
  const fechada = issue ? issue.state === 'closed' : null;

  let estado;
  if (feito) {
    if (exige && testes === 0) motivos.push('marcada como feito, mas nenhum teste leva a marca da fatia');
    if (mrOk === false) motivos.push(`marcada como feito, mas sem MR mergeada em ${faltaMr.join(', ') || 'dev'}`);
    if (fechada === false) motivos.push(`marcada como feito, mas a issue #${f.issue} segue aberta`);
    estado = motivos.length ? 'inconsistente' : 'implementada';
  } else if (mrOk === true || fechada === true) {
    motivos.push(`${mrOk ? 'há MR mergeada' : `a issue #${f.issue} está fechada`}, mas o mapa não diz "feito"${emExecucao ? ' e a issue ainda tem em-execucao' : ''}`);
    estado = 'inconsistente';
  } else if (emExecucao) {
    estado = 'em execução';
  } else if (testes > 0) {
    motivos.push('há teste marcado com a fatia, mas ela não está feita nem em execução');
    estado = 'inconsistente';
  } else {
    estado = 'não iniciada';
  }
  const mrTxt = mrOk === null ? '?' : mrOk ? '✔' : '✘';
  const issueTxt = !f.issue ? '—' : issue ? `#${f.issue} ${issue.state === 'closed' ? 'fechada' : 'aberta'}` : `#${f.issue} ?`;
  return { f, estado, motivos, testes, exige, mrTxt, issueTxt };
};

// ---- saída
if (alvo) {
  const f = fatias.find((x) => x.codigo?.toLowerCase() === alvo.toLowerCase());
  if (!f) { console.error(`fatia ${alvo} não está no mapa`); process.exit(2); }
  const a = avaliar(f);
  if (preEntrega) {
    const ok = !a.exige || a.testes > 0;
    console.log(ok
      ? `${f.codigo} — OK p/ entrega: ${a.testes} arquivo(s) de teste com a marca${a.exige ? '' : ' (spec sem seção Testes exigível)'}`
      : `${f.codigo} — FALHA: nenhum teste leva a marca da fatia (orchestration.md, "Marca da fatia nos testes")`);
    process.exit(ok ? 0 : 1);
  }
  console.log(`${f.codigo} — ${a.estado.toUpperCase()} · mapa "${f.status}" · issue ${a.issueTxt} · MR ${a.mrTxt} · testes ${a.testes}${a.motivos.length ? ` · ${a.motivos.join('; ')}` : ''}`);
  process.exit(a.estado === 'inconsistente' ? 1 : 0);
}

const res = fatias.map(avaliar);
const w = (s, n) => String(s).padEnd(n);
console.log(`${w('Fatia', 7)}${w('Mapa', 7)}${w('Estado', 15)}${w('Issue', 14)}${w('MR', 4)}${w('Testes', 7)}Observação`);
for (const a of res) console.log(`${w(a.f.codigo, 7)}${w(a.f.status, 7)}${w(a.estado, 15)}${w(a.issueTxt, 14)}${w(a.mrTxt, 4)}${w(a.testes, 7)}${a.motivos.join('; ')}`);
const cont = (e) => res.filter((a) => a.estado === e).length;
console.log(`\n${res.length} fatia(s): ${cont('implementada')} implementada(s) · ${cont('em execução')} em execução · ${cont('não iniciada')} não iniciada(s) · ${cont('inconsistente')} inconsistente(s)`);
if (semGitlab) console.log('(GitLab não consultado: --sem-gitlab)');
else if (res.some((a) => a.mrTxt === '?')) console.log('(MR "?": glab indisponível ou sem acesso; issue/MR não conferidos nessas linhas)');
process.exit(res.some((a) => a.estado === 'inconsistente') ? 1 : 0);
