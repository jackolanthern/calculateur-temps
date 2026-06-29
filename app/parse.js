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

  // Noms de mois (fr + en, abrégés) -> index 0-11, pour le format « 15 jan 2026 ».
  const MONTHS = {
    jan: 0, janv: 0, janvier: 0, january: 0,
    fev: 1, 'fév': 1, fevr: 1, 'févr': 1, fevrier: 1, 'février': 1, feb: 1, february: 1,
    mar: 2, mars: 2, march: 2,
    avr: 3, avril: 3, apr: 3, april: 3,
    mai: 4, may: 4,
    juin: 5, jun: 5, june: 5,
    juil: 6, juillet: 6, jul: 6, july: 6,
    aout: 7, 'août': 7, aug: 7, august: 7,
    sep: 8, sept: 8, septembre: 8, september: 8,
    oct: 9, octobre: 9, october: 9,
    nov: 10, novembre: 10, november: 10,
    dec: 11, 'déc': 11, decembre: 11, 'décembre': 11, december: 11,
  };
  const monthIdx = (w) => { const k = w.toLowerCase().replace(/\.$/, ''); return k in MONTHS ? MONTHS[k] : null; };

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
      if (c === '(' || c === ')') { toks.push({ t: 'paren', v: c }); i++; continue; }
      if (c === ',') { toks.push({ t: 'comma' }); i++; continue; } // séparateur d'arguments
      if ('+-*/'.indexOf(c) !== -1) { toks.push({ t: 'op', v: c }); i++; continue; }
      if (isDigit(c)) {
        const rest = input.slice(i);
        const iso = rest.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ISO aaaa-mm-jj
        if (iso) { toks.push({ t: 'date', v: new Date(+iso[1], +iso[2] - 1, +iso[3]) }); i += iso[0].length; continue; }
        const dm = rest.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (dm) {
          const d = new Date(+dm[3], +dm[2] - 1, +dm[1], dm[4] ? +dm[4] : 0, dm[5] ? +dm[5] : 0);
          toks.push({ t: 'date', v: d });
          i += dm[0].length;
          continue;
        }
        const mn = rest.match(/^(\d{1,2})\s+([A-Za-zàâéèûôç]+)\.?\s+(\d{4})/); // « 15 jan 2026 »
        if (mn) {
          const mi = monthIdx(mn[2]);
          if (mi !== null) { toks.push({ t: 'date', v: new Date(+mn[3], mi, +mn[1]) }); i += mn[0].length; continue; }
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
      if (/[a-zA-Zéèàâ'_]/.test(c)) { // mot : date relative (today…) sinon identifiant (variable, prev, total)
        const wm = input.slice(i).match(/^[a-zA-Zéèàâ'_][a-zA-Z0-9éèàâ'_]*/);
        const kd = keywordDate(wm[0].toLowerCase());
        if (kd) toks.push({ t: 'date', v: kd });
        else toks.push({ t: 'id', v: wm[0] }); // résolu à l'évaluation (variable / prev / total)
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
  const text = (t) => ({ type: 'text', text: t });

  // Fonctions appelables : weekday(date), joursouvres(d1,d2), ajoutouvres(date,n) (+ alias en).
  const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const asDate = (v, fn) => { if (!v || v.type !== 'date') throw new Error(fn + ' attend une date'); return v.date; };
  const asNum = (v, fn) => { if (!v || v.type !== 'number') throw new Error(fn + ' attend un nombre'); return v.value; };
  const FUNCS = {
    weekday: (a) => text(WEEKDAYS[asDate(a[0], 'weekday').getDay()]),
    jour: (a) => text(WEEKDAYS[asDate(a[0], 'jour').getDay()]),
    joursouvres: (a) => num(Time.businessDaysBetween(asDate(a[0], 'joursouvres'), asDate(a[1], 'joursouvres'))),
    businessdays: (a) => num(Time.businessDaysBetween(asDate(a[0], 'businessdays'), asDate(a[1], 'businessdays'))),
    ajoutouvres: (a) => dateOf(Time.addBusinessDays(asDate(a[0], 'ajoutouvres'), asNum(a[1], 'ajoutouvres'))),
    addbusinessdays: (a) => dateOf(Time.addBusinessDays(asDate(a[0], 'addbusinessdays'), asNum(a[1], 'addbusinessdays'))),
  };
  function callFunc(name, args) {
    const f = FUNCS[name.toLowerCase()];
    if (!f) throw new Error('Fonction inconnue : ' + name);
    return f(args);
  }

  // Résout un identifiant : variable utilisateur, sinon « prev » / « total »/« sum ».
  function resolveId(name, ctx) {
    if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, name)) return ctx.vars[name];
    const k = name.toLowerCase();
    if (k === 'prev') {
      if (ctx.prev == null) throw new Error('« prev » : aucune ligne précédente');
      return ctx.prev;
    }
    if (k === 'total' || k === 'sum') return dur(ctx.total || 0, { months: 0, days: 0, secs: ctx.total || 0 });
    throw new Error('Inconnu : ' + name);
  }

  function parse(toks, ctx) {
    ctx = ctx || {};
    let p = 0;
    const peek = () => toks[p];

    function factor() {
      const tk = peek();
      if (!tk) throw new Error('Expression incomplète');
      if (tk.t === 'paren' && tk.v === '(') {
        p++;
        const e = expr();
        if (!peek() || peek().t !== 'paren' || peek().v !== ')') throw new Error('Parenthèse fermante manquante');
        p++;
        return e;
      }
      if (tk.t === 'id') {
        p++;
        if (peek() && peek().t === 'paren' && peek().v === '(') { // appel de fonction
          p++;
          const args = [];
          if (!(peek() && peek().t === 'paren' && peek().v === ')')) {
            args.push(expr());
            while (peek() && peek().t === 'comma') { p++; args.push(expr()); }
          }
          if (!(peek() && peek().t === 'paren' && peek().v === ')')) throw new Error('Parenthèse fermante manquante');
          p++;
          return callFunc(tk.v, args);
        }
        return resolveId(tk.v, ctx);
      }
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

  function evaluate(line, ctx) {
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
    const r = parse(tokenize(s), ctx);
    if (target) {
      if (r.type !== 'duration') throw new Error('Conversion possible seulement sur une durée');
      r.target = target;
    }
    return r;
  }

  // Nom réservé (unité, mot-clé date, ou built-in) : interdit comme nom de variable.
  function isReserved(name) {
    const k = name.toLowerCase();
    return !!canon(k) || !!keywordDate(k) || k === 'prev' || k === 'total' || k === 'sum' || k === 'to' || k === 'in';
  }

  // Évalue un document multi-lignes avec contexte : variables (x = …), « prev », « total » (somme des durées).
  function evaluateAll(text) {
    const ctx = { vars: {}, prev: null, total: 0 };
    const track = (val) => {
      if (!val) return;
      ctx.prev = val;
      if (val.type === 'duration') ctx.total += val.seconds;
    };
    return String(text).split('\n').map((line) => {
      if (!line.trim()) return { result: null };
      try {
        const m = line.match(/^\s*([A-Za-z_éèàâ][A-Za-z0-9_éèàâ]*)\s*=\s*(.+)$/);
        if (m && !isReserved(m[1])) { // affectation : x = expr
          const val = evaluate(m[2], ctx);
          ctx.vars[m[1]] = val;
          track(val);
          return { result: val, assignedTo: m[1] };
        }
        const val = evaluate(line, ctx);
        track(val);
        return { result: val };
      } catch (e) {
        return { error: e.message };
      }
    });
  }

  const Numi = { evaluate, evaluateAll, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = Numi;
  else root.Numi = Numi;
})(typeof self !== 'undefined' ? self : this);
