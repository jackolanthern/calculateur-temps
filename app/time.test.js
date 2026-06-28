// Test du cœur de calcul. Lancer : node time.test.js
// Pas de framework — assert natif, sortie verte = OK.
const assert = require('assert');
const T = require('./time.js');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ok -', name);
}
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); }

// --- diffCalendar : écart calendaire exact ---
check('diffCalendar cas simple 0y 5m 13d', () => {
  const d = T.diffCalendar(new Date('2026-01-15T00:00:00'), new Date('2026-06-28T00:00:00'));
  eq(d, { sign: 1, years: 0, months: 5, days: 13, hours: 0, minutes: 0, seconds: 0 });
});

check('diffCalendar borrow 31 jan -> 1 mar = 1m 1d', () => {
  const d = T.diffCalendar(new Date('2026-01-31T00:00:00'), new Date('2026-03-01T00:00:00'));
  eq({ y: d.years, m: d.months, dd: d.days }, { y: 0, m: 1, dd: 1 });
});

check('diffCalendar avec heures/minutes', () => {
  const d = T.diffCalendar(new Date('2026-01-15T14:00:00'), new Date('2026-06-28T09:30:00'));
  eq({ y: d.years, m: d.months, dd: d.days, h: d.hours, mi: d.minutes },
     { y: 0, m: 5, dd: 12, h: 19, mi: 30 }); // 13e jour pas atteint car heure de fin < heure de début
});

check('diffCalendar fin avant debut => sign -1', () => {
  const d = T.diffCalendar(new Date('2026-06-28T00:00:00'), new Date('2026-01-15T00:00:00'));
  eq({ sign: d.sign, m: d.months, dd: d.days }, { sign: -1, m: 5, dd: 13 });
});

// --- diffTotals : totaux flottants ---
check('diffTotals 1h', () => {
  const t = T.diffTotals(new Date('2026-01-01T00:00:00'), new Date('2026-01-01T01:00:00'));
  eq(t, { days: 3600000 / 86400000, hours: 1, minutes: 60, seconds: 3600 });
});

// --- conversions ---
check('toSeconds heures', () => eq(T.toSeconds(2, 'h'), 7200));
check('toSeconds mois approx 30j', () => eq(T.toSeconds(1, 'month'), 30 * 86400));
check('fromSeconds round-trip', () => {
  const u = T.fromSeconds(7200);
  eq({ h: u.h, min: u.min }, { h: 2, min: 120 });
});

// --- arithmétique ---
check('addDurations', () => eq(T.addDurations(3600, 1800), 5400));
check('subDurations signé', () => eq(T.subDurations(3600, 5400), -1800));
check('mulDuration 1h30 x3 = 4h30', () => eq(T.mulDuration(5400, 3), 16200));
check('divDurationByNumber 2h /4 = 30min', () => eq(T.divDurationByNumber(7200, 4), 1800));
check('divDurationByNumber par 0 lève', () => assert.throws(() => T.divDurationByNumber(7200, 0)));
check('ratio 3h / 30min = 6', () => eq(T.ratio(10800, 1800), 6));
check('ratio par 0 lève', () => assert.throws(() => T.ratio(10800, 0)));

// --- normalize ---
check('normalize 4h30', () => eq(T.normalize(16200), { days: 0, hours: 4, minutes: 30, seconds: 0 }));
check('normalize 1j 1h 1m 1s', () => eq(T.normalize(90061), { days: 1, hours: 1, minutes: 1, seconds: 1 }));

// --- addCalendar : addition calendaire (mois/jours exacts, h/m/s en temps réel) ---
check('addCalendar +1 jour', () => {
  const d = T.addCalendar(new Date(2000, 1, 1), 0, 1, 0); // 1 fév 2000 + 1 j
  eq([d.getFullYear(), d.getMonth(), d.getDate()], [2000, 1, 2]);
});
check('addCalendar +1 mois borne le jour (31 jan + 1 mois = 29 fév 2000)', () => {
  const d = T.addCalendar(new Date(2000, 0, 31), 1, 0, 0);
  eq([d.getMonth(), d.getDate()], [1, 29]); // février, 2000 bissextile
});
check('addCalendar +12 mois = +1 an', () => {
  const d = T.addCalendar(new Date(2000, 1, 1), 12, 0, 0);
  eq([d.getFullYear(), d.getMonth(), d.getDate()], [2001, 1, 1]);
});
check('addCalendar -1 jour traverse le mois', () => {
  const d = T.addCalendar(new Date(2000, 1, 1), 0, -1, 0); // 1 fév - 1 j = 31 jan
  eq([d.getMonth(), d.getDate()], [0, 31]);
});
check('addCalendar +1h30 (temps réel)', () => {
  const d = T.addCalendar(new Date(2000, 1, 2, 0, 0, 0), 0, 0, 5400);
  eq([d.getHours(), d.getMinutes()], [1, 30]);
});

// --- breakdown : décomposition lisible (1128 j = 3 ans 1 mois 3 j) ---
check('breakdown 1128 j -> 3 ans 1 mois 3 j', () => {
  eq(T.breakdown(1128 * 86400, 'year'), { years: 3, months: 1, days: 3, hours: 0, minutes: 0, seconds: 0 });
});
check('breakdown depuis mois (33 j = 1 mois 3 j, pas d\'années)', () => {
  eq(T.breakdown(33 * 86400, 'month'), { years: 0, months: 1, days: 3, hours: 0, minutes: 0, seconds: 0 });
});

console.log(`\n${passed} tests OK`);
