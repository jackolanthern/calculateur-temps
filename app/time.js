// Cœur de calcul — fonctions pures. Marche dans le navigateur (objet global Time)
// et dans Node (module.exports). Aucune dépendance.
(function (root) {
  'use strict';

  const DAY = 86400, HOUR = 3600, MIN = 60;
  // Approximations pour les conversions de durée brute (pas de calendrier ici).
  const MONTH_DAYS = 30, YEAR_DAYS = 365;
  const UNIT_SECONDS = {
    s: 1, min: MIN, h: HOUR, day: DAY, week: 7 * DAY,
    month: MONTH_DAYS * DAY, year: YEAR_DAYS * DAY,
  };

  function daysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate(); // jour 0 du mois suivant
  }

  // Ajoute n mois à une date, en bornant le jour (31 jan + 1 mois = 28/29 fév).
  function addMonths(date, n) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
    return d;
  }

  // Addition calendaire : mois (et années via mois) et jours exacts au calendrier,
  // puis h/min/s en temps réel. months/days peuvent être négatifs.
  function addCalendar(date, months, days, seconds) {
    let d = addMonths(date, months);     // gère le bornage du jour (31 jan +1 mois -> 28/29 fév)
    d.setDate(d.getDate() + days);       // jours calendaires : conserve l'heure locale (DST-safe)
    return new Date(d.getTime() + seconds * 1000);
  }

  // Écart calendaire exact : compte les vrais mois/années, puis le reste en j/h/min/s.
  function diffCalendar(start, end) {
    let sign = 1, a = start, b = end;
    if (end < start) { sign = -1; a = end; b = start; }

    // ponytail: boucles bornées (max ~siècles d'itérations), trivial ici.
    let years = 0;
    while (addMonths(a, (years + 1) * 12) <= b) years++;
    let base = addMonths(a, years * 12);
    let months = 0;
    while (addMonths(base, months + 1) <= b) months++;
    base = addMonths(base, months);

    let rem = Math.floor((b - base) / 1000); // secondes restantes
    const days = Math.floor(rem / DAY); rem -= days * DAY;
    const hours = Math.floor(rem / HOUR); rem -= hours * HOUR;
    const minutes = Math.floor(rem / MIN); rem -= minutes * MIN;
    return { sign, years, months, days, hours, minutes, seconds: rem };
  }

  // Totaux flottants dans chaque unité.
  function diffTotals(start, end) {
    const ms = Math.abs(end - start);
    return { days: ms / 86400000, hours: ms / 3600000, minutes: ms / 60000, seconds: ms / 1000 };
  }

  function toSeconds(value, unit) {
    if (!(unit in UNIT_SECONDS)) throw new Error('Unité inconnue : ' + unit);
    return value * UNIT_SECONDS[unit];
  }

  function fromSeconds(seconds) {
    const out = {};
    for (const u in UNIT_SECONDS) out[u] = seconds / UNIT_SECONDS[u];
    return out;
  }

  function addDurations(a, b) { return a + b; }
  function subDurations(a, b) { return a - b; }
  function mulDuration(sec, n) { return sec * n; }
  function divDurationByNumber(sec, n) {
    if (n === 0) throw new Error('Division par zéro');
    return sec / n;
  }
  function ratio(secA, secB) {
    if (secB === 0) throw new Error('Division par une durée nulle');
    return secA / secB;
  }

  // Jours ouvrés (lundi-vendredi).
  const isWeekday = (d) => { const g = d.getDay(); return g !== 0 && g !== 6; };
  function businessDaysBetween(a, b) {
    const hi = new Date(Math.max(a, b)); hi.setHours(0, 0, 0, 0);
    const cur = new Date(Math.min(a, b)); cur.setHours(0, 0, 0, 0);
    let count = 0;
    cur.setDate(cur.getDate() + 1); // exclut le jour de départ, inclut l'arrivée
    while (cur <= hi) { if (isWeekday(cur)) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  }
  function addBusinessDays(date, n) {
    const d = new Date(date.getTime());
    const step = n >= 0 ? 1 : -1;
    let rem = Math.abs(n);
    while (rem > 0) { d.setDate(d.getDate() + step); if (isWeekday(d)) rem--; }
    return d;
  }

  // Décompose une durée en années/mois/j/h/min/s (approx 365 j/an, 30 j/mois) pour un
  // affichage lisible des conversions. `from` = 'year' (inclut les années) ou 'month'.
  function breakdown(seconds, from) {
    let rem = Math.floor(Math.abs(seconds));
    const out = { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    if (from === 'year') { out.years = Math.floor(rem / (YEAR_DAYS * DAY)); rem -= out.years * YEAR_DAYS * DAY; }
    out.months = Math.floor(rem / (MONTH_DAYS * DAY)); rem -= out.months * MONTH_DAYS * DAY;
    out.days = Math.floor(rem / DAY); rem -= out.days * DAY;
    out.hours = Math.floor(rem / HOUR); rem -= out.hours * HOUR;
    out.minutes = Math.floor(rem / MIN); rem -= out.minutes * MIN;
    out.seconds = rem;
    return out;
  }

  // Décompose un nombre de secondes (>= 0) en j/h/min/s. Le signe est géré par l'appelant.
  function normalize(seconds) {
    let s = Math.floor(Math.abs(seconds));
    const days = Math.floor(s / DAY); s -= days * DAY;
    const hours = Math.floor(s / HOUR); s -= hours * HOUR;
    const minutes = Math.floor(s / MIN); s -= minutes * MIN;
    return { days, hours, minutes, seconds: s };
  }

  const Time = {
    diffCalendar, diffTotals, toSeconds, fromSeconds, addCalendar, breakdown,
    businessDaysBetween, addBusinessDays,
    addDurations, subDurations, mulDuration, divDurationByNumber, ratio,
    normalize, UNIT_SECONDS,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Time;
  else root.Time = Time;
})(typeof self !== 'undefined' ? self : this);
