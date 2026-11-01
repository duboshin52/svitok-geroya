// Единая точка доступа к справочникам (встроенные + пользовательские записи)
import { SPELLS } from './spells.js';
import m1 from './monsters1.js';
import m2 from './monsters2.js';
import { WEAPONS, ARMOR, GEAR, POTIONS, MAGIC_ITEMS } from './items.js';
import { getState } from '../store.js';
import { crValue } from '../rules.js';
import { bookAllowed, srcOf } from './books.js';

export const MONSTERS = [...m1, ...m2].sort((a, b) => crValue(a.cr) - crValue(b.cr) || a.name.localeCompare(b.name, 'ru'));
export { SPELLS };

export const CATEGORIES = [
  { key: 'spells', name: 'Заклинания', icon: 'sparkles', hint: 'заговоры и круги 1–9' },
  { key: 'monsters', name: 'Бестиарий', icon: 'skull', hint: 'звери, нежить, драконы' },
  { key: 'potions', name: 'Зелья', icon: 'flask-conical', hint: 'зелья, масла, алхимия' },
  { key: 'weapons', name: 'Оружие', icon: 'sword', hint: 'простое и воинское' },
  { key: 'armor', name: 'Броня', icon: 'shield', hint: 'доспехи и щиты' },
  { key: 'gear', name: 'Снаряжение', icon: 'backpack', hint: 'инструменты и товары' },
  { key: 'magic', name: 'Магические предметы', icon: 'gem', hint: 'кольца, плащи, палочки' },
  { key: 'classes', name: 'Классы', icon: 'swords', hint: '14 классов и подклассы' },
  { key: 'races', name: 'Расы', icon: 'users', hint: 'все книги' },
  { key: 'backgrounds', name: 'Предыстории', icon: 'scroll-text', hint: '2014 и 2024' },
  { key: 'feats', name: 'Черты', icon: 'crown', hint: 'фиты' },
  { key: 'conditions', name: 'Состояния и правила', icon: 'book-open', hint: 'шпаргалка за столом' },
  { key: 'dm', name: 'Инструменты мастера', icon: 'crown', hint: 'сражения, трекер, генераторы' },
];

export function getList(cat) {
  return rawList(cat).filter(x => bookAllowed(srcOf(x)));
}
export function rawList(cat) {
  const c = getState().custom;
  const mine = (arr, sub) => (arr || []).filter(x => !sub || x.sub === sub).map(x => ({ ...x, custom: true }));
  switch (cat) {
    case 'spells': return [...mine(c.spells), ...SPELLS];
    case 'monsters': return [...mine(c.monsters), ...MONSTERS];
    case 'weapons': return [...mine(c.items, 'weapon'), ...WEAPONS];
    case 'armor': return [...mine(c.items, 'armor'), ...ARMOR];
    case 'gear': return [...mine(c.items, 'gear'), ...GEAR.filter(g => g.sub === 'gear')];
    case 'potions': return [...mine(c.items, 'potion'), ...POTIONS, ...GEAR.filter(g => g.sub === 'potion' && g.id !== 'g-potion-healing-gear')];
    case 'magic': return [...mine(c.items, 'magic'), ...MAGIC_ITEMS];
    default: return [];
  }
}

const ALL = () => [...getList('spells'), ...getList('monsters'), ...getList('weapons'), ...getList('armor'), ...getList('gear'), ...getList('potions'), ...getList('magic')];
export function findById(id) { return ALL().find(x => x.id === id) || null; }
export const findSpell = (id) => getList('spells').find(s => s.id === id) || null;
export const findMonster = (id) => getList('monsters').find(s => s.id === id) || null;
