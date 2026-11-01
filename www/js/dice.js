// Разбор и бросок формул вида 2d6+1d4+3, 4d6kh3, 1d20 (с преимуществом), 2к8
import { setState, getState, uid } from './store.js';

const rnd = (n) => {
  if (window.crypto && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % n) + 1; }
  return Math.floor(Math.random() * n) + 1;
};

// mode: 'adv' | 'dis' | '' — применяется к первому d20 в формуле
export function roll(formula, { label = '', mode = '', silent = false } = {}) {
  const src = String(formula || '').toLowerCase().replace(/к/g, 'd').replace(/д/g, 'd').replace(/\s+/g, '').replace(/−/g, '-');
  if (!src) return null;
  const terms = src.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  let total = 0; const parts = []; let usedMode = false; let nat = null;
  for (let t of terms) {
    let sign = 1;
    if (t[0] === '-') { sign = -1; t = t.slice(1); } else if (t[0] === '+') t = t.slice(1);
    const m = t.match(/^(\d*)d(\d+|%)(?:(kh|kl|k)(\d+))?$/);
    if (m) {
      let n = Math.min(100, Number(m[1] || 1)); const sides = m[2] === '%' ? 100 : Number(m[2]);
      if (!sides) return null;
      let keep = m[3] ? { type: m[3] === 'kl' ? 'l' : 'h', n: Number(m[4]) } : null;
      if (sides === 20 && n === 1 && mode && !usedMode) { n = 2; keep = { type: mode === 'adv' ? 'h' : 'l', n: 1 }; usedMode = true; }
      const rolls = Array.from({ length: n }, () => rnd(sides));
      let kept = rolls.map((v, i) => ({ v, i }));
      if (keep) { kept.sort((a, b) => keep.type === 'h' ? b.v - a.v : a.v - b.v); kept = kept.slice(0, keep.n); }
      const keptIdx = new Set(kept.map(k => k.i));
      const sum = kept.reduce((s, k) => s + k.v, 0);
      if (sides === 20 && nat === null && kept.length === 1) nat = kept[0].v;
      total += sign * sum;
      parts.push({ sign, dice: `${n}d${sides}`, sides, rolls: rolls.map((v, i) => ({ v, kept: keptIdx.has(i) })), sum });
    } else if (/^\d+$/.test(t)) {
      total += sign * Number(t); parts.push({ sign, flat: Number(t) });
    } else return null;
  }
  const res = { id: uid(), formula: src, label, mode: usedMode ? mode : '', total, parts, nat, time: Date.now() };
  if (!silent) {
    setState(s => { s.rolls.unshift(res); s.rolls = s.rolls.slice(0, 60); return s; });
    window.dispatchEvent(new CustomEvent('rolled', { detail: res }));
  }
  return res;
}

export const rollD20 = (bonus, label, mode = '') => roll(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, { label, mode });

export function describeParts(r) {
  return r.parts.map((p, i) => {
    const s = i === 0 ? (p.sign < 0 ? '−' : '') : (p.sign < 0 ? ' − ' : ' + ');
    if (p.flat != null) return s + p.flat;
    return s + '[' + p.rolls.map(x => x.kept ? x.v : `(${x.v})`).join(', ') + ']';
  }).join('');
}

export const kf = (f) => String(f || '').replace(/d/g, 'к').replace(/kh/g, 'лучш').replace(/kl/g, 'худш');
export const clearRolls = () => setState(s => { s.rolls = []; return s; });
export { getState };
