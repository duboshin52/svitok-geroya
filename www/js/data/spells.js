import s1 from './spells1.js';
import s2 from './spells2.js';
import s3 from './spells3.js';
import s4 from './spells4.js';
import s5 from './spells5.js';
import s6 from './spells6.js';

const CL = { b: 'bard', c: 'cleric', d: 'druid', p: 'paladin', r: 'ranger', s: 'sorcerer', k: 'warlock', w: 'wizard', a: 'artificer' };
const SC = { abj: 'abjuration', con: 'conjuration', div: 'divination', enc: 'enchantment', evo: 'evocation', ill: 'illusion', nec: 'necromancy', tra: 'transmutation' };

// Источники заклинаний из первой части базы, которых нет в SRD
const SRC = { hex: 'PHB', 'dissonant-whispers': 'PHB', 'chromatic-orb': 'PHB', 'ice-knife': 'XGE', 'spirit-shroud': 'TCE', 'sorcerous-burst': 'PHB24', 'starry-wisp': 'PHB24', 'hunters-mark': 'PHB', 'wrathful-smite': 'PHB', 'branding-smite': 'PHB', 'misty-step': 'PHB', 'find-steed': 'PHB', 'hideous-laughter': 'SRD' };

// Другие названия (переводы разных изданий и сайтов) — для поиска
export const ALT = {
  'eldritch-blast': 'ведьмин заряд, ведьминский заряд, потусторонний заряд, жуткий заряд, мистический взрыв',
  'witch-bolt': 'ведьмин снаряд, ведьмина молния',
  'hex': 'проклятие колдуна, порча',
  'hideous-laughter': 'жуткий смех таши, ужасный смех',
  'magic-missile': 'магическая стрела, волшебные стрелы',
  'mage-hand': 'рука мага',
  'cure-wounds': 'лечение ран, исцеление ран',
  'healing-word': 'целительное слово',
  'counterspell': 'контрзаклинание, контрмагия',
  'black-tentacles': 'щупальца эварда',
  'arcane-hand': 'рука бигби, призрачная рука',
  'tiny-hut': 'хижина леомунда',
  'resilient-sphere': 'сфера отилюка',
  'caustic-brew': 'кислотное варево таши',
  'mind-sliver': 'осколок разума',
  'toll-the-dead': 'похоронный звон',
  'sacred-flame': 'священное пламя',
  'guiding-bolt': 'направленный снаряд',
  'spiritual-weapon': 'духовное оружие',
  'thunderwave': 'громовая волна',
  'armor-of-agathys': 'броня агатиса',
  'hunger-of-hadar': 'голод хадара',
  'true-strike': 'верный удар',
  'instant-summons': 'мгновенный призыв драумиджа',
  'telepathic-bond': 'телепатическая связь рари',
  'mind-whip': 'хлыст разума таши',
  'conjure-volley': 'призыв града',
  'speak-with-plants': 'речь растений',
};

export const SPELLS = [...s1, ...s2, ...s3, ...s4, ...s5, ...s6].filter(x => x[3] >= 0).map(([id, name, en, level, school, time, range, components, duration, conc, ritual, classes, text, higher, ed, src]) => ({
  id, name, en, level, school: SC[school] || school, time, range, components, duration,
  concentration: !!conc, ritual: !!ritual,
  classes: classes.split(',').map(c => CL[c.trim()]).filter(Boolean),
  text, higher: higher || '', ed: ed || ['5e', '2024'], kind: 'spell', src: src || SRC[id] || 'SRD', alt: ALT[id] || '',
})).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
