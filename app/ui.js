// Câblage DOM. Lit les inputs, appelle Time (time.js), affiche. Calcul en direct.
'use strict';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --- Animations (natives, coupées si l'utilisateur réduit le mouvement) ---
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Crossfade de vue lors d'un changement de panneau (View Transitions API + fallback).
function withViewTransition(apply) {
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(apply);
  else apply();
}
// Position de la pastille glissante d'un contrôle segmenté (index du segment actif).
const setSeg = (container, i) => container.style.setProperty('--i', i);

// --- Formatage ---
const UNIT_LABELS = { s: 'secondes', min: 'minutes', h: 'heures', day: 'jours', week: 'semaines', month: 'mois', year: 'années' };
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

// "1 j 1 h 1 min 1 s" — n'affiche que les parts utiles, garde "s" si tout est nul.
function fmtDuration(seconds) {
  const n = Time.normalize(seconds);
  const parts = [];
  if (n.days) parts.push(n.days + ' j');
  if (n.hours) parts.push(n.hours + ' h');
  if (n.minutes) parts.push(n.minutes + ' min');
  if (n.seconds || parts.length === 0) parts.push(n.seconds + ' s');
  return parts.join(' ');
}

// Décomposition années/mois/j/h/min/s -> texte ("3 ans 1 mois 3 j", parts non nulles).
function fmtBreakdown(b) {
  const parts = [
    b.years && b.years + ' an' + (b.years > 1 ? 's' : ''),
    b.months && b.months + ' mois',
    b.days && b.days + ' j',
    b.hours && b.hours + ' h',
    b.minutes && b.minutes + ' min',
    b.seconds && b.seconds + ' s',
  ].filter(Boolean);
  return parts.join(' ') || '0 s';
}

// Met en forme un résultat du parseur (mode Numi).
function formatResult(r) {
  if (!r) return '';
  if (r.type === 'date') {
    const d = r.date, pad = (n) => String(n).padStart(2, '0');
    let s = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    if (d.getHours() || d.getMinutes() || d.getSeconds()) s += ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    return s;
  }
  if (r.type === 'number') return nf.format(r.value);
  if (r.target) {
    // année/mois : décomposition lisible plutôt qu'un décimal peu parlant (3,09 années)
    if (r.target === 'year' || r.target === 'month') return fmtBreakdown(Time.breakdown(r.seconds, r.target));
    return nf.format(r.seconds / Time.UNIT_SECONDS[r.target]) + ' ' + UNIT_LABELS[r.target];
  }
  if (r.fromDates) {
    const d = Time.diffCalendar(r.start, r.end);
    return [
      d.years && d.years + ' an' + (d.years > 1 ? 's' : ''),
      d.months && d.months + ' mois',
      d.days && d.days + ' j',
      d.hours && d.hours + ' h',
      d.minutes && d.minutes + ' min',
      d.seconds && d.seconds + ' s',
    ].filter(Boolean).join(', ') || '0 s';
  }
  return fmtDuration(r.seconds);
}

// --- Bascule de mode (Expression / Formulaire) ---
const modesBar = $('.modes');
$$('.mode').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    setSeg(modesBar, i); // la pastille glisse (transition CSS)
    withViewTransition(() => {
      $$('.mode').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      $('#numi').hidden = btn.dataset.mode !== 'numi';
      $('#form').hidden = btn.dataset.mode !== 'form';
    });
  });
});

// --- Mode Expression (Numi) ---
const nmInput = $('#nm-input'), nmOut = $('#nm-out');
function renderNumi() {
  nmOut.textContent = nmInput.value.split('\n').map((line) => {
    if (!line.trim()) return '';
    try {
      const r = Numi.evaluate(line);
      return r ? '= ' + formatResult(r) : '';
    } catch (e) {
      return '! ' + e.message;
    }
  }).join('\n');
}
nmInput.addEventListener('input', renderNumi);
// Pré-remplit avec des exemples pour que le résultat soit affiché d'emblée.
nmInput.value = '1/1/2000 - 1/6/1990\n1h -> s\n1h + 30min\n3h / 30min';

// --- Onglets ---
const tabsBar = $('.tabs');
$$('.tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    setSeg(tabsBar, i);
    withViewTransition(() => {
      $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      $$('.panel').forEach((p) => { p.hidden = p.id !== tab.dataset.tab; });
    });
  });
});

// --- Onglet 1 : écart de dates ---
function renderEcart() {
  const out = $('#ec-result');
  const s = $('#ec-start').value, e = $('#ec-end').value;
  if (!s || !e) { out.textContent = 'Choisis deux dates.'; return; }
  const start = new Date(s), end = new Date(e);
  const d = Time.diffCalendar(start, end);
  const tot = Time.diffTotals(start, end);
  const sens = d.sign < 0 ? ' (fin avant début)' : '';

  const cal = [
    d.years && d.years + ' an' + (d.years > 1 ? 's' : ''),
    d.months && d.months + ' mois',
    d.days && d.days + ' j',
    d.hours && d.hours + ' h',
    d.minutes && d.minutes + ' min',
    d.seconds && d.seconds + ' s',
  ].filter(Boolean).join(', ') || '0 s';

  out.innerHTML =
    `<div class="big">${cal}${sens}</div>` +
    `<div class="totals">` +
    `<span>= ${nf.format(tot.days)} jours</span>` +
    `<span>= ${nf.format(tot.hours)} heures</span>` +
    `<span>= ${nf.format(tot.minutes)} minutes</span>` +
    `<span>= ${nf.format(tot.seconds)} secondes</span>` +
    `</div>`;
}
$('#ec-start').addEventListener('input', renderEcart);
$('#ec-end').addEventListener('input', renderEcart);

// --- Onglet 2 : conversion ---
function renderConversion() {
  const out = $('#cv-result');
  const v = parseFloat($('#cv-value').value);
  const unit = $('#cv-unit').value;
  if (Number.isNaN(v)) { out.textContent = 'Entre une valeur.'; return; }
  const all = Time.fromSeconds(Time.toSeconds(v, unit));
  out.innerHTML = Object.keys(all)
    .filter((u) => u !== unit)
    .map((u) => `<span>${nf.format(all[u])} ${UNIT_LABELS[u]}</span>`)
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
  // Bascule entre opérande "durée B" et opérande "nombre".
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
    if (op === 'divd') {
      const ratio = Time.ratio(a, readDuration($('#ar-b')));
      return show(out, `ratio = ${nf.format(ratio)}`);
    }
  } catch (err) {
    out.innerHTML = `<div class="error">${err.message}</div>`;
  }
}
function show(out, text) { out.innerHTML = `<div class="big">${text}</div>`; }

$('#arith').addEventListener('input', renderArith);
$('#ar-op').addEventListener('change', renderArith);

// --- Init ---
renderNumi();
renderConversion();
renderArith();

// --- PWA : enregistre le service worker (ignoré en file://) ---
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
