// Test du parseur d'expressions (mode Numi). Lancer : node parse.test.js
const assert = require('assert');
const N = require('./parse.js');

let passed = 0;
function check(name, fn) { fn(); passed++; console.log('  ok -', name); }
const eqd = (a, b) => assert.deepStrictEqual(a, b);

check('conversion 1h -> s', () => {
  const r = N.evaluate('1h -> s');
  assert.strictEqual(r.type, 'duration');
  assert.strictEqual(r.seconds, 3600);
  assert.strictEqual(r.target, 's');
});

check('arithmétique avec sortie 1h + 1h = s', () => {
  const r = N.evaluate('1h + 1h = s');
  assert.strictEqual(r.seconds, 7200);
  assert.strictEqual(r.target, 's');
});

check('conversion via in : 2h in min', () => {
  const r = N.evaluate('2h in min');
  assert.strictEqual(r.seconds, 7200);
  assert.strictEqual(r.target, 'min');
});

check('durée composée 1h30min', () => {
  assert.strictEqual(N.evaluate('1h30min').seconds, 5400);
});

check('multiplication 2h * 3', () => {
  assert.strictEqual(N.evaluate('2h * 3').seconds, 21600);
});

check('soustraction 10min - 2min', () => {
  assert.strictEqual(N.evaluate('10min - 2min').seconds, 480);
});

check('ratio durée/durée 3h / 30min = nombre 6', () => {
  const r = N.evaluate('3h / 30min');
  assert.strictEqual(r.type, 'number');
  assert.strictEqual(r.value, 6);
});

check('précédence * avant + : 1h + 2h * 2 = 5h', () => {
  assert.strictEqual(N.evaluate('1h + 2h * 2').seconds, 18000);
});

check('écart de dates 1/2/2026 - 1/1/2026 = 31 j', () => {
  const r = N.evaluate('1/2/2026 - 1/1/2026'); // j/m/a : 1 fév - 1 jan
  assert.strictEqual(r.type, 'duration');
  assert.strictEqual(r.fromDates, true);
  assert.strictEqual(r.seconds, 31 * 86400);
});

check('date + durée = date : 1/2/2000 + 1j = 2/2/2000', () => {
  const r = N.evaluate('1/2/2000 + 1j');
  assert.strictEqual(r.type, 'date');
  assert.strictEqual(r.date.getDate(), 2);
  assert.strictEqual(r.date.getMonth(), 1); // février (0-indexé)
  assert.strictEqual(r.date.getFullYear(), 2000);
});

check('date - durée = date : 1/2/2000 - 1j = 31/1/2000', () => {
  const r = N.evaluate('1/2/2000 - 1j');
  assert.strictEqual(r.type, 'date');
  assert.strictEqual(r.date.getDate(), 31);
  assert.strictEqual(r.date.getMonth(), 0); // janvier
});

check('durée + date = date (ordre inversé)', () => {
  const r = N.evaluate('1j + 1/2/2000');
  assert.strictEqual(r.type, 'date');
  assert.strictEqual(r.date.getDate(), 2);
});

check('date + durée avec heures : 2/2/2000 + 1h30min', () => {
  const r = N.evaluate('2/2/2000 + 1h30min');
  assert.strictEqual(r.date.getHours(), 1);
  assert.strictEqual(r.date.getMinutes(), 30);
});

check('date + 1mois = calendrier : 1/1/2000 + 1mois = 1/2/2000', () => {
  const r = N.evaluate('1/1/2000 + 1mois');
  eqd([r.date.getMonth(), r.date.getDate()], [1, 1]); // février, 1
});

check('date + 1mois borne le jour : 31/1/2000 + 1mois = 29/2/2000', () => {
  const r = N.evaluate('31/1/2000 + 1mois');
  eqd([r.date.getMonth(), r.date.getDate()], [1, 29]);
});

check('date + 1an : 1/1/2000 + 1an = 1/1/2001', () => {
  const r = N.evaluate('1/1/2000 + 1an');
  eqd([r.date.getFullYear(), r.date.getMonth(), r.date.getDate()], [2001, 0, 1]);
});

check('today = date+heure courantes (proche de maintenant)', () => {
  const r = N.evaluate('today');
  assert.strictEqual(r.type, 'date');
  assert.ok(Math.abs(r.date.getTime() - Date.now()) < 5000);
});

check('tomorrow - today ≈ 1 jour', () => {
  const r = N.evaluate('tomorrow - today');
  assert.strictEqual(r.type, 'duration');
  assert.ok(Math.abs(r.seconds - 86400) < 2);
});

check('today + 1j = même jour que tomorrow', () => {
  assert.strictEqual(N.evaluate('today + 1j').date.getDate(), N.evaluate('tomorrow').date.getDate());
});

check('durée - date lève', () => {
  assert.throws(() => N.evaluate('1j - 1/2/2000'));
});

check('division par zéro lève', () => {
  assert.throws(() => N.evaluate('1h / 0'));
});

check('durée × durée lève', () => {
  assert.throws(() => N.evaluate('1h * 2h'));
});

check('ligne vide => null', () => {
  assert.strictEqual(N.evaluate('   '), null);
});

// --- Phase 2 : parenthèses ---
check('parenthèses changent la précédence : (1h + 30min) * 2 = 3h', () => {
  assert.strictEqual(N.evaluate('(1h + 30min) * 2').seconds, 10800);
});
check('parenthèse non fermée lève', () => {
  assert.throws(() => N.evaluate('(1h + 30min'));
});

// --- Phase 2 : variables & références (evaluateAll) ---
check('variable : x = 2h puis x + 30min', () => {
  const r = N.evaluateAll('x = 2h\nx + 30min');
  assert.strictEqual(r[0].assignedTo, 'x');
  assert.strictEqual(r[0].result.seconds, 7200);
  assert.strictEqual(r[1].result.seconds, 9000);
});
check('prev = résultat de la ligne précédente', () => {
  const r = N.evaluateAll('1h\nprev + 1h');
  assert.strictEqual(r[1].result.seconds, 7200);
});
check('total = somme des durées au-dessus', () => {
  const r = N.evaluateAll('1h\n2h\ntotal');
  assert.strictEqual(r[2].result.seconds, 10800);
});
check('variable inconnue => erreur sur la ligne', () => {
  const r = N.evaluateAll('y + 1h');
  assert.ok(r[0].error && /y/i.test(r[0].error));
});
check('evaluateAll : ligne vide => result null', () => {
  const r = N.evaluateAll('\n1h');
  assert.strictEqual(r[0].result, null);
  assert.strictEqual(r[1].result.seconds, 3600);
});

// --- Phase 3 : formats de date ---
check('date ISO 2026-06-29', () => {
  const r = N.evaluate('2026-06-29 - 2026-06-28');
  assert.strictEqual(r.fromDates, true);
  assert.strictEqual(r.seconds, 86400);
});
check('date nom de mois : 15 jan 2026 - 1 jan 2026 = 14 j', () => {
  assert.strictEqual(N.evaluate('15 jan 2026 - 1 jan 2026').seconds, 14 * 86400);
});
check('date nom de mois complet (français) : 25 décembre 2026', () => {
  const r = N.evaluate('25 décembre 2026 - 24 décembre 2026');
  assert.strictEqual(r.seconds, 86400);
});

// --- Phase 3 : fonctions weekday / jours ouvrés ---
check('weekday(1/1/2024) = lundi', () => {
  const r = N.evaluate('weekday(1/1/2024)');
  assert.strictEqual(r.type, 'text');
  assert.strictEqual(r.text, 'lundi');
});
check('joursouvres(1/1/2024, 8/1/2024) = 5', () => {
  assert.strictEqual(N.evaluate('joursouvres(1/1/2024, 8/1/2024)').value, 5);
});
check('ajoutouvres(5/1/2024, 1) = 8/1/2024 (ven + 1 ouvré = lun)', () => {
  const r = N.evaluate('ajoutouvres(5/1/2024, 1)');
  assert.strictEqual(r.type, 'date');
  assert.strictEqual(r.date.getDate(), 8);
});
check('fonction inconnue lève', () => {
  assert.throws(() => N.evaluate('bidule(1/1/2024)'));
});

console.log(`\n${passed} tests OK`);
