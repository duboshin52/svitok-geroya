// Правила и справочные таблицы для разных редакций D&D

export const ABILITIES = [
  { key: 'str', short: 'СИЛ', name: 'Сила' },
  { key: 'dex', short: 'ЛОВ', name: 'Ловкость' },
  { key: 'con', short: 'ТЕЛ', name: 'Телосложение' },
  { key: 'int', short: 'ИНТ', name: 'Интеллект' },
  { key: 'wis', short: 'МДР', name: 'Мудрость' },
  { key: 'cha', short: 'ХАР', name: 'Харизма' },
];
export const ABIL = Object.fromEntries(ABILITIES.map(a => [a.key, a]));

export const mod = (score) => Math.floor(((Number(score) || 0) - 10) / 2);
export const fmt = (n) => (n >= 0 ? '+' + n : '−' + Math.abs(n));

const SKILLS_5E = [
  ['acrobatics', 'Акробатика', 'dex'], ['animal', 'Уход за животными', 'wis'], ['arcana', 'Магия', 'int'],
  ['athletics', 'Атлетика', 'str'], ['deception', 'Обман', 'cha'], ['history', 'История', 'int'],
  ['insight', 'Проницательность', 'wis'], ['intimidation', 'Запугивание', 'cha'], ['investigation', 'Анализ', 'int'],
  ['medicine', 'Медицина', 'wis'], ['nature', 'Природа', 'int'], ['perception', 'Внимательность', 'wis'],
  ['performance', 'Выступление', 'cha'], ['persuasion', 'Убеждение', 'cha'], ['religion', 'Религия', 'int'],
  ['sleight', 'Ловкость рук', 'dex'], ['stealth', 'Скрытность', 'dex'], ['survival', 'Выживание', 'wis'],
];
const SKILLS_35 = [
  ['appraise', 'Оценка', 'int'], ['balance', 'Баланс', 'dex'], ['bluff', 'Блеф', 'cha'], ['climb', 'Лазание', 'str'],
  ['concentration', 'Концентрация', 'con'], ['craft', 'Ремесло', 'int'], ['decipher', 'Расшифровка', 'int'],
  ['diplomacy', 'Дипломатия', 'cha'], ['disable', 'Обезвреживание', 'int'], ['disguise', 'Маскировка', 'cha'],
  ['escape', 'Высвобождение', 'dex'], ['forgery', 'Подделка', 'int'], ['gather', 'Сбор информации', 'cha'],
  ['handle', 'Обращение с животными', 'cha'], ['heal', 'Лечение', 'wis'], ['hide', 'Прятание', 'dex'],
  ['intimidate', 'Запугивание', 'cha'], ['jump', 'Прыжки', 'str'], ['knowledge', 'Знание', 'int'],
  ['listen', 'Слушание', 'wis'], ['move', 'Бесшумность', 'dex'], ['openlock', 'Вскрытие замков', 'dex'],
  ['perform', 'Выступление', 'cha'], ['profession', 'Профессия', 'wis'], ['ride', 'Верховая езда', 'dex'],
  ['search', 'Поиск', 'int'], ['sense', 'Чтение мотивов', 'wis'], ['sleight', 'Ловкость рук', 'dex'],
  ['spellcraft', 'Колдовство', 'int'], ['spot', 'Наблюдательность', 'wis'], ['survival', 'Выживание', 'wis'],
  ['swim', 'Плавание', 'str'], ['tumble', 'Акробатика', 'dex'], ['umd', 'Магические устройства', 'cha'],
  ['userope', 'Верёвки', 'dex'],
];
const SKILLS_4E = [
  ['acrobatics', 'Акробатика', 'dex'], ['arcana', 'Магия', 'int'], ['athletics', 'Атлетика', 'str'],
  ['bluff', 'Обман', 'cha'], ['diplomacy', 'Дипломатия', 'cha'], ['dungeoneering', 'Подземелья', 'wis'],
  ['endurance', 'Выносливость', 'con'], ['heal', 'Лечение', 'wis'], ['history', 'История', 'int'],
  ['insight', 'Проницательность', 'wis'], ['intimidate', 'Запугивание', 'cha'], ['nature', 'Природа', 'wis'],
  ['perception', 'Внимательность', 'wis'], ['religion', 'Религия', 'int'], ['stealth', 'Скрытность', 'dex'],
  ['streetwise', 'Знание улиц', 'cha'], ['thievery', 'Воровство', 'dex'],
];
const SKILLS_ADND = [
  ['nwp1', 'Небоевой навык 1', 'int'], ['nwp2', 'Небоевой навык 2', 'wis'], ['nwp3', 'Небоевой навык 3', 'dex'],
  ['nwp4', 'Небоевой навык 4', 'cha'],
];

export const EDITIONS = {
  '2024': { key: '2024', name: 'D&D 2024 (5.5e)', short: '2024', skills: SKILLS_5E, model: '5e', lib: ['2024', '5e'] },
  '5e': { key: '5e', name: 'D&D 5e (2014)', short: '5e', skills: SKILLS_5E, model: '5e', lib: ['5e', '2024'] },
  '4e': { key: '4e', name: 'D&D 4e', short: '4e', skills: SKILLS_4E, model: '4e', lib: [] },
  '3.5': { key: '3.5', name: 'D&D 3.5 / Pathfinder 1e', short: '3.5', skills: SKILLS_35, model: '35', lib: [] },
  'adnd': { key: 'adnd', name: 'AD&D 2e', short: 'AD&D', skills: SKILLS_ADND, model: 'adnd', lib: [] },
};

export const skillsFor = (ed) => (EDITIONS[ed] || EDITIONS['5e']).skills.map(([key, name, ab]) => ({ key, name, ab }));

export const totalLevel = (c) => Math.max(1, (c.classes || []).reduce((s, k) => s + (Number(k.level) || 0), 0));
export const profBonus = (lvl) => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
export const halfLevel = (lvl) => Math.floor(lvl / 2);

export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const levelForXp = (xp) => { let l = 1; XP_TABLE.forEach((t, i) => { if (xp >= t) l = i + 1; }); return l; };

// Классы 5e / 2024
export const CLASSES = {
  'Бард': { hd: 8, caster: 'full', saves: ['dex', 'cha'], spell: 'cha' },
  'Варвар': { hd: 12, caster: null, saves: ['str', 'con'] },
  'Воин': { hd: 10, caster: 'third:Мистический рыцарь', saves: ['str', 'con'], spell: 'int' },
  'Волшебник': { hd: 6, caster: 'full', saves: ['int', 'wis'], spell: 'int' },
  'Друид': { hd: 8, caster: 'full', saves: ['int', 'wis'], spell: 'wis' },
  'Жрец': { hd: 8, caster: 'full', saves: ['wis', 'cha'], spell: 'wis' },
  'Изобретатель': { hd: 8, caster: 'artificer', saves: ['con', 'int'], spell: 'int' },
  'Колдун': { hd: 8, caster: 'pact', saves: ['wis', 'cha'], spell: 'cha' },
  'Монах': { hd: 8, caster: null, saves: ['str', 'dex'] },
  'Паладин': { hd: 10, caster: 'half', saves: ['wis', 'cha'], spell: 'cha' },
  'Плут': { hd: 8, caster: 'third:Мистический ловкач', saves: ['dex', 'int'], spell: 'int' },
  'Следопыт': { hd: 10, caster: 'half', saves: ['str', 'dex'], spell: 'wis' },
  'Чародей': { hd: 6, caster: 'full', saves: ['con', 'cha'], spell: 'cha' },
  'Охотник на кровь': { hd: 10, caster: null, saves: ['dex', 'int'] },
};
export const CLASS_NAMES = Object.keys(CLASSES);
export const CLASS_EN = { 'Охотник на кровь': 'bloodhunter', 'Бард': 'bard', 'Волшебник': 'wizard', 'Друид': 'druid', 'Жрец': 'cleric', 'Изобретатель': 'artificer', 'Колдун': 'warlock', 'Паладин': 'paladin', 'Следопыт': 'ranger', 'Чародей': 'sorcerer' };

// Ячейки полного заклинателя по уровню заклинателя
export const FULL_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
// Колдун: [кол-во ячеек, уровень ячеек] по уровню колдуна
export const PACT = [null, [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]];

// Подсчёт ячеек для 5e/2024 по классам (с учётом мультикласса)
export function computeSlots(c) {
  const ed = c.edition;
  let casterLvl = 0, casters = 0, pact = null;
  for (const k of c.classes || []) {
    const def = CLASSES[k.name]; const lvl = Number(k.level) || 0;
    if (!def || !def.caster || !lvl) continue;
    const [type, sub] = def.caster.split(':');
    if (type === 'full') { casterLvl += lvl; casters++; }
    else if (type === 'half') { casterLvl += ed === '2024' ? Math.ceil(lvl / 2) : (lvl >= 2 ? Math.floor(lvl / 2) : 0); casters++; }
    else if (type === 'artificer') { casterLvl += Math.ceil(lvl / 2); casters++; }
    else if (type === 'third') { if ((k.subclass || '').toLowerCase().includes(sub.toLowerCase().split(' ')[1]) && lvl >= 3) { casterLvl += Math.floor(lvl / 3); casters++; } }
    else if (type === 'pact') { pact = PACT[Math.min(20, lvl)]; }
  }
  // Одиночный полузаклинатель 2014 года: при 1 уровне ячеек нет
  const slots = (FULL_SLOTS[Math.min(20, casterLvl)] || []).slice();
  return { slots, pact };
}

export function hitDiceSummary(c) {
  const m = {};
  for (const k of c.classes || []) { const hd = (CLASSES[k.name] || {}).hd || Number(k.hd) || 8; m[hd] = (m[hd] || 0) + (Number(k.level) || 0); }
  return Object.entries(m).filter(([, n]) => n > 0).sort((a, b) => b[0] - a[0]).map(([d, n]) => ({ die: Number(d), count: n }));
}

export const SCHOOLS = {
  abjuration: 'Ограждение', conjuration: 'Вызов', divination: 'Прорицание', enchantment: 'Очарование',
  evocation: 'Воплощение', illusion: 'Иллюзия', necromancy: 'Некромантия', transmutation: 'Преобразование',
};
export const SPELL_CLASSES = { bard: 'Бард', cleric: 'Жрец', druid: 'Друид', paladin: 'Паладин', ranger: 'Следопыт', sorcerer: 'Чародей', warlock: 'Колдун', wizard: 'Волшебник', artificer: 'Изобретатель' };
export const levelName = (l) => (l === 0 ? 'Заговор' : `${l} круг`);

export const CONDITION_NAMES = ['Бессознательный', 'Испуганный', 'Истощённый', 'Невидимый', 'Недееспособный', 'Оглохший', 'Окаменевший', 'Опутанный', 'Ослеплённый', 'Отравленный', 'Очарованный', 'Ошеломлённый', 'Парализованный', 'Сбитый с ног', 'Схваченный'];

export const SIZES = { T: 'Крошечный', S: 'Маленький', M: 'Средний', L: 'Большой', H: 'Огромный', G: 'Громадный' };
export const CR_XP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '30': 155000 };
export const crValue = (cr) => { const s = String(cr); if (s.includes('/')) { const [a, b] = s.split('/'); return Number(a) / Number(b); } return Number(s) || 0; };
export const crProf = (cr) => Math.max(2, 2 + Math.floor((Math.max(1, crValue(cr)) - 1) / 4));

export const COIN_NAMES = [['pp', 'ПМ', 'платиновые'], ['gp', 'ЗМ', 'золотые'], ['ep', 'ЭМ', 'электрумовые'], ['sp', 'СМ', 'серебряные'], ['cp', 'ММ', 'медные']];
export const COIN_IN_GP = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };

export const LOCATIONS = [
  { key: 'equipped', name: 'Надето и в руках' },
  { key: 'carried', name: 'При себе' },
  { key: 'backpack', name: 'В рюкзаке' },
  { key: 'stash', name: 'Хранилище (не учитывается в весе)' },
];
export const ITEM_CATS = { weapon: 'Оружие', armor: 'Броня', potion: 'Зелья', magic: 'Магические', gear: 'Снаряжение', personal: 'Личные вещи', other: 'Прочее' };
