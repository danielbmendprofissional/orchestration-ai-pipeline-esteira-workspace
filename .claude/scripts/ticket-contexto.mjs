#!/usr/bin/env node
// Recorta a spec para uma ticket, sem modelo: cabeçalho, contexto, ideia, só as seções da área e só os critérios que a ticket cobre.
// O subagente lê este arquivo em vez da spec inteira (e abre a spec inteira só se o recorte não bastar).
//
//   node .claude/scripts/ticket-contexto.mjs <spec> --cobre "1,3,5-7" [--area back|front] [--nome A1.4]
//   node .claude/scripts/ticket-contexto.mjs <spec> --cabecalho        (só cabeçalho + Ideia: o que a sessão principal precisa)
//
// Grava em <tmp do SO>/ticket-<nome>.md e imprime o caminho. Texto literal da spec: nada é resumido.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const a = process.argv.slice(2);
const spec = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--cobre' && a[a.indexOf(x) - 1] !== '--area' && a[a.indexOf(x) - 1] !== '--nome');
const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
if (!spec || (!opt('--cobre') && !a.includes('--cabecalho'))) {
  console.error('uso: ticket-contexto.mjs <spec> --cobre "1,3,5-7" [--area back|front] [--nome A1.4]  |  <spec> --cabecalho');
  process.exit(2);
}

const linhas = readFileSync(spec, 'utf8').split(/\r?\n/);
const secoes = []; // {titulo, linhas}
let atual = { titulo: '__cabecalho', linhas: [] };
for (const l of linhas) {
  if (/^## /.test(l)) { secoes.push(atual); atual = { titulo: l.slice(3).trim(), linhas: [l] }; } else atual.linhas.push(l);
}
secoes.push(atual);
const get = (re) => secoes.find((s) => re.test(s.titulo));
const txt = (s) => (s ? s.linhas.join('\n').replace(/\s+$/, '') : '');

const cobre = new Set();
if (opt('--cobre')) {
  for (const p of opt('--cobre').split(/[,;]/)) {
    const r = p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (r) for (let n = +r[1]; n <= +(r[2] ?? r[1]); n++) cobre.add(n);
  }
}

const area = opt('--area');
const naoSeAplica = (s) => /^N\/A\.?$/i.test(s.linhas.slice(1).join(' ').trim());
const daArea = (s) => {
  if (/^(Contexto necess|Ideia|Crit[eé]rios|Checklist|Testes)/i.test(s.titulo) || s.titulo === '__cabecalho') return null; // tratadas à parte
  if (naoSeAplica(s)) return false;
  if (!area) return true;
  if (area === 'back') return /^(Dados|Backend|Infra)/i.test(s.titulo);
  if (area === 'front') return /^(Frontend|Infra)/i.test(s.titulo);
  return true;
};

const partes = [txt(get(/^__cabecalho$/)), txt(get(/^Ideia/i))];
if (!a.includes('--cabecalho')) {
  partes.splice(1, 0, txt(get(/^Contexto necess/i)));
  for (const s of secoes) if (daArea(s) === true) partes.push(txt(s));
  const crit = get(/^Crit[eé]rios/i);
  if (crit) {
    const itens = crit.linhas.slice(1).filter((l) => /^\d+\.\s/.test(l) && cobre.has(+l.match(/^(\d+)\./)[1]));
    partes.push(`## Critérios desta ticket (Cobre: ${[...cobre].join(', ')} — os demais são de outras tickets)\n${itens.join('\n')}`);
  } else {
    const chk = get(/^Checklist/i);
    if (chk) {
      let n = 0;
      const itens = chk.linhas.slice(1).filter((l) => /^\s*- \[[ x]\]/.test(l)).filter(() => cobre.has(++n));
      partes.push(`## Checklist desta ticket (Cobre: ${[...cobre].join(', ')})\n${itens.join('\n')}`);
    }
  }
  partes.push(txt(get(/^Testes/i)));
}
const saida = partes.filter(Boolean).join('\n\n') + '\n\n> Recorte automático da spec (texto literal). Faltou algo para a ticket? Abra a spec inteira e diga no relatório o que faltava no recorte.\n';

if (a.includes('--cabecalho')) { process.stdout.write(saida); process.exit(0); }
const nome = (opt('--nome') || `${Date.now()}`).replace(/[^\w.-]/g, '_');
const arq = join(tmpdir(), `ticket-${nome}.md`);
writeFileSync(arq, saida);
const total = linhas.join('\n').length;
console.log(`${arq}  (${saida.length} de ${total} caracteres da spec, ${Math.round((saida.length / total) * 100)}%)`);
