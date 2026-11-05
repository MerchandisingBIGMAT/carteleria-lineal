/* Generador de carteles de precio · BigMat
   Lee la plantilla de Scribus (.sla), la dibuja en pantalla y permite cambiar
   los textos de varios carteles y descargarlos en PDF (A3, A4 o A5). */
(() => {
'use strict';
const PLANTILLA_URL = 'plantilla/PREC_PROF_FOND_LINEAL_NORMAL_DECIMAL_A4_9999.sla';
const PLANTILLA_JS = 'assets/js/plantilla-embebida.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null) e.setAttribute(k, v); } kids.flat().forEach(k => k != null && e.append(k)); return e; };
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r2 = n => Math.round(n * 100) / 100;

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
// Cuadros editables de la plantilla (por ItemID de Scribus).
// El símbolo €, el texto legal y el cuadro vacío quedan fijos y no aparecen aquí.
// "ph" es el texto de relleno que se ve mientras el campo está vacío.
const FIELDS = {
  '210023872': { label: 'Descripción del producto', order: 1, ph: 'XXX XXXX' },
  '210029536': { label: 'Características técnicas', order: 2, ph: 'XXX XXXX' },
  '210639376': { label: 'Precio · euros', order: 3, price: 'int', ph: 'XX' },
  '210018208': { label: 'Precio · céntimos', order: 4, price: 'dec', ph: '‘XX' },
  '211134976': { label: 'Precio por unidad', order: 5, ph: 'XXX' },
  '211129312': { label: 'Referencia', order: 6, ph: 'Ref. XXXXXXXX', ref: true, allcaps: false }
};
// Desplazamiento vertical (pt) de algunos elementos respecto a la plantilla original:
// el precio por unidad y su recuadro negro bajan para no chocar con el símbolo €.
const MOVE_Y = { '211134976': 14, '244128320': 14, '211123648': 14 };
const PAPER = { A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28] };
const STORE_KEY = 'carteles-precio-v1';

const S = { page: null, colors: {}, items: [], fields: [], edit: [], uploadedFonts: {}, fontSubs: {}, sel: null, zoom: 100, carteles: [], cur: 0 };

// ---------- utilidades ----------
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); }
function b64ToBytes(b64) { const bin = atob(b64.replace(/\s+/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64(u8) { let s = ''; const C = 0x8000; for (let i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C)); return btoa(s); }
const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
function colorToHex(c) {
  const sp = c.getAttribute('SPACE');
  if (sp === 'RGB') return '#' + hex2(num(c.getAttribute('R'))) + hex2(num(c.getAttribute('G'))) + hex2(num(c.getAttribute('B')));
  if (sp === 'CMYK') { const C = num(c.getAttribute('C')) / 100, M = num(c.getAttribute('M')) / 100, Y = num(c.getAttribute('Y')) / 100, K = num(c.getAttribute('K')) / 100; return '#' + hex2(255 * (1 - C) * (1 - K)) + hex2(255 * (1 - M) * (1 - K)) + hex2(255 * (1 - Y) * (1 - K)); }
  return c.getAttribute('RGB') || '#000000';
}
const colHex = name => (!name || name === 'None') ? null : (S.colors[name] || '#000000');
const STYLE_WORDS = /\s+(Regular|Normal|Book|Roman|Medium|Bold|Semibold|SemiBold|Black|Heavy|Light|Thin|ExtraBold|Italic|Oblique)$/i;
function fontInfo(scName) {
  let fam = (scName || 'Arial Regular').trim(), weight = 400, style = 'normal', m;
  while ((m = fam.match(STYLE_WORDS))) { const w = m[1].toLowerCase(); if (w.includes('bold') || w === 'heavy') weight = 700; if (w === 'black') weight = 900; if (w === 'light') weight = 300; if (w.includes('italic') || w === 'oblique') style = 'italic'; fam = fam.slice(0, m.index); }
  return { family: fam, weight, style };
}
function fontStack(scName) {
  const { family } = fontInfo(scName), sub = S.fontSubs[family];
  const generic = /arial|helvetica/i.test(family) ? 'Arial, Helvetica, "Liberation Sans", sans-serif' : 'sans-serif';
  return `"${family}"` + (sub ? `, "${sub}"` : '') + ', ' + generic;
}
const measureCtx = document.createElement('canvas').getContext('2d');
function fontAvailable(family) {
  if (S.uploadedFonts[family]) return true;
  const t = 'mmmmmmmmmmlliWW@#0';
  return ['monospace', 'serif'].some(g => { measureCtx.font = `40px ${g}`; const a = measureCtx.measureText(t).width; measureCtx.font = `40px "${family}", ${g}`; return Math.abs(measureCtx.measureText(t).width - a) > 0.5; });
}

// ---------- carga de la plantilla ----------
async function getTemplateText() {
  if (window.PLANTILLA_B64) return new TextDecoder().decode(b64ToBytes(window.PLANTILLA_B64));
  try { const r = await fetch(PLANTILLA_URL, { cache: 'no-cache' }); if (r.ok) return await r.text(); } catch (_) { /* p. ej. abierto con file:// */ }
  await new Promise((res, rej) => { const s = el('script', { src: PLANTILLA_JS }); s.onload = res; s.onerror = rej; document.head.append(s); });
  return new TextDecoder().decode(b64ToBytes(window.PLANTILLA_B64));
}
async function loadTemplate(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const D = doc.querySelector('DOCUMENT'); if (!D) throw new Error('La plantilla está dañada.');
  for (const c of D.children) if (c.tagName === 'COLOR') S.colors[c.getAttribute('NAME')] = colorToHex(c);
  const cs = [...D.children].find(c => c.tagName === 'CHARSTYLE' && c.getAttribute('DefaultStyle') === '1');
  S.defCS = { FONT: cs?.getAttribute('FONT') || 'Arial Regular', FONTSIZE: cs?.getAttribute('FONTSIZE') || '12', FCOLOR: cs?.getAttribute('FCOLOR') || 'Black', FEATURES: cs?.getAttribute('FEATURES') || '' };
  const p = [...D.children].find(c => c.tagName === 'PAGE');
  S.page = { x: num(p.getAttribute('PAGEXPOS')), y: num(p.getAttribute('PAGEYPOS')), w: num(p.getAttribute('PAGEWIDTH')), h: num(p.getAttribute('PAGEHEIGHT')) };
  const jobs = [];
  const walk = (o, x, y) => {
    const a = n => o.getAttribute(n), t = a('PTYPE');
    const base = { id: a('ItemID'), x, y: y + (MOVE_Y[a('ItemID')] || 0), w: num(a('WIDTH')), h: num(a('HEIGHT')), rot: num(a('ROT')), fill: a('PCOLOR') && a('PCOLOR') !== 'None' ? a('PCOLOR') : null };
    if (t === '12') { for (const ch of o.children) if (ch.tagName === 'PAGEOBJECT') walk(ch, x + num(ch.getAttribute('gXpos')), y + num(ch.getAttribute('gYpos'))); return; }
    if (t === '4') { const f = parseText(base, o); S.items.push(f); S.fields.push(f); return; }
    if (t === '2') {
      const im = Object.assign(base, { kind: 'image', scx: num(a('LOCALSCX'), 1), scy: num(a('LOCALSCY'), 1), lx: num(a('LOCALX')), ly: num(a('LOCALY')), src: null });
      if (a('ImageData')) jobs.push(decodeInline(a('ImageData'), a('inlineImageExt') || 'jpg').then(u => im.src = u).catch(() => {}));
      S.items.push(im); return;
    }
    S.items.push(Object.assign(base, { kind: 'shape', path: a('path') || `M0 0 L${base.w} 0 L${base.w} ${base.h} L0 ${base.h} Z`, fillHex: colHex(base.fill), stroke: a('PCOLOR2') && a('PCOLOR2') !== 'None' ? a('PCOLOR2') : null, sw: num(a('PWIDTH'), 1) }));
  };
  for (const o of D.children) if (o.tagName === 'PAGEOBJECT' && num(o.getAttribute('OwnPage'), -1) === 0) walk(o, num(o.getAttribute('XPOS')) - S.page.x, num(o.getAttribute('YPOS')) - S.page.y);
  await Promise.all(jobs);
  S.edit = S.fields.filter(f => FIELDS[f.id]).sort((p, q) => FIELDS[p.id].order - FIELDS[q.id].order);
  // Los campos editables empiezan vacíos y muestran su texto de relleno (XXX)
  S.edit.forEach(f => { Object.assign(f, FIELDS[f.id], { editable: true }); f.tplParas = [...f.orig.paras]; f.orig.paras = ['']; f.paras = ['']; });
  S.intField = S.edit.find(f => f.price === 'int'); S.decField = S.edit.find(f => f.price === 'dec');
  for (const fam of new Set(S.fields.map(f => fontInfo(f.font).family))) if (!fontAvailable(fam) && !/arial|helvetica/i.test(fam)) S.fontSubs[fam] = 'Permanent Marker';
}
async function decodeInline(b64, ext) {
  // Imagen incrustada por Scribus: 4 bytes de longitud + datos zlib
  const raw = b64ToBytes(b64).subarray(4);
  const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'));
  const data = new Uint8Array(await new Response(s).arrayBuffer());
  return URL.createObjectURL(new Blob([data], { type: /png/i.test(ext) ? 'image/png' : 'image/jpeg' }));
}
function parseText(base, o) {
  const st = [...o.children].find(c => c.tagName === 'StoryText'), kids = st ? [...st.children] : [];
  const def = kids.find(k => k.tagName === 'DefaultStyle');
  let ch0 = null, para0 = null; const paras = [''];
  for (const k of kids) {
    const tg = k.tagName;
    if (tg === 'ITEXT') { if (!ch0 && k.getAttribute('FONT')) ch0 = k; let txt = k.getAttribute('CH') || ''; if (/superscript/.test(k.getAttribute('FEATURES') || '')) txt = txt.replace(/[0-9]/g, d => SUP[d]); paras[paras.length - 1] += txt; }
    else if (tg === 'para') { para0 = para0 || k; paras.push(''); }
    else if (tg === 'trail') para0 = para0 || k;
    else if (tg === 'breakline') paras.push('');
    else if (tg === 'tab') paras[paras.length - 1] += '\t';
  }
  if (paras.length > 1 && paras[paras.length - 1] === '') paras.pop();
  const ga = (n, d) => ch0?.getAttribute(n) ?? def?.getAttribute(n) ?? S.defCS[n] ?? d;
  const pa = (n, d) => para0?.getAttribute(n) ?? def?.getAttribute(n) ?? d;
  const a = n => o.getAttribute(n);
  const f = Object.assign(base, {
    kind: 'text', font: ga('FONT', 'Arial Regular'), size: num(ga('FONTSIZE', '12'), 12), features: ga('FEATURES', ''),
    align: num(pa('ALIGN', '0')), lsMode: num(pa('LINESPMode', '0')), ls: num(pa('LINESP', '15'), 15), vor: num(pa('VOR', '0')),
    valign: num(a('VAlign')), ins: { l: num(a('EXTRA')), t: num(a('TEXTRA')), b: num(a('BEXTRA')), r: num(a('REXTRA')) }, paras
  });
  f.color = colHex(ga('FCOLOR', 'Black')) || '#000000';
  f.allcaps = /allcaps/.test(f.features);
  f.orig = { paras: [...paras], size: f.size, ls: f.ls };
  return f;
}

// ---------- carteles ----------
const blankValues = () => Object.fromEntries(S.edit.map(f => [f.id, JSON.parse(JSON.stringify(f.orig))]));
const curValues = () => S.carteles[S.cur].values;
function applyValues(v) { for (const f of S.edit) { const x = v[f.id] || f.orig; f.paras = [...x.paras]; f.size = f.orig.size; f.ls = f.orig.ls; } }
function storeField(f) { curValues()[f.id] = { paras: [...f.paras], size: f.size, ls: f.ls }; }
function cartelTitle(c) { const d = c.values['210023872']?.paras.filter(Boolean).join(' ').trim(); return d || 'Sin descripción'; }
function cartelPrice(c) { if (!S.intField || !S.decField) return ''; const i = c.values[S.intField.id]?.paras.join('').trim(), d = c.values[S.decField.id]?.paras.join('').replace(/^\D*/, ''); return i ? `${i}${d ? ',' + d : ''} €` : ''; }

function switchTo(i) {
  S.cur = Math.max(0, Math.min(i, S.carteles.length - 1)); applyValues(curValues()); S.sel = null;
  S.fields.forEach(updateFieldEl); renderCards(); renderQuick(); renderNav(); resetDel(); saveDraft();
}
$('#btnNew').onclick = () => { S.carteles.push({ values: blankValues() }); switchTo(S.carteles.length - 1); toast('Cartel nuevo añadido'); };
$('#btnDup').onclick = () => { S.carteles.splice(S.cur + 1, 0, { values: JSON.parse(JSON.stringify(curValues())) }); switchTo(S.cur + 1); toast('Cartel duplicado'); };
function askDel() {
  if (S.carteles.length < 2) return toast('Debe quedar al menos un cartel.');
  const row = $('#delRow'); row.innerHTML = '';
  row.append(el('div', { class: 'confirm' }, el('span', { text: `¿Eliminar el cartel ${S.cur + 1}?` }),
    el('button', { class: 'btn inline sm danger', type: 'button', text: 'Sí, eliminar', onclick: () => { S.carteles.splice(S.cur, 1); switchTo(S.cur); toast('Cartel eliminado'); } }),
    el('button', { class: 'btn inline sm', type: 'button', text: 'Cancelar', onclick: resetDel })));
}
function resetDel() { const row = $('#delRow'); row.innerHTML = ''; row.append(el('button', { class: 'btn', id: 'btnDel', type: 'button', text: 'Eliminar este cartel', onclick: askDel })); }
$('#btnDel').onclick = askDel;

function renderNav() {
  const sel = $('#sel'); sel.innerHTML = '';
  S.carteles.forEach((c, i) => { const pr = cartelPrice(c); sel.append(el('option', { value: i, text: `${i + 1} · ${cartelTitle(c)}${pr ? ' — ' + pr : ''}` })); });
  sel.value = S.cur;
  $('#prev').disabled = S.cur === 0; $('#next').disabled = S.cur >= S.carteles.length - 1;
  $('#btnPdfAll').textContent = `Descargar PDF de todos (${S.carteles.length})`;
}
$('#sel').onchange = e => switchTo(+e.target.value);
$('#prev').onclick = () => switchTo(S.cur - 1);
$('#next').onclick = () => switchTo(S.cur + 1);

// ---------- dibujo del cartel ----------
function renderPoster() {
  const P = $('#poster'); P.innerHTML = ''; P.style.width = S.page.w + 'px'; P.style.height = S.page.h + 'px';
  for (const it of S.items) {
    const d = el('div', { class: 'obj' });
    d.style.cssText = `left:${it.x}px;top:${it.y}px;width:${it.w}px;height:${it.h}px;` + (it.rot ? `transform:rotate(${it.rot}deg);` : '');
    it.el = d;
    if (it.kind === 'image') { d.classList.add('img'); if (it.src) { const im = el('img', { src: it.src, alt: '' }); im.style.transform = `translate(${it.lx * it.scx}px,${it.ly * it.scy}px) scale(${it.scx},${it.scy})`; d.append(im); } }
    else if (it.kind === 'shape') {
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', it.w); svg.setAttribute('height', it.h); svg.setAttribute('viewBox', `0 0 ${it.w} ${it.h}`); svg.style.overflow = 'visible';
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', it.path); p.setAttribute('fill', it.fillHex || 'none');
      if (it.stroke) { p.setAttribute('stroke', colHex(it.stroke)); p.setAttribute('stroke-width', it.sw); } svg.append(p); d.append(svg);
    } else {
      d.classList.add('tf'); d.append(el('div', { class: 'txt' }));
      if (it.editable) { d.classList.add('ed'); d.addEventListener('click', () => select(it, true)); }
    }
    P.append(d);
  }
  S.fields.forEach(updateFieldEl);
}
function lineMetrics(f) {
  const fi = fontInfo(f.font);
  measureCtx.font = `${fi.style} ${fi.weight} ${f.size}px ${fontStack(f.font)}`;
  const m = measureCtx.measureText('ÁHgjpÉ');
  let asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  if (!asc) { asc = f.size * 0.9; desc = f.size * 0.22; }
  return { asc, desc };
}
// El usuario no cambia tamaños: el precio se reduce solo si el número no cabe en su cuadro.
function updateFieldEl(f) {
  if (!f.price) return drawField(f);
  f.size = f.orig.size; f.ls = f.orig.ls; shrinkToFit(f);
}
const refText = f => { const d = f.paras.join('').replace(/\D/g, '').slice(-8); return d ? 'Ref. ' + d.padStart(8, '0') : ''; };
function drawField(f) {
  const d = f.el; if (!d) return;
  const fi = fontInfo(f.font), { asc, desc } = lineMetrics(f);
  // Interlineado fijo de Scribus: la primera línea apoya su base a la altura del ascendente
  const auto = f.lsMode !== 0, L = auto ? asc + desc : f.ls, shift = auto ? 0 : (asc + desc - L) / 2;
  d.style.background = f.fill ? colHex(f.fill) : '';
  d.style.padding = `${f.ins.t}px ${f.ins.r}px ${f.ins.b}px ${f.ins.l}px`;
  d.style.justifyContent = ['flex-start', 'center', 'flex-end'][f.valign] || 'flex-start';
  const T = d.firstChild;
  T.style.cssText = `top:${shift}px;font-family:${fontStack(f.font)};font-weight:${fi.weight};font-style:${fi.style};font-size:${f.size}px;line-height:${L}px;color:${f.color};text-transform:${f.allcaps ? 'uppercase' : 'none'};text-align:${['left', 'center', 'right', 'justify', 'justify'][f.align] || 'left'}`;
  const isPh = f.editable && !(f.ref ? refText(f) : f.paras.join('').trim()), shown = isPh ? [f.ph] : f.ref ? [refText(f)] : f.paras;
  T.replaceChildren(...shown.map((p, i) => { const pe = el('div', { class: 'p' }); pe.textContent = p || '\u200b'; if (isPh) pe.style.whiteSpace = 'nowrap'; if (i > 0 && f.vor) pe.style.marginTop = f.vor + 'px'; return pe; }));
  // El texto de relleno (XXX) se reduce para que quepa en una línea, solo en pantalla y PDF
  if (isPh && T.scrollWidth > T.clientWidth + 1) T.style.fontSize = (f.size * T.clientWidth / T.scrollWidth * 0.98) + 'px';
  const over = f.editable && !isPh && ((T.scrollHeight + shift - L * 0.4 > f.h - f.ins.t - f.ins.b + 1) || (T.scrollWidth > T.clientWidth + 1) || (f.price && T.offsetHeight > L * shown.length * 1.05 + 1));
  f.over = over; d.classList.toggle('over', !!over); d.classList.toggle('sel', S.sel === f);
}

// ---------- panel de textos ----------
function renderCards() {
  const C = $('#cards'); C.innerHTML = '';
  for (const f of S.edit) {
    let ta;
    if (f.ref) {
      ta = el('input', { id: 'ta-' + f.id, type: 'text', inputmode: 'numeric', maxlength: 8, autocomplete: 'off', placeholder: '8 dígitos, ej. 12345678', class: 'refin' });
      ta.value = f.paras.join('').replace(/\D/g, '');
      ta.addEventListener('input', () => { const v = ta.value.replace(/\D/g, '').slice(0, 8); if (v !== ta.value) ta.value = v; f.paras = [v]; changed(f); });
    } else {
      ta = el('textarea', { id: 'ta-' + f.id, rows: Math.max(1, f.paras.length), spellcheck: 'true', placeholder: f.ph });
      ta.value = f.paras.join('\n');
      ta.addEventListener('input', () => { f.paras = ta.value.split('\n'); ta.rows = Math.max(1, f.paras.length); changed(f); });
    }
    ta.addEventListener('focus', () => select(f, false));
    const card = el('div', { class: 'field' + (S.sel === f ? ' sel' : ''), id: 'card-' + f.id },
      el('div', { class: 'head' }, el('label', { class: 'name', for: 'ta-' + f.id, text: f.label })), ta);
    if (f.ref) card.append(el('p', { class: 'note', style: 'margin:0', text: 'Si tiene menos de 8 cifras se completa con ceros a la izquierda. En el cartel aparece como “Ref. 00012345”.' }));
    f.card = card; C.append(card);
  }
}
let navT;
function changed(f) { updateFieldEl(f); storeField(f); if (f.price) renderQuick(true); clearTimeout(navT); navT = setTimeout(renderNav, 300); saveDraft(); }
function select(f, scroll) {
  S.sel = f;
  document.querySelectorAll('.poster .tf.sel').forEach(e => e.classList.remove('sel')); f.el?.classList.add('sel');
  document.querySelectorAll('.field.sel').forEach(e => e.classList.remove('sel')); f.card?.classList.add('sel');
  if (scroll && f.card) { f.card.scrollIntoView({ block: 'center', behavior: 'smooth' }); f.card.querySelector('textarea, input').focus({ preventScroll: true }); }
}
function shrinkToFit(f) { let g = 0; drawField(f); while (f.over && f.size > 4 && g++ < 200) { f.size = r2(f.size * 0.97); if (f.lsMode === 0) f.ls = r2(f.ls * 0.97); drawField(f); } }

function renderQuick(fromField) {
  const sec = $('#secQuick'), q = $('#quickPrice');
  sec.hidden = !(S.intField && S.decField); if (sec.hidden) return;
  const dec = S.decField.paras.join('').replace(/^\D*/, '');
  if (!fromField || document.activeElement !== q) q.value = S.intField.paras.join('').trim() + (dec ? ',' + dec : '');
}
$('#quickPrice').addEventListener('input', e => {
  const v = e.target.value.trim(), m = v.match(/^(\d*)(?:[.,'‘’](\d*))?$/); if (!m) return;
  const I = S.intField, Dc = S.decField, pre = (Dc.tplParas.join('').match(/^\D*/) || [''])[0];
  if (!v) { I.paras = ['']; Dc.paras = ['']; }
  else { I.paras = [m[1] || '0']; Dc.paras = [pre + ((m[2] || '') + '00').slice(0, 2)]; }
  [I, Dc].forEach(f => { updateFieldEl(f); storeField(f); const ta = f.card?.querySelector('textarea'); if (ta) ta.value = f.paras.join('\n'); });
  clearTimeout(navT); navT = setTimeout(renderNav, 300); saveDraft();
});

// ---------- fuente ----------
function renderFonts() {
  const box = $('#fonts'); box.innerHTML = '';
  const fams = [...new Set(S.fields.map(f => fontInfo(f.font).family))].filter(f => !/arial|helvetica/i.test(f));
  for (const fam of fams) {
    const ok = fontAvailable(fam);
    box.append(el('div', { class: 'fontbox' },
      el('b', { text: 'Fuente “' + fam + '”' }),
      el('span', { class: 'note', style: 'margin:0', text: S.uploadedFonts[fam] ? 'Cargada desde archivo: el cartel se ve con la fuente real.' : ok ? 'Instalada en este equipo.' : 'No está instalada en este equipo y se muestra una parecida. Sube el archivo .ttf u .otf para ver y descargar el cartel con la fuente real.' }),
      el('button', { class: 'btn', type: 'button', text: 'Subir archivo de fuente', onclick: () => { S.fontTarget = fam; $('#fileFont').value = ''; $('#fileFont').click(); } })));
  }
}
$('#fileFont').addEventListener('change', async e => {
  const file = e.target.files[0], fam = S.fontTarget; if (!file || !fam) return;
  try { const buf = await file.arrayBuffer(); await registerFont(fam, buf); try { localStorage.setItem('cartel-font:' + fam, bytesToB64(new Uint8Array(buf))); } catch (_) {} toast('Fuente “' + fam + '” cargada'); }
  catch (_) { toast('Ese archivo de fuente no se pudo usar.'); }
});
async function registerFont(fam, buf) { const ff = new FontFace(fam, buf); await ff.load(); document.fonts.add(ff); S.uploadedFonts[fam] = true; S.fields.forEach(updateFieldEl); renderFonts(); }
function restoreFonts() { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('cartel-font:')) registerFont(k.slice(12), b64ToBytes(localStorage.getItem(k)).buffer).catch(() => {}); } } catch (_) {} }

// ---------- zoom ----------
function applyZoom() {
  const desk = $('#desk');
  const aw = desk.clientWidth - 40, ah = window.innerWidth > 900 ? window.innerHeight - 240 : Infinity;
  const fit = Math.max(0.15, Math.min(aw / S.page.w, ah / S.page.h));
  const s = fit * S.zoom / 100;
  $('#poster').style.transform = `scale(${s})`;
  const w = $('#sheetwrap'); w.style.width = S.page.w * s + 'px'; w.style.height = S.page.h * s + 'px';
}
$('#zoom').addEventListener('input', e => { S.zoom = +e.target.value; applyZoom(); });
window.addEventListener('resize', applyZoom);

// ---------- guardado en el navegador ----------
let saveT;
function saveDraft() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ carteles: S.carteles, cur: S.cur, size: $('#pdfSize').value })); } catch (_) {} }, 400); }
$('#pdfSize').onchange = saveDraft;

// ---------- PDF ----------
async function saveFile(filename, blob) {
  let dl = null; // dentro de claude.ai se usa su descarga; en cualquier otra web, un enlace normal
  try { dl = window.claude?.use ? await window.claude.use('downloads') : null; } catch (_) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: blob }); toast('Descargado: ' + filename); }
    catch (e) { if (e?.code !== 'declined') toast('No se pudo descargar (' + (e?.code || 'error') + ').'); }
    return;
  }
  const url = URL.createObjectURL(blob), a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Descargado: ' + filename);
}
async function renderCanvas(scale) {
  if (!window.html2canvas) throw new Error('No se cargó el generador de PDF. Recarga la página.');
  const host = el('div'); host.style.cssText = `position:fixed;left:-30000px;top:0;width:${S.page.w}px;height:${S.page.h}px;`;
  const clone = $('#poster').cloneNode(true); clone.removeAttribute('id'); clone.style.transform = 'none';
  host.append(clone); document.body.append(host);
  try { return await html2canvas(clone, { scale, backgroundColor: '#ffffff', logging: false, width: S.page.w, height: S.page.h }); }
  finally { host.remove(); }
}
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cartel';
async function makePdf(indices, btn) {
  const fmt = $('#pdfSize').value, [W, H] = PAPER[fmt];
  const scale = (W / S.page.w) * (300 / 72); // unos 300 ppp en el papel elegido
  const { jsPDF } = window.jspdf || {}; if (!jsPDF) throw new Error('No se cargó el generador de PDF. Recarga la página.');
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: [W, H], compress: true });
  const keep = S.cur, label = btn.textContent;
  if (document.fonts) await document.fonts.ready;
  try {
    for (let n = 0; n < indices.length; n++) {
      btn.textContent = indices.length > 1 ? `Generando ${n + 1} de ${indices.length}…` : 'Generando…';
      applyValues(S.carteles[indices[n]].values); S.fields.forEach(updateFieldEl);
      const cv = await renderCanvas(scale);
      if (n) pdf.addPage([W, H], 'p');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H, undefined, 'FAST');
    }
  } finally { applyValues(S.carteles[keep].values); S.fields.forEach(updateFieldEl); btn.textContent = label; }
  const name = indices.length > 1 ? `carteles_${indices.length}_${fmt}.pdf` : `cartel_${slug(cartelTitle(S.carteles[indices[0]]))}_${fmt}.pdf`;
  await saveFile(name, pdf.output('blob'));
}
async function busy(fn) { const bs = [...document.querySelectorAll('.bar .btn')]; bs.forEach(b => b.disabled = true); try { await fn(); } catch (e) { toast(e.message || 'No se pudo generar el PDF.'); } finally { bs.forEach(b => b.disabled = false); renderNav(); } }
$('#btnPdfOne').onclick = e => { const b = e.currentTarget; busy(() => makePdf([S.cur], b)); };
$('#btnPdfAll').onclick = e => { const b = e.currentTarget; busy(() => makePdf(S.carteles.map((_, i) => i), b)); };

// ---------- arranque ----------
(async () => {
  try {
    await loadTemplate(await getTemplateText());
    let draft = null; try { draft = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) {}
    if (draft?.carteles?.length) { S.carteles = draft.carteles; S.cur = Math.min(draft.cur || 0, draft.carteles.length - 1); if (PAPER[draft.size]) $('#pdfSize').value = draft.size; }
    else S.carteles = [{ values: blankValues() }];
    // Carteles guardados con los textos de ejemplo antiguos: se vacían para que muestren XXX
    for (const c of S.carteles) for (const f of S.edit) { const v = c.values[f.id]; if (v && JSON.stringify(v.paras) === JSON.stringify(f.tplParas)) v.paras = ['']; if (v && f.ref) v.paras = [v.paras.join('').replace(/\D/g, '').slice(-8)]; }
    applyValues(curValues());
    $('#loading').hidden = true;
    renderPoster(); renderCards(); renderQuick(); renderNav(); renderFonts(); applyZoom();
    if (document.fonts) document.fonts.ready.then(() => S.fields.forEach(updateFieldEl));
    restoreFonts();
  } catch (e) { $('#loading').textContent = 'No se pudo cargar la plantilla.'; toast(e.message || 'No se pudo cargar la plantilla.'); }
})();
})();
