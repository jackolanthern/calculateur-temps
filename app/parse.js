// Parseur d'expressions style Numi. Pur, testable. Marche navigateur + Node.
// Grammaire : expr = term (('+'|'-') term)* ; term = factor (('*'|'/') factor)* ;
// factor = date | nombre | durée(s consécutives sommées). Suffixe « -> / = / in unité » = sortie.
(function (root) {
  'use strict';
  const Time = (typeof require !== 'undefined') ? require('./time.js') : root.Time;

  // mot d'unité -> clé canonique de Time.UNIT_SECONDS
  const UNITS = {
    s: 's', sec: 's', secs: 's', seconde: 's', secondes: 's', second: 's', seconds: 's',
    m: 'min', min: 'min', mins: 'min', minute: 'min', minutes: 'min',
    h: 'h', hr: 'h', hrs: 'h', heure: 'h', heures: 'h', hour: 'h', hours: 'h',
    j: 'day', jour: 'day', jours: 'day', d: 'day', day: 'day', days: 'day',
    sem: 'week', semaine: 'week', semaines: 'week', w: 'week', week: 'week', weeks: 'week',
    mo: 'month', mois: 'month', month: 'month', months: 'month',
    an: 'year', ans: 'year', annee: 'year', annees: 'year', 'année': 'year', 'années': 'year',
    y: 'year', yr: 'year', year: 'year', years: 'year',
  };
  const canon = (w) => UNITS[w.toLowerCase()];

  // Durée -> secondes totales (pour les calculs/conversions) + composantes calendaires
  // (mois/jours/secondes) conservées pour l'addition exacte à une date.
  function makeDur(amount, u) {
    const cal = { months: 0, days: 0, secs: 0 };
    if (u === 'year') cal.months = amount * 12;
    else if (u === 'month') cal.months = amount;
    else if (u === 'week') cal.days = amount * 7;
    else if (u === 'day') cal.days = amount;
    else cal.secs = Time.toSeconds(amount, u); // s / min / h
    return { seconds: Time.toSeconds(amount, u), cal };
  }
  const scaleCal = (c, k) => ({ months: c.months * k, days: c.days * k, secs: c.secs * k });

  // Mots-clés date relatifs (gardent l'heure courante).
  function keywordDate(w) {
    if (w === 'today' || w === 'aujourdhui' || w === "aujourd'hui") return new Date();
    if (w === 'yesterday' || w === 'hier') { const d = new Date(); d.setDate(d.getDate() - 1); return d; }
    if (w === 'tomorrow' || w === 'demain') { const d = new Date(); d.setDate(d.getDate() + 1); return d; }
    return null;
  }

  function tokenize(input) {
    const toks = [];
    let i = 0;
    const isDigit = (c) => c >= '0' && c <= '9';
    while (i < input.length) {
      const c = input[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if ('+-*/'.indexOf(c) !== -1) { toks.push({ t: 'op', v: c }); i++; continue; }
      if (isDigit(c)) {
        const rest = input.slice(i);
        const dm = rest.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (dm) {
          const d = new Date(+dm[3], +dm[2] - 1, +dm[1], dm[4] ? +dm[4] : 0, dm[5] ? +dm[5] : 0);
          toks.push({ t: 'date', v: d });
          i += dm[0].length;
          continue;
        }
        const nm = rest.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zéèàâ]+)?/);
        const num = parseFloat(nm[1].replace(',', '.'));
        if (nm[2] !== undefined) {
          const u = canon(nm[2]);
          if (!u) throw new Error('Unité inconnue : ' + nm[2]);
          toks.push({ t: 'dur', v: makeDur(num, u) });
        } else {
          toks.push({ t: 'num', v: num });
        }
        i += nm[0].length;
        continue;
      }
      if (/[a-zA-Zéèàâ']/.test(c)) { // mot-clé : today / yesterday / tomorrow (et variantes fr)
        const wm = input.slice(i).match(/^[a-zA-Zéèàâ']+/);
        const kd = keywordDate(wm[0].toLowerCase());
        if (!kd) throw new Error('Mot inconnu : ' + wm[0]);
        toks.push({ t: 'date', v: kd });
        i += wm[0].length;
        continue;
      }
      throw new Error('Caractère inattendu : ' + c);
    }
    return toks;
  }

  function combineMul(a, op, b) {
    if (a.type === 'date' || b.type === 'date') throw new Error('Opération invalide sur une date');
    if (op === '*') {
      if (a.type === 'duration' && b.type === 'number') return dur(a.seconds * b.value, scaleCal(a.cal, b.value));
      if (a.type === 'number' && b.type === 'duration') return dur(b.seconds * a.value, scaleCal(b.cal, a.value));
      if (a.type === 'number' && b.type === 'number') return num(a.value * b.value);
      throw new Error('Durée × durée impossible');
    }
    if (a.type === 'duration' && b.type === 'number') return dur(Time.divDurationByNumber(a.seconds, b.value), scaleCal(a.cal, 1 / b.value));
    if (a.type === 'duration' && b.type === 'duration') return num(Time.ratio(a.seconds, b.seconds));
    if (a.type === 'number' && b.type === 'number') return num(Time.divDurationByNumber(a.value, b.value));
    throw new Error('Division invalide');
  }

  function combineAdd(a, op, b) {
    if (a.type === 'date' && b.type === 'date') {
      if (op !== '-') throw new Error('Additionner deux dates n’a pas de sens');
      const lo = Math.min(a.ms, b.ms), hi = Math.max(a.ms, b.ms);
      return { type: 'duration', seconds: (hi - lo) / 1000, fromDates: true, start: new Date(lo), end: new Date(hi) };
    }
    // date ± durée = date, en arithmétique de calendrier (mois/jours exacts, h/m/s en temps réel).
    if (a.type === 'date' && b.type === 'duration') {
      const k = op === '+' ? 1 : -1;
      return dateOf(Time.addCalendar(a.date, k * b.cal.months, k * b.cal.days, k * b.cal.secs));
    }
    if (a.type === 'duration' && b.type === 'date') {
      if (op !== '+') throw new Error('durée − date n’a pas de sens');
      return dateOf(Time.addCalendar(b.date, a.cal.months, a.cal.days, a.cal.secs));
    }
    if (a.type === 'date' || b.type === 'date') throw new Error('Opération date invalide');
    if (a.type === 'duration' && b.type === 'duration') {
      const k = op === '+' ? 1 : -1;
      return dur(a.seconds + k * b.seconds,
        { months: a.cal.months + k * b.cal.months, days: a.cal.days + k * b.cal.days, secs: a.cal.secs + k * b.cal.secs });
    }
    if (a.type === 'number' && b.type === 'number') return num(op === '+' ? a.value + b.value : a.value - b.value);
    throw new Error('Durée + nombre non géré');
  }

  const dur = (seconds, cal) => ({ type: 'duration', seconds, cal: cal || { months: 0, days: 0, secs: seconds } });
  const num = (value) => ({ type: 'number', value });
  const dateOf = (d) => ({ type: 'date', ms: d.getTime(), date: d });

  function parse(toks) {
    let p = 0;
    const peek = () => toks[p];

    function factor() {
      const tk = peek();
      if (!tk) throw new Error('Expression incomplète');
      if (tk.t === 'date') { p++; return { type: 'date', ms: tk.v.getTime(), date: tk.v }; }
      if (tk.t === 'num') { p++; return num(tk.v); }
      if (tk.t === 'dur') {
        let sec = 0;
        const cal = { months: 0, days: 0, secs: 0 };
        while (peek() && peek().t === 'dur') { // 1h30min = somme
          const v = toks[p++].v;
          sec += v.seconds;
          cal.months += v.cal.months; cal.days += v.cal.days; cal.secs += v.cal.secs;
        }
        return dur(sec, cal);
      }
      throw new Error('Terme attendu');
    }
    function term() {
      let a = factor();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        const op = toks[p++].v;
        a = combineMul(a, op, factor());
      }
      return a;
    }
    function expr() {
      let a = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = toks[p++].v;
        a = combineAdd(a, op, term());
      }
      return a;
    }
    const r = expr();
    if (p < toks.length) throw new Error('Expression invalide');
    return r;
  }

  function evaluate(line) {
    let s = String(line).trim();
    if (!s) return null;
    let target = null;
    const tm = s.match(/(?:->|=|\bto\b|\bin\b)\s*([a-zA-Zéèàâ]+)\s*$/);
    if (tm) {
      const u = canon(tm[1]);
      if (u) { target = u; s = s.slice(0, tm.index).trim(); }
    }
    s = s.replace(/(->|=)\s*$/, '').trim(); // tolère un -> ou = en suspens
    if (!s) return null;
    const r = parse(tokenize(s));
    if (target) {
      if (r.type !== 'duration') throw new Error('Conversion possible seulement sur une durée');
      r.target = target;
    }
    return r;
  }

  const Numi = { evaluate, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = Numi;
  else root.Numi = Numi;
})(typeof self !== 'undefined' ? self : this);
