// Câblage DOM. Lit les inputs, appelle Time/Numi, affiche. Calcul en direct. Bilingue FR/EN.
'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --- i18n ---
const T = {
  fr: {
    title: 'Calculateur de temps', mode_expr: 'Expression', mode_form: 'Formulaire',
    tab_ecart: 'Écart', tab_conv: 'Conversion', tab_arith: 'Arithmétique',
    f_start: 'Début', f_end: 'Fin', f_value: 'Valeur', f_unit: 'Unité', f_op: 'Opération', f_num: 'Nombre',
    durA: 'Durée A', durB: 'Durée B', u_d: 'j', u_h: 'h', u_min: 'min', u_s: 's',
    unit_s: 'secondes', unit_min: 'minutes', unit_h: 'heures', unit_day: 'jours', unit_week: 'semaines', unit_month: 'mois', unit_year: 'années',
    op_add: 'A + B (durée)', op_sub: 'A − B (durée)', op_mul: 'A × n (nombre)', op_divn: 'A ÷ n (nombre)', op_divd: 'A ÷ B = ratio (durée)',
    share: 'Copier le lien', aria_lang: 'Langue', aria_theme: 'Changer le thème', aria_mode: 'Mode de saisie',
    theme_auto: 'Auto', theme_light: 'Clair', theme_dark: 'Sombre',
    pick_dates: 'Choisis deux dates.', enter_value: 'Entre une valeur.', end_before: ' (fin avant début)',
    copied: 'Copié', link_copied: 'Lien copié', copy_fail: 'Copie impossible', click_copy: 'Cliquer pour copier',
    note_conv: `Mois et années sont approximatifs ici (mois ≈ 30 j, an ≈ 365 j) : une durée brute n'a pas de calendrier.`,
    note_numi: `Une ligne = un calcul. Dates en <b>j/m/a</b>. Unités : s, min, h, j, sem, mois, an. Convertir : <code>-&gt;</code>, <code>=</code> ou <code>in</code> (ex. <code>1h -&gt; min</code>). Dates : <code>date - date</code>, <code>date + 1mois</code>, <code>today</code>, <code>tomorrow</code>, <code>hier</code>. Parenthèses OK. Variables : <code>x = 2h</code> puis <code>x</code> ; références <code>prev</code>, <code>total</code>. Formats date : <code>2026-06-29</code>, <code>15 jan 2026</code>. Fonctions : <code>weekday(date)</code>, <code>joursouvres(d1, d2)</code>, <code>ajoutouvres(date, n)</code>. Clique un résultat pour le copier.`,
  },
  en: {
    title: 'Time calculator', mode_expr: 'Expression', mode_form: 'Form',
    tab_ecart: 'Diff', tab_conv: 'Conversion', tab_arith: 'Arithmetic',
    f_start: 'Start', f_end: 'End', f_value: 'Value', f_unit: 'Unit', f_op: 'Operation', f_num: 'Number',
    durA: 'Duration A', durB: 'Duration B', u_d: 'd', u_h: 'h', u_min: 'min', u_s: 's',
    unit_s: 'seconds', unit_min: 'minutes', unit_h: 'hours', unit_day: 'days', unit_week: 'weeks', unit_month: 'months', unit_year: 'years',
    op_add: 'A + B (duration)', op_sub: 'A − B (duration)', op_mul: 'A × n (number)', op_divn: 'A ÷ n (number)', op_divd: 'A ÷ B = ratio (duration)',
    share: 'Copy link', aria_lang: 'Language', aria_theme: 'Toggle theme', aria_mode: 'Input mode',
    theme_auto: 'Auto', theme_light: 'Light', theme_dark: 'Dark',
    pick_dates: 'Pick two dates.', enter_value: 'Enter a value.', end_before: ' (end before start)',
    copied: 'Copied', link_copied: 'Link copied', copy_fail: 'Copy failed', click_copy: 'Click to copy',
    note_conv: `Months and years are approximate here (month ≈ 30 d, year ≈ 365 d): a raw duration has no calendar.`,
    note_numi: `One line = one calculation. Dates as <b>d/m/y</b>. Units: s, min, h, d, wk, mo, yr. Convert with <code>-&gt;</code>, <code>=</code> or <code>in</code> (e.g. <code>1h -&gt; min</code>). Dates: <code>date - date</code>, <code>date + 1mo</code>, <code>today</code>, <code>tomorrow</code>, <code>yesterday</code>. Parentheses OK. Variables: <code>x = 2h</code> then <code>x</code>; refs <code>prev</code>, <code>total</code>. Date formats: <code>2026-06-29</code>, <code>15 jan 2026</code>. Functions: <code>weekday(date)</code>, <code>businessdays(d1, d2)</code>, <code>addbusinessdays(date, n)</code>. Click a result to copy.`,
  },
};
const UNITS = {
  fr: { s: 'secondes', min: 'minutes', h: 'heures', day: 'jours', week: 'semaines', month: 'mois', year: 'années' },
  en: { s: 'seconds', min: 'minutes', h: 'hours', day: 'days', week: 'weeks', month: 'months', year: 'years' },
};
const SHORT = {
  fr: { y: 'an', ys: 'ans', mo: 'mois', d: 'j', h: 'h', min: 'min', s: 's' },
  en: { y: 'yr', ys: 'yr', mo: 'mo', d: 'd', h: 'h', min: 'min', s: 's' },
};
const WD = {
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

let lang;
try { lang = localStorage.getItem('lang'); } catch (e) {}
if (!lang) lang = (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
const t = (key) => (T[lang] || T.fr)[key] || key;
let nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 2 });

// --- Animations (natives, coupées si l'utilisateur réduit le mouvement) ---
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function withViewTransition(apply) {
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(apply);
  else apply();
}
const setSeg = (container, i) => container.style.setProperty('--i', i);

// --- Formatage (dépend de la langue) ---
function fmtDuration(seconds) {
  const n = Time.normalize(seconds), S = SHORT[lang], parts = [];
  if (n.days) parts.push(n.days + ' ' + S.d);
  if (n.hours) parts.push(n.hours + ' ' + S.h);
  if (n.minutes) parts.push(n.minutes + ' ' + S.min);
  if (n.seconds || parts.length === 0) parts.push(n.seconds + ' ' + S.s);
  return parts.join(' ');
}
// Décomposition années/mois/j/h/min/s -> texte. sep = ' ' (compact) ou ', ' (écart).
function fmtParts(b, sep) {
  const S = SHORT[lang];
  return [
    b.years && b.years + ' ' + (b.years > 1 ? S.ys : S.y),
    b.months && b.months + ' ' + S.mo,
    b.days && b.days + ' ' + S.d,
    b.hours && b.hours + ' ' + S.h,
    b.minutes && b.minutes + ' ' + S.min,
    b.seconds && b.seconds + ' ' + S.s,
  ].filter(Boolean).join(sep) || ('0 ' + S.s);
}

function formatResult(r) {
  if (!r) return '';
  if (r.type === 'weekday') return WD[lang][r.day];
  if (r.type === 'text') return r.text;
  if (r.type === 'date') {
    const d = r.date, pad = (n) => String(n).padStart(2, '0');
    let s = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    if (d.getHours() || d.getMinutes() || d.getSeconds()) s += ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    return s;
  }
  if (r.type === 'number') return nf.format(r.value);
  if (r.target) {
    if (r.target === 'year' || r.target === 'month') return fmtParts(Time.breakdown(r.seconds, r.target), ' ');
    return nf.format(r.seconds / Time.UNIT_SECONDS[r.target]) + ' ' + UNITS[lang][r.target];
  }
  if (r.fromDates) return fmtParts(Time.diffCalendar(r.start, r.end), ', ');
  return fmtDuration(r.seconds);
}

// --- Bascule de mode (Expression / Formulaire) ---
const modesBar = $('.modes');
$$('.mode').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    setSeg(modesBar, i);
    withViewTransition(() => {
      $$('.mode').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      $('#numi').hidden = btn.dataset.mode !== 'numi';
      $('#form').hidden = btn.dataset.mode !== 'form';
    });
  });
});

// --- Mode Expression (Numi) ---
const nmInput = $('#nm-input'), nmOut = $('#nm-out');
const DEFAULT_NUMI = '1/1/2000 - 1/6/1990\n1h -> s\n1h + 30min\n3h / 30min';

function renderNumi() {
  const lines = Numi.evaluateAll(nmInput.value).map((res) => {
    const div = document.createElement('div');
    div.className = 'rline';
    if (res.error !== undefined) { div.textContent = '! ' + res.error; div.classList.add('rerr'); return div; }
    if (res.result == null) { div.textContent = ' '; return div; }
    const txt = formatResult(res.result);
    div.textContent = (res.assignedTo ? res.assignedTo + ' = ' : '= ') + txt;
    div.dataset.copy = txt;
    div.title = t('click_copy');
    return div;
  });
  nmOut.replaceChildren(...lines);
}
nmInput.addEventListener('input', () => { renderNumi(); persist(); });

// Persistance (localStorage) + permalien (#hash). Chargement : hash > localStorage > défaut.
function persist() {
  const v = nmInput.value;
  try { localStorage.setItem('numi', v); } catch (e) {}
  history.replaceState(null, '', v ? '#' + encodeURIComponent(v) : location.pathname + location.search);
}
function loadInitial() {
  let v = '';
  if (location.hash.length > 1) { try { v = decodeURIComponent(location.hash.slice(1)); } catch (e) {} }
  if (!v) { try { v = localStorage.getItem('numi') || ''; } catch (e) {} }
  nmInput.value = v || DEFAULT_NUMI;
}

// --- Onglets ---
const tabsBar = $('.tabs');
$$('.tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    setSeg(tabsBar, i);
    withViewTransition(() => {
      $$('.tab').forEach((t2) => t2.setAttribute('aria-selected', String(t2 === tab)));
      $$('.panel').forEach((p) => { p.hidden = p.id !== tab.dataset.tab; });
    });
  });
});

// --- Onglet 1 : écart de dates ---
function renderEcart() {
  const out = $('#ec-result');
  const s = $('#ec-start').value, e = $('#ec-end').value;
  if (!s || !e) { out.textContent = t('pick_dates'); return; }
  const start = new Date(s), end = new Date(e);
  const d = Time.diffCalendar(start, end);
  const tot = Time.diffTotals(start, end);
  const sens = d.sign < 0 ? t('end_before') : '';
  const cal = fmtParts(d, ', ');
  const U = UNITS[lang];
  const tot4 = (val, label) => `<span data-copy="${nf.format(val)} ${label}">= ${nf.format(val)} ${label}</span>`;
  out.innerHTML =
    `<div class="big" data-copy="${cal}">${cal}${sens}</div>` +
    `<div class="totals">` +
    tot4(tot.days, U.day) + tot4(tot.hours, U.h) +
    tot4(tot.minutes, U.min) + tot4(tot.seconds, U.s) +
    `</div>`;
}
$('#ec-start').addEventListener('input', renderEcart);
$('#ec-end').addEventListener('input', renderEcart);

// --- Onglet 2 : conversion ---
function renderConversion() {
  const out = $('#cv-result');
  const v = parseFloat($('#cv-value').value);
  const unit = $('#cv-unit').value;
  if (Number.isNaN(v)) { out.textContent = t('enter_value'); return; }
  const all = Time.fromSeconds(Time.toSeconds(v, unit));
  out.innerHTML = Object.keys(all)
    .filter((u) => u !== unit)
    .map((u) => { const x = `${nf.format(all[u])} ${UNITS[lang][u]}`; return `<span data-copy="${x}">${x}</span>`; })
    .join('');
}
$('#cv-value').addEventListener('input', renderConversion);
$('#cv-unit').addEventListener('change', renderConversion);

// --- Onglet 3 : arithmétique ---
function readDuration(fieldset) {
  const get = (u) => parseFloat($(`[data-u="${u}"]`, fieldset).value) || 0;
  return Time.toSeconds(get('d'), 'day') + Time.toSeconds(get('h'), 'h') +
         Time.toSeconds(get('m'), 'min') + get('s');
}
const opNeedsNumber = (op) => op === 'mul' || op === 'divn';

function renderArith() {
  const out = $('#ar-result');
  const op = $('#ar-op').value;
  $('#ar-b').hidden = opNeedsNumber(op);
  $('#ar-n-field').hidden = !opNeedsNumber(op);
  const a = readDuration($('#ar-a'));
  try {
    if (op === 'add') return show(out, fmtDuration(Time.addDurations(a, readDuration($('#ar-b')))));
    if (op === 'sub') {
      const r = Time.subDurations(a, readDuration($('#ar-b')));
      return show(out, (r < 0 ? '− ' : '') + fmtDuration(r));
    }
    const n = parseFloat($('#ar-n').value);
    if (op === 'mul') return show(out, fmtDuration(Time.mulDuration(a, n)));
    if (op === 'divn') return show(out, fmtDuration(Time.divDurationByNumber(a, n)));
    if (op === 'divd') return show(out, `ratio = ${nf.format(Time.ratio(a, readDuration($('#ar-b'))))}`);
  } catch (err) {
    out.innerHTML = `<div class="error">${err.message}</div>`;
  }
}
function show(out, text) { out.innerHTML = `<div class="big" data-copy="${text}">${text}</div>`; }

$('#arith').addEventListener('input', renderArith);
$('#ar-op').addEventListener('change', renderArith);

// --- Copie au clic (lignes Numi + résultats formulaire via [data-copy]) ---
const toast = $('#toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}
function copyText(text, okMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(okMsg || t('copied')), () => showToast(t('copy_fail')));
  } else showToast(t('copy_fail'));
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-copy]');
  if (el) copyText(el.dataset.copy);
});
$('#share-btn').addEventListener('click', () => { persist(); copyText(location.href, t('link_copied')); });

// --- Thème : Auto -> Clair -> Sombre, mémorisé ---
const THEMES = ['auto', 'light', 'dark'];
const themeBtn = $('#theme-btn');
function applyTheme(mode) {
  if (mode === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  themeBtn.textContent = t('theme_' + mode);
}
let theme = 'auto';
try { theme = localStorage.getItem('theme') || 'auto'; } catch (e) {}
themeBtn.addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  try { localStorage.setItem('theme', theme); } catch (e) {}
  applyTheme(theme);
});

// --- Langue : FR <-> EN ---
const langBtn = $('#lang-btn');
function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 2 });
  langBtn.textContent = lang.toUpperCase();
  applyTheme(theme);
  renderNumi(); renderConversion(); renderArith();
}
langBtn.addEventListener('click', () => {
  lang = lang === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('lang', lang); } catch (e) {}
  applyLang();
});

// --- Init ---
loadInitial();
applyLang(); // pose les textes, la locale, le thème et fait le premier rendu

// --- PWA ---
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
