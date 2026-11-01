// Расчёты по листу персонажа с учётом редакции
import { mod, profBonus, totalLevel, halfLevel, EDITIONS, skillsFor, ABIL, hitDiceSummary } from './rules.js';
import { getState, setState } from './store.js';
import { roll } from './dice.js';

export const model = (c) => (EDITIONS[c.edition] || EDITIONS['5e']).model;
export const lvl = (c) => totalLevel(c);
export const pb = (c) => (c.profOverride !== '' && c.profOverride != null ? Number(c.profOverride) : profBonus(lvl(c)));
export const am = (c, k) => mod(c.abilities[k]);
const n = (v) => Number(v) || 0;

export function saveBonus(c, k) {
  return am(c, k) + (c.saveProf[k] ? pb(c) : 0) + n(c.saveMisc[k]);
}

export function skillBonus(c, sk) {
  const md = model(c); const m = am(c, sk.ab) + n(c.skillMisc[sk.key]);
  if (md === '5e') { const p = n(c.skills[sk.key]); return m + (p === 2 ? pb(c) * 2 : p === 1 ? pb(c) : p === 0.5 ? Math.floor(pb(c) / 2) : 0); }
  if (md === '4e') return m + halfLevel(lvl(c)) + (c.skills[sk.key] ? 5 : 0);
  if (md === '35') return m + n(c.skillRanks[sk.key]);
  return m + n(c.skillRanks[sk.key]);
}
export const skillDef = (c, key) => skillsFor(c.edition).find(s => s.key === key);
export function passive(c, key = 'perception') {
  const md = model(c);
  const k = md === '35' ? 'spot' : key; const sk = skillDef(c, k);
  return 10 + (sk ? skillBonus(c, sk) : am(c, 'wis'));
}

export function initiative(c) {
  const md = model(c);
  let v = am(c, 'dex') + n(c.initMisc);
  if (md === '4e') v += halfLevel(lvl(c));
  return v;
}

// Броня из сумки: надетый доспех + щит
export function armorFromInventory(c) {
  const eq = c.inv.items.filter(i => i.equipped && i.armor);
  const body = eq.find(i => i.armor.type !== 'shield');
  const shields = eq.filter(i => i.armor.type === 'shield');
  const dex = am(c, 'dex');
  let ac = body ? n(body.armor.base) + Math.min(dex, body.armor.dexMax ?? 99) + n(body.armor.bonus) : 10 + dex;
  for (const s of shields) ac += n(s.armor.base || 2) + n(s.armor.bonus);
  return { ac, body, shields, stealthDis: !!(body && body.armor.stealth) };
}
export function armorClass(c) {
  if (c.acAuto) return armorFromInventory(c).ac + n(c.acMisc);
  return n(c.ac);
}

// 4e: защиты
export function defenses4e(c) {
  const hl = halfLevel(lvl(c)); const d = c.ed.defMisc;
  return {
    fort: 10 + hl + Math.max(am(c, 'str'), am(c, 'con')) + n(d.fort),
    ref: 10 + hl + Math.max(am(c, 'dex'), am(c, 'int')) + n(d.ref),
    will: 10 + hl + Math.max(am(c, 'wis'), am(c, 'cha')) + n(d.will),
  };
}
// 3.5: спасброски
export function saves35(c) {
  return { fort: n(c.ed.fort) + am(c, 'con'), ref: n(c.ed.ref) + am(c, 'dex'), will: n(c.ed.will) + am(c, 'wis') };
}

export function spellAbility(c) { return c.magic.ability || ''; }
export function spellDC(c) { const a = spellAbility(c); return a ? 8 + pb(c) + am(c, a) + n(c.magic.dcMisc) : null; }
export function spellAtk(c) { const a = spellAbility(c); return a ? pb(c) + am(c, a) + n(c.magic.atkMisc) : null; }

export function attackBonus(c, a) {
  const md = model(c);
  let ab = a.ability === 'best' ? (am(c, 'str') >= am(c, 'dex') ? 'str' : 'dex') : a.ability;
  if (ab === 'spell') ab = spellAbility(c);
  const m = ABIL[ab] ? am(c, ab) : 0;
  let p = 0;
  if (a.prof) p = md === '35' ? n(c.ed.bab) : md === '4e' ? halfLevel(lvl(c)) : md === 'adnd' ? 0 : pb(c);
  return { atk: m + p + n(a.bonus), dmgMod: a.dmgBonus ? m : 0, ab };
}
export function damageFormula(c, a) {
  const { dmgMod } = attackBonus(c, a);
  const base = String(a.dmg || '').replace(/к/g, 'd').replace(/\s/g, '');
  if (!base) return '';
  const extra = n(a.dmgExtra);
  const tot = dmgMod + extra;
  return base + (tot ? (tot > 0 ? '+' + tot : String(tot)) : '');
}

export function carry(c) {
  const coins = Object.values(c.inv.money).reduce((s, v) => s + n(v), 0);
  const items = c.inv.items.filter(i => i.location !== 'stash').reduce((s, i) => s + n(i.weight) * (Number(i.qty) || 0), 0);
  const total = Math.round((items + coins / 50) * 100) / 100;
  const str = n(c.abilities.str);
  return { total, cap: str * 15, push: str * 30, coins };
}

// ---------- броски с режимом (преимущество/помеха) ----------
export const rollMode = () => getState().settings.rollMode || '';
export function setRollMode(m) { setState(s => { s.settings.rollMode = m; return s; }); }
export function rollCheck(bonus, label) {
  const mode = rollMode();
  const r = roll(`1d20${bonus >= 0 ? '+' : ''}${bonus}`, { label, mode });
  if (mode && !getState().settings.stickyMode) setRollMode('');
  return r;
}

export function hitDice(c) {
  return hitDiceSummary(c).map(h => ({ ...h, used: Math.min(h.count, n(c.hitDiceUsed[h.die])) }));
}
