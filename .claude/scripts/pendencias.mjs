#!/usr/bin/env node
// Conta as pendências abertas dos arquivos de pendência (zero token). Somente leitura. Rode da raiz do workspace.
//
// Convenção (docs/agents/pendencias.md): UMA pendência = UMA linha `- [ ]` (aberta) ou `- [x]` (feita) em
//   PENDENCIAS.md · pendencias-*.md · docs/PENDENCIAS.md · docs/pendencias-*.md · docs/mudancas-*.md
// na raiz do workspace e de cada repositório de código (e, fora de --so-projeto, em ai-base/ai-infra/ai-ops/template-ci).
// Linha em bloco de código (```) não conta. Arquivo com `<!-- pendencias: ignorar ... -->` nas 5 primeiras linhas é pulado.
//
//   node .claude/scripts/pendencias.mjs            # uma linha por arquivo + total
//   node .claude/scripts/pendencias.mjs --lista    # também cada pendência aberta
//   node .claude/scripts/pendencias.mjs --resumo   # uma linha só (usado pelo /situacao)
//   node .claude/scripts/pendencias.mjs --so-projeto
// Saída 0 sempre (pendência de documento não bloqueia fatia); arquivo sem checkbox aparece como "formato antigo".
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const lista = args.includes('--lista');
const resumo = args.includes('--resumo');
const soProjeto = args.includes('--so-projeto');
const root = resolve('.');
const isRepo = (p) => existsSync(join(p, '.git'));

const bases = [{ nome: basename(root), path: root }];
for (const d of readdirSync(root, { withFileTypes: true }))
  if (d.isDirectory() && isRepo(join(root, d.name))) bases.push({ nome: d.name, path: join(root, d.name) });
if (!soProjeto) {
  let up = dirname(root);
  for (let i = 0; i < 4 && up !== dirname(up); i++, up = dirname(up)) {
    if (existsSync(join(up, 'ai-base')) && existsSync(join(up, 'ai-ops'))) {
      for (const r of ['ai-base', 'ai-infra', 'ai-ops', 'ai-pipeline/template-ci']) if (isRepo(join(up, r))) bases.push({ nome: r, path: join(up, r) });
      break;
    }
  }
}

const ehArquivoDePendencia = (n) => /^pendencias(-.*)?\.md$/i.test(n) || /^mudancas-.*\.md$/i.test(n);
const arquivos = new Set();
for (const b of bases) {
  for (const sub of ['', 'docs']) {
    const dir = join(b.path, sub);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true }))
      if (e.isFile() && ehArquivoDePendencia(e.name) && (sub === 'docs' || !/^mudancas-/i.test(e.name))) arquivos.add(join(dir, e.name));
  }
}

const resultados = [];
for (const arq of [...arquivos].sort()) {
  const linhas = readFileSync(arq, 'utf8').replace(/\r/g, '').split('\n');
  if (linhas.slice(0, 5).some((l) => /<!--\s*pendencias:\s*ignorar/i.test(l))) continue;
  let cerca = false;
  const abertas = [];
  let feitas = 0;
  for (const l of linhas) {
    if (/^\s*```/.test(l)) { cerca = !cerca; continue; }
    if (cerca) continue;
    if (/^\s*[-*] \[ \]/.test(l)) abertas.push(l.replace(/^\s*[-*] \[ \]\s*/, '').trim());
    else if (/^\s*[-*] \[[xX]\]/.test(l)) feitas++;
  }
  const nenhuma = /nenhuma (pendência )?aberta/i.test(linhas.join('\n'));
  resultados.push({ arq, rel: relative(dirname(root), arq).replace(/\\/g, '/'), abertas, feitas, antigo: !abertas.length && !feitas && !nenhuma });
}

const total = resultados.reduce((s, r) => s + r.abertas.length, 0);
const antigos = resultados.filter((r) => r.antigo);
const comAbertas = resultados.filter((r) => r.abertas.length);

if (resumo) {
  const partes = [`${total} pendência(s) aberta(s) em ${comAbertas.length} arquivo(s)`];
  if (antigos.length) partes.push(`${antigos.length} arquivo(s) em formato antigo, sem checkbox`);
  console.log(`Pendências: ${partes.join(' · ')}${total || antigos.length ? ' — detalhe: node .claude/scripts/pendencias.mjs --lista' : ''}`);
  process.exit(0);
}

console.log('PENDÊNCIAS ABERTAS (linhas `- [ ]`)');
for (const r of resultados) {
  if (r.antigo) console.log(`  ?  ${r.rel}  — sem checkbox (formato antigo): converter cada pendência em \`- [ ]\``);
  else console.log(`  ${String(r.abertas.length).padStart(2)} abertas · ${String(r.feitas).padStart(2)} feitas  ${r.rel}`);
  if (lista) for (const a of r.abertas) console.log(`       - ${a.length > 140 ? `${a.slice(0, 137)}...` : a}`);
}
console.log(`\nTotal: ${total} aberta(s)${antigos.length ? ` · ${antigos.length} arquivo(s) a converter` : ''}.${lista ? '' : ' Para ver cada uma: --lista'}`);
