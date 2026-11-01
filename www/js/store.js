// Глобальное состояние + сохранение в localStorage
import { useEffect, useState } from 'preact/hooks';
import { CLASSES } from './rules.js';

const KEY = 'dnd-companion-v1';
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const listeners = new Set();
let state = load();
let saveTimer = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.characters = (s.characters || []).map(normalizeChar);
      s.custom = Object.assign({ spells: [], monsters: [], items: [] }, s.custom || {});
      s.rolls = s.rolls || [];
      s.settings = Object.assign({ units: 'lb' }, s.settings || {});
      s.dm = Object.assign(defaultDM(), s.dm || {});
      return s;
    }
  } catch (e) { console.warn('Не удалось загрузить данные', e); }
  return { characters: [], activeId: null, custom: { spells: [], monsters: [], items: [] }, rolls: [], settings: { units: 'lb' }, dm: defaultDM() };
}
function defaultDM() { return { party: { size: 4, level: 3, ed: '5e' }, enc: [], combat: [], round: 1, turn: 0 }; }

export function newCharacter(edition = '2024') {
  return normalizeChar({
    id: uid(), name: 'Новый герой', edition, created: Date.now(),
    classes: [{ name: 'Воин', level: 1, subclass: '' }],
  });
}

export function normalizeChar(c) {
  const d = {
    race: '', background: '', alignment: '', xp: 0, player: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProf: {}, saveMisc: {}, skills: {}, skillMisc: {}, skillRanks: {},
    ac: 10, acNote: '', initMisc: 0, speed: 30, profOverride: '',
    hp: { max: 10, current: 10, temp: 0 }, hitDiceUsed: {}, death: { s: 0, f: 0 },
    conditions: [], exhaustion: 0, concentration: '', inspiration: false, heroic: 0,
    attacks: [], features: [],
    prof: { armor: '', weapons: '', tools: '', languages: 'Общий' },
    persona: { traits: '', ideals: '', bonds: '', flaws: '', backstory: '', allies: '', notes: '', age: '', height: '', weight: '', eyes: '', skin: '', hair: '', gender: '', look: '', portrait: '' },
    magic: { ability: '', slots: {}, pact: { max: 0, level: 1, used: 0 }, spells: [], autoSlots: true, dcMisc: 0, atkMisc: 0 },
    inv: { money: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 }, items: [] },
    companions: [], journal: [],
    combat: { list: [], round: 1, turn: 0 },
    ed: { bab: 0, fort: 0, ref: 0, will: 0, thac0: 20, surges: 0, surgesUsed: 0, defMisc: { fort: 0, ref: 0, will: 0 }, adndSaves: { pp: 14, rsw: 16, pp2: 15, br: 17, sp: 17 }, powers: [] },
  };
  const out = Object.assign({}, d, c);
  for (const k of ['abilities', 'hp', 'death', 'prof', 'persona', 'magic', 'inv', 'combat', 'ed']) out[k] = Object.assign({}, d[k], c[k] || {});
  out.inv.money = Object.assign({}, d.inv.money, (c.inv || {}).money || {});
  out.ed.defMisc = Object.assign({}, d.ed.defMisc, (c.ed || {}).defMisc || {});
  out.ed.adndSaves = Object.assign({}, d.ed.adndSaves, (c.ed || {}).adndSaves || {});
  out.magic.pact = Object.assign({}, d.magic.pact, (c.magic || {}).pact || {});
  if (!out.classes || !out.classes.length) out.classes = [{ name: 'Воин', level: 1, subclass: '' }];
  if (!c.magic && out.classes[0] && CLASSES[out.classes[0].name]) out.magic.ability = CLASSES[out.classes[0].name].spell || '';
  if (!c.saveProf && out.classes[0] && CLASSES[out.classes[0].name]) for (const s of CLASSES[out.classes[0].name].saves) out.saveProf[s] = true;
  return out;
}

function writeNow() {
  clearTimeout(saveTimer); saveTimer = null;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'Память переполнена: уменьшите портреты или удалите лишнее', kind: 'bad' } })); }
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 300);
}
// Сохранить немедленно при сворачивании приложения
window.__flush = () => { if (saveTimer) writeNow(); };
window.addEventListener('pagehide', window.__flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) window.__flush(); });

export const getState = () => state;
export function setState(fn) {
  // Состояние мутируется на месте: компоненты всё равно перерисовываются целиком от глобального стора
  const next = typeof fn === 'function' ? fn(state) : fn;
  if (next) state = next;
  persist();
  listeners.forEach(l => l());
}
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force(n => n + 1); listeners.add(l); return () => listeners.delete(l); }, []);
  return state;
}

export const activeChar = () => state.characters.find(c => c.id === state.activeId) || null;

// Изменить активного персонажа: path-функция мутирует черновик
export function updChar(fn, id) {
  setState(s => {
    const c = s.characters.find(x => x.id === (id || s.activeId));
    if (c) { fn(c); c.updated = Date.now(); }
    return s;
  });
}

// Установить значение по пути вида 'hp.current'
export function setPath(path, value) {
  updChar(c => {
    const parts = path.split('.'); let o = c;
    for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  });
}
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }

export function toast(text, kind = '') { window.dispatchEvent(new CustomEvent('toast', { detail: { text, kind } })); }

export function exportAll() { return JSON.stringify({ app: 'dnd-companion', version: 1, exported: new Date().toISOString(), ...state }, null, 1); }
export function importData(json) {
  const d = JSON.parse(json);
  if (d.app === 'dnd-companion' && Array.isArray(d.characters)) {
    setState(s => {
      for (const c of d.characters) { const i = s.characters.findIndex(x => x.id === c.id); if (i >= 0) s.characters[i] = normalizeChar(c); else s.characters.push(normalizeChar(c)); }
      for (const k of ['spells', 'monsters', 'items']) for (const e of (d.custom || {})[k] || []) if (!s.custom[k].some(x => x.id === e.id)) s.custom[k].push(e);
      if (!s.activeId && s.characters[0]) s.activeId = s.characters[0].id;
      return s;
    });
    return d.characters.length;
  }
  if (d.app === 'dnd-companion-character' && d.character) {
    const c = normalizeChar(d.character); c.id = uid();
    setState(s => { s.characters.push(c); s.activeId = c.id; return s; });
    return 1;
  }
  throw new Error('Файл не похож на резервную копию этого приложения');
}
