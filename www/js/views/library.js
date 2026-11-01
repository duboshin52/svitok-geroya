// Справочник: заклинания, бестиарий, зелья, оружие, броня, снаряжение, магические предметы, состояния
import { useState, useMemo } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Area, Select, Prose, Empty, confirmBox, Tabs, Toggle } from '../ui.js';
import { CLASS_DATA, SUBCLASS_DATA } from '../data/classes.js';
import { racesFor, BACKGROUNDS, FEATS } from '../data/origins.js';
import { getState, setState, activeChar, updChar, uid, toast, useStore } from '../store.js';
import { CATEGORIES, getList } from '../data/index.js';
import { CONDITIONS, QUICK_RULES } from '../data/rules-ref.js';
import { WEAPON_CATS, ARMOR_TYPES, MASTERY } from '../data/items.js';
import { SCHOOLS, SPELL_CLASSES, levelName, SIZES, CR_XP, crValue, mod, fmt, ABILITIES, EDITIONS, skillsFor } from '../rules.js';
import { roll } from '../dice.js';
import { openDM } from './dm.js';
import { srcOf, matchBook, booksIn, bookAllowed, bookName } from '../data/books.js';
import { saveTextFile, pickFile, readText } from '../native.js';

let libCat = null; // запоминаем раздел между переключениями вкладок
const filters = {};

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
const matches = (x, q) => !q || norm(x.name).includes(q) || norm(x.en).includes(q) || norm(x.alt).includes(q);
export { matches, norm };

export function spellMeta(s) {
  return `${levelName(s.level)} · ${SCHOOLS[s.school] || s.school || ''}${s.ritual ? ' · ритуал' : ''}${s.concentration ? ' · К' : ''}${s.src && s.src !== 'SRD' ? ' · ' + s.src : ''}`;
}
export function itemMeta(x) {
  if (x.sub === 'weapon') return `${WEAPON_CATS[x.cat] || ''} · ${x.dmg} ${x.dtype || ''} · ${x.cost || ''}`;
  if (x.sub === 'armor') return `${ARMOR_TYPES[x.type] || ''} · КД ${x.ac} · ${x.cost || ''}`;
  if (x.sub === 'potion' || x.sub === 'magic') return [x.type, x.rarity, x.cost].filter(Boolean).join(' · ');
  return [x.cost, x.weight ? x.weight + ' фнт' : ''].filter(Boolean).join(' · ');
}

// ===================== ГЛАВНЫЙ ЭКРАН =====================
export function LibraryView() {
  useStore();
  const [cat, setCat] = useState(libCat);
  const go = (c) => { libCat = c; setCat(c); };
  if (!cat) return html`<${LibraryHome} onPick=${go} />`;
  return html`<div class="wrap">
    <div class="row mb"><button class="btn sm ghost" onClick=${() => go(null)}><${Icon} n="chevron-left" cls="s" /> Разделы</button>
      <div class="grow"></div>
      ${!['conditions', 'classes', 'races', 'backgrounds', 'feats'].includes(cat) && html`<button class="btn sm ghost" title="Импорт записи из JSON-файла" onClick=${importEntryFile}><${Icon} n="upload" cls="s" /></button>
        <button class="btn sm" onClick=${() => openCustomEditor(cat)}><${Icon} n="plus" cls="s" /> Своя запись</button>`}</div>
    ${cat === 'conditions' ? html`<${ConditionsList} />` : ['classes', 'races', 'backgrounds', 'feats'].includes(cat) ? html`<${OriginsList} cat=${cat} />` : html`<${LibraryList} cat=${cat} />`}
  </div>`;
}

function LibraryHome({ onPick }) {
  const [q, setQ] = useState('');
  const c = activeChar();
  const ed = c ? EDITIONS[c.edition] : null;
  const results = useMemo(() => {
    const nq = norm(q.trim()); if (nq.length < 2) return null;
    const out = [];
    for (const k of CATEGORIES) if (!['conditions', 'dm'].includes(k.key)) for (const x of getList(k.key)) if (matches(x, nq)) out.push({ x, cat: k.key });
    return out.slice(0, 60);
  }, [q, getState().custom]);
  return html`<div class="wrap">
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Поиск по всему справочнику" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    ${results ? html`<div>${results.length ? results.map(({ x, cat }) => html`<${LibRow} x=${x} cat=${cat} />`) : html`<${Empty} icon="search">Ничего не найдено</${Empty}>`}</div>` : html`
      ${ed && !ed.lib.length && html`<div class="card tight small muted mb"><${Icon} n="info" cls="xs" /> Встроенная база — по открытым правилам 5e/2024 (SRD). Для ${ed.name} добавляйте свои записи кнопкой «Своя запись» в любом разделе.</div>`}
      <div class="catgrid">${CATEGORIES.map(k => html`<button class="catcard" onClick=${() => k.key === 'dm' ? openDM() : onPick(k.key)}>
        <${Icon} n=${k.icon} /><b>${k.name}</b><span>${['conditions', 'classes', 'races', 'backgrounds', 'feats', 'dm'].includes(k.key) ? k.hint : `${getList(k.key).length} · ${k.hint}`}</span></button>`)}</div>
      <p class="tiny faint center mt2">Материалы SRD 5.1 и SRD 5.2 © Wizards of the Coast LLC, лицензия CC-BY-4.0. Пересказ на русском языке.</p>`}
  </div>`;
}

function LibRow({ x, cat, onClick }) {
  const open = onClick || (() => openDetail(x, cat));
  if (cat === 'spells') return html`<button class="libitem" onClick=${open}>
    <div class=${'lvlbadge' + (x.level === 0 ? ' cantrip' : '')}>${x.level === 0 ? 'З' : x.level}</div>
    <div class="grow"><div class="nm">${x.name}${x.custom ? html` <span class="chip gold">своё</span>` : ''}</div><div class="meta">${spellMeta(x)}</div></div></button>`;
  if (cat === 'monsters') return html`<button class="libitem" onClick=${open}>
    <div class="lvlbadge" style="font-size:${String(x.cr).length > 2 ? 13 : 17}px;color:#e08a80">${x.cr}</div>
    <div class="grow"><div class="nm">${x.name}${x.custom ? html` <span class="chip gold">своё</span>` : ''}</div><div class="meta">${SIZES[x.size] || x.size} ${x.type} · КД ${x.ac} · ${x.hp} хитов</div></div></button>`;
  return html`<button class="libitem" onClick=${open}>
    <div class="lvlbadge"><${Icon} n=${{ weapons: 'sword', armor: 'shield', potions: 'flask-conical', magic: 'gem', gear: 'backpack' }[cat] || 'package-open'} cls="s" /></div>
    <div class="grow"><div class="nm">${x.name}${x.custom ? html` <span class="chip gold">своё</span>` : ''}</div><div class="meta">${itemMeta(x)}</div></div></button>`;
}

// ===================== СПИСОК С ФИЛЬТРАМИ =====================
function LibraryList({ cat }) {
  const f = filters[cat] || (filters[cat] = { q: '' });
  const [, force] = useState(0);
  const set = (k, v) => { f[k] = v; force(n => n + 1); };
  const all = getList(cat);
  const q = norm(f.q);
  let list = all.filter(x => matches(x, q) && matchBook(srcOf(x), f.book));
  const books = booksIn(all);
  const bookUi = books.length > 1 ? html`<div class="mb"><${Select} value=${f.book || ''} onChange=${v => set('book', v)} options=${[['', 'Все книги'], ...books.map(([k, n]) => [k, n])]} /></div>` : null;
  let filterUi = null;
  if (cat === 'spells') {
    if (f.level != null && f.level !== '') list = list.filter(x => x.level === Number(f.level));
    if (f.cls) list = list.filter(x => (x.classes || []).includes(f.cls));
    if (f.school) list = list.filter(x => x.school === f.school);
    if (f.flag === 'conc') list = list.filter(x => x.concentration); if (f.flag === 'ritual') list = list.filter(x => x.ritual);
    filterUi = html`<div class="tabs">${[['', 'Все'], ['0', 'Заговоры'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), n + ' круг'])].map(([k, l]) =>
      html`<button class=${'tab' + ((f.level ?? '') === k ? ' on' : '')} onClick=${() => set('level', k)}>${l}</button>`)}</div>
      <div class="grid3 mb"><${Select} value=${f.cls || ''} onChange=${v => set('cls', v)} options=${[['', 'Все классы'], ...Object.entries(SPELL_CLASSES)]} />
      <${Select} value=${f.school || ''} onChange=${v => set('school', v)} options=${[['', 'Все школы'], ...Object.entries(SCHOOLS)]} />
      <${Select} value=${f.flag || ''} onChange=${v => set('flag', v)} options=${[['', 'Любые'], ['conc', 'Концентрация'], ['ritual', 'Ритуалы']]} /></div>`;
  } else if (cat === 'monsters') {
    const ranges = { '': [-1, 99], a: [0, 0.5], b: [1, 4], c: [5, 10], d: [11, 16], e: [17, 99] };
    const [lo, hi] = ranges[f.cr || ''];
    list = list.filter(x => { const v = crValue(x.cr); return v >= lo && v <= hi; });
    if (f.type) list = list.filter(x => norm(x.type).startsWith(f.type));
    const types = [...new Set(all.map(x => norm(x.type).split(' ')[0]))].sort();
    filterUi = html`<div class="tabs">${[['', 'Все ПО'], ['a', '0–½'], ['b', '1–4'], ['c', '5–10'], ['d', '11–16'], ['e', '17+']].map(([k, l]) =>
      html`<button class=${'tab' + ((f.cr || '') === k ? ' on' : '')} onClick=${() => set('cr', k)}>${l}</button>`)}</div>
      <div class="mb"><${Select} value=${f.type || ''} onChange=${v => set('type', v)} options=${[['', 'Все типы'], ...types.map(t => [t, t[0].toUpperCase() + t.slice(1)])]} /></div>`;
  } else if (cat === 'weapons') {
    if (f.wc) list = list.filter(x => x.cat === f.wc);
    filterUi = html`<div class="tabs">${[['', 'Всё'], ...Object.entries(WEAPON_CATS)].map(([k, l]) => html`<button class=${'tab' + ((f.wc || '') === k ? ' on' : '')} onClick=${() => set('wc', k)}>${l}</button>`)}</div>`;
  } else if (cat === 'armor') {
    if (f.at) list = list.filter(x => x.type === f.at);
    filterUi = html`<div class="tabs">${[['', 'Всё'], ...Object.entries(ARMOR_TYPES)].map(([k, l]) => html`<button class=${'tab' + ((f.at || '') === k ? ' on' : '')} onClick=${() => set('at', k)}>${l}</button>`)}</div>`;
  } else if (cat === 'potions' || cat === 'magic') {
    const rar = ['обычн', 'необычн', 'редк', 'очень редк', 'легендарн'];
    if (f.r) list = list.filter(x => f.r === 'редк' ? /^редк/.test(norm(x.rarity)) : norm(x.rarity).startsWith(f.r));
    filterUi = html`<div class="tabs">${[['', 'Любая редкость'], ...rar.map(r => [r, r[0].toUpperCase() + r.slice(1) + 'ые'])].map(([k, l]) => html`<button class=${'tab' + ((f.r || '') === k ? ' on' : '')} onClick=${() => set('r', k)}>${l}</button>`)}</div>`;
  }
  const title = CATEGORIES.find(c => c.key === cat).name;
  return html`<div>
    <div class="section-title" style="margin-top:0">${title}<span class="chip">${list.length}</span></div>
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Название (рус. или англ.)" value=${f.q} onInput=${e => set('q', e.target.value)} /></div>
    ${filterUi}
    ${bookUi}
    ${list.length ? list.slice(0, 300).map(x => html`<${LibRow} key=${x.id} x=${x} cat=${cat} />`) : html`<${Empty} icon="search">Ничего не найдено. Можно добавить свою запись.</${Empty}>`}
  </div>`;
}

function OriginsList({ cat }) {
  const [q, setQ] = useState(''); const [ed, setEd] = useState('5e');
  const nq = norm(q);
  const SK = Object.fromEntries(skillsFor('5e').map(x => [x.key, x.name]));
  let rows = [];
  if (cat === 'classes') rows = Object.entries(CLASS_DATA).map(([n, d]) => ({ name: n, meta: `к${d.hd} · ${d.primary}`, body: () => html`<div><p>${d.desc}</p>
    <dl class="kv"><dt>Спасброски</dt><dd>${d.saves.map(k => ABILITIES.find(a => a.key === k).name).join(', ')}</dd><dt>Доспехи</dt><dd>${d.armor}</dd><dt>Оружие</dt><dd>${d.weapons}</dd><dt>Навыки</dt><dd>${d.skills.n} из ${d.skills.from === 'any' ? 'любых' : d.skills.from.map(k => SK[k]).join(', ')}</dd></dl>
    <div class="sbhead">Умения по уровням</div>${[...d.features].sort((a, b) => a[0] - b[0]).map(f => html`<p class="entry small"><b>${f[0]} ур. ${f[1]}${f[4] ? ' (' + f[4] + ')' : ''}.</b> ${f[2]}</p>`)}
    <div class="sbhead">${d.subTitle}</div>${(SUBCLASS_DATA[n] || []).map(([sn, src, t]) => html`<p class="entry small"><b>${sn}</b> <span class="faint">${src}</span> — ${t}</p>`)}</div>` }));
  if (cat === 'races') rows = racesFor(ed).map(r => ({ src: r.src || (ed === '2024' ? 'PHB24' : 'PHB'), name: r.name, meta: [r.src || (ed === '2024' ? 'PHB 2024' : 'PHB'), r.size, r.speed + ' фт'].join(' · '), body: () => html`<div>
    ${r.traits.map(([n, t]) => html`<p class="entry small"><b>${n}.</b> ${t}</p>`)}${r.subs.map(sb => html`<div class="sbhead">${sb.name}</div>${(sb.traits || []).map(([n, t]) => html`<p class="entry small"><b>${n}.</b> ${t}</p>`)}`)}</div>` }));
  if (cat === 'backgrounds') rows = BACKGROUNDS[ed].map(b => ({ src: ed === '2024' ? 'PHB24' : 'PHB', name: b.name, meta: [b.skills.map(k => SK[k]).join(', '), b.feat].filter(Boolean).join(' · '), body: () => html`<dl class="kv">
    ${b.abil && html`<dt>Характеристики</dt><dd>${b.abil.map(k => ABILITIES.find(a => a.key === k).name).join(', ')}</dd>`}<dt>Навыки</dt><dd>${b.skills.map(k => SK[k]).join(', ')}${b.choice ? ` + ${b.choice.n} на выбор` : ''}</dd>
    ${b.tools && html`<dt>Инструменты</dt><dd>${b.tools}</dd>`}${b.langs && html`<dt>Языки</dt><dd>${b.langs} на выбор</dd>`}${b.feat && html`<dt>Черта</dt><dd>${b.feat}</dd>`}</dl>` }));
  if (cat === 'feats') rows = FEATS.map(([n, src, t, type]) => ({ src, name: n, meta: `${type} · ${src}`, body: () => html`<p>${t}</p>` }));
  const [book, setBook] = useState('');
  const bookOpts = [...new Set(rows.map(r => r.src).filter(Boolean))];
  rows = rows.filter(r => (!nq || norm(r.name).includes(nq)) && (!book || matchBook(r.src, book)) && (!r.src || bookAllowed(r.src)));
  return html`<div>
    <div class="section-title" style="margin-top:0">${CATEGORIES.find(c => c.key === cat).name}<span class="chip">${rows.length}</span></div>
    ${(cat === 'races' || cat === 'backgrounds') && html`<div class="mb"><${Toggle} value=${ed} onChange=${setEd} options=${[['5e', '5e (2014)'], ['2024', '2024']]} /></div>`}
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Поиск" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    ${bookOpts.length > 1 && html`<div class="mb"><${Select} value=${book} onChange=${setBook} options=${[['', 'Все книги'], ...bookOpts.map(k => [k, bookName(k)])]} /></div>`}
    ${rows.map(r => html`<button class="libitem" onClick=${() => openModal(() => html`<div class="detail"><h2>${r.name}</h2><div class="en">${r.meta}</div><div class="mt">${r.body()}</div></div>`, { title: CATEGORIES.find(c => c.key === cat).name, full: true })}>
      <div class="grow"><div class="nm">${r.name}</div><div class="meta">${r.meta}</div></div><${Icon} n="chevron-right" cls="s" /></button>`)}
  </div>`;
}

function ConditionsList() {
  const [t, setT] = useState('cond');
  return html`<div>
    <${Tabs} value=${t} onChange=${setT} tabs=${[['cond', 'Состояния'], ['rules', 'Быстрые правила']]} />
    ${(t === 'cond' ? CONDITIONS : QUICK_RULES).map(([n, en, txt]) => html`<details class="card collapsible"><summary class="row"><b class="grow serif" style="font-size:19px">${n}</b>${txt ? html`<span class="tiny faint">${en}</span>` : ''}<${Icon} n="chevron-down" cls="s" /></summary><div class="mt"><${Prose} text=${txt || en} /></div></details>`)}
  </div>`;
}

// ===================== ДЕТАЛЬНЫЕ КАРТОЧКИ =====================
export function openDetail(x, cat) {
  const title = cat === 'spells' ? 'Заклинание' : cat === 'monsters' ? 'Бестиарий' : 'Предмет';
  openModal(close => html`<${Detail} x=${x} cat=${cat} close=${close} />`, { title, full: true });
}

function Detail({ x, cat, close }) {
  const c = activeChar();
  const body = cat === 'spells' ? html`<${SpellBody} s=${x} />` : cat === 'monsters' ? html`<${MonsterBody} m=${x} />` : html`<${ItemBody} x=${x} />`;
  return html`<div class="detail">
    <h2>${x.name}</h2><div class="en">${x.en}${x.alt ? ' · также: ' + x.alt : ''}${x.ed && x.ed.length === 1 ? ` · только ${x.ed[0]}` : ''}${x.custom ? ' · ваша запись' : ''}</div>
    ${body}
    <div class="row wrapr mt2">
      ${cat === 'spells' && html`<button class="btn gold grow" onClick=${() => { addSpellToChar(x); }} disabled=${!c}><${Icon} n="list-plus" cls="s" /> В лист персонажа</button>`}
      ${cat === 'monsters' && html`<button class="btn gold grow" onClick=${() => { addCompanion(x); close(); }} disabled=${!c}><${Icon} n="paw-print" cls="s" /> В спутники</button>`}
      ${!['spells', 'monsters'].includes(cat) && html`<button class="btn gold grow" onClick=${() => addItemToChar(x)} disabled=${!c}><${Icon} n="backpack" cls="s" /> В сумку</button>`}
      ${cat === 'weapons' && html`<button class="btn grow" onClick=${() => addAttackFromWeapon(x)} disabled=${!c}><${Icon} n="swords" cls="s" /> Как атаку</button>`}
      ${x.custom && html`<button class="btn" onClick=${() => shareEntry(cat, x)} title="Поделиться записью (JSON-файл)"><${Icon} n="share-2" cls="s" /></button>
        <button class="btn" onClick=${() => { close(); openCustomEditor(cat, x); }}><${Icon} n="pencil" cls="s" /></button>
        <button class="btn red" onClick=${async () => { if (await confirmBox(`Удалить «${x.name}» из справочника?`)) { deleteCustom(cat, x.id); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
    </div>
    ${!c && html`<p class="hint center">Создайте персонажа, чтобы добавлять записи в лист.</p>`}
  </div>`;
}

export function SpellBody({ s }) {
  const cls = (s.classes || []).map(k => SPELL_CLASSES[k] || k).join(', ');
  return html`<div>
    <div class="lead">${spellMeta(s)}</div>
    <dl class="kv"><dt>Время</dt><dd>${s.time}</dd><dt>Дистанция</dt><dd>${s.range}</dd><dt>Компоненты</dt><dd>${s.components}</dd><dt>Длительность</dt><dd>${s.duration}</dd>${cls && html`<dt>Классы</dt><dd>${cls}</dd>`}</dl>
    <hr class="divider" />
    <${Prose} text=${s.text} />
    ${s.higher && html`<p><b class="gold-t">${s.level === 0 ? 'Усиление заговора. ' : 'На больших кругах. '}</b>${s.higher}</p>`}
    <${DiceLinks} text=${s.text + ' ' + (s.higher || '')} label=${s.name} />
  </div>`;
}

// Находит в тексте формулы вида 3к6, 1к8+2 и делает из них кнопки броска
export function DiceLinks({ text, label }) {
  const found = [...new Set((String(text).match(/\d+к\d+(?:\s?[+−-]\s?\d+)?/g) || []).map(s => s.replace(/\s/g, '')))].slice(0, 8);
  if (!found.length) return null;
  return html`<div class="row wrapr mt">${found.map(f => html`<button class="chip gold" onClick=${() => roll(f.replace('−', '-'), { label })}><${Icon} n="dices" cls="xs" /> ${f}</button>`)}</div>`;
}

const entryList = (arr) => (arr || []).map(([n, t]) => html`<p class="entry"><b>${n}.</b> ${t}</p>`);
const parseEntries = (text) => String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('. '); return i > 0 && i < 60 ? [l.slice(0, i), l.slice(i + 2)] : ['', l]; });

export function MonsterBody({ m }) {
  const traits = m.traits || parseEntries(m.traitsText);
  const actions = m.actions || parseEntries(m.actionsText);
  const xp = m.xp || CR_XP[m.cr];
  return html`<div>
    <div class="lead">${SIZES[m.size] || m.size} ${m.type}, ${m.align || 'без мировоззрения'}</div>
    <div class="statblock">
      <dl class="kv"><dt>Класс доспеха</dt><dd>${m.ac}${m.acNote ? ` (${m.acNote})` : ''}</dd><dt>Хиты</dt><dd>${m.hp}${m.hd ? ` (${m.hd})` : ''} ${m.hd ? html`<button class="chip" onClick=${() => roll(m.hd.replace('−', '-').replace(/к/g, 'd'), { label: m.name + ': хиты' })}>бросить</button>` : ''}</dd><dt>Скорость</dt><dd>${m.speed}</dd></dl>
      <div class="abrow">${ABILITIES.map((a, i) => html`<button style="background:none;border:0;padding:0" onClick=${() => roll(`1d20${fmt(mod(m.ab[i])).replace('−', '-')}`, { label: `${m.name}: ${a.name}` })}><b>${a.short}</b><span>${m.ab[i]} (${fmt(mod(m.ab[i]))})</span></button>`)}</div>
      <dl class="kv">
        ${m.saves && html`<dt>Спасброски</dt><dd>${m.saves}</dd>`}${m.skills && html`<dt>Навыки</dt><dd>${m.skills}</dd>`}
        ${m.vuln && html`<dt>Уязвимость</dt><dd>${m.vuln}</dd>`}${m.res && html`<dt>Сопротивление</dt><dd>${m.res}</dd>`}
        ${m.imm && html`<dt>Иммунитет к урону</dt><dd>${m.imm}</dd>`}${m.cimm && html`<dt>Иммунитет к состояниям</dt><dd>${m.cimm}</dd>`}
        ${m.senses && html`<dt>Чувства</dt><dd>${m.senses}</dd>`}${m.lang && html`<dt>Языки</dt><dd>${m.lang}</dd>`}
        <dt>Опасность</dt><dd>${m.cr}${xp ? ` (${xp} опыта)` : ''}</dd>
      </dl>
    </div>
    ${traits.length ? entryList(traits) : ''}
    ${actions.length ? html`<div class="sbhead">Действия</div>${entryList(actions)}` : ''}
    ${m.reactions && m.reactions.length ? html`<div class="sbhead">Реакции</div>${entryList(m.reactions)}` : ''}
    ${m.legendary && m.legendary.length ? html`<div class="sbhead">Легендарные действия</div><p class="small muted">Может совершить 3 легендарных действия, по одному в конце хода другого существа.</p>${entryList(m.legendary)}` : ''}
    ${m.notes && html`<${Prose} text=${m.notes} />`}
    <${DiceLinks} text=${actions.map(a => a[1]).join(' ')} label=${m.name} />
  </div>`;
}

export function ItemBody({ x }) {
  return html`<div>
    <div class="lead">${itemMeta(x)}</div>
    <dl class="kv">
      ${x.sub === 'weapon' && html`<dt>Урон</dt><dd>${x.dmg} ${x.dtype}</dd><dt>Свойства</dt><dd>${x.props || '—'}</dd>${x.mastery && html`<dt>Мастерство (2024)</dt><dd><b>${x.mastery}.</b> ${MASTERY[x.mastery] || ''}</dd>`}`}
      ${x.sub === 'armor' && html`<dt>КД</dt><dd>${x.ac}</dd>${x.str ? html`<dt>Сила</dt><dd>${x.str}+ (иначе скорость −10 фт)</dd>` : ''}<dt>Скрытность</dt><dd>${x.stealth ? 'помеха' : '—'}</dd>${x.don && html`<dt>Надеть</dt><dd>${x.don}</dd>`}`}
      ${x.type && x.sub !== 'armor' && html`<dt>Тип</dt><dd>${x.type}</dd>`}
      ${x.rarity && html`<dt>Редкость</dt><dd>${x.rarity}</dd>`}
      ${x.attune ? html`<dt>Настройка</dt><dd>требуется</dd>` : ''}
      ${x.cost && html`<dt>Цена</dt><dd>${x.cost}</dd>`}
      ${x.weight ? html`<dt>Вес</dt><dd>${x.weight} фнт</dd>` : ''}
    </dl>
    ${x.desc && html`<hr class="divider" /><${Prose} text=${x.desc} />`}
    <${DiceLinks} text=${(x.dmg || '') + ' ' + (x.desc || '')} label=${x.name} />
  </div>`;
}

// ===================== ДОБАВЛЕНИЕ В ПЕРСОНАЖА =====================
export function addSpellToChar(s) {
  const c = activeChar(); if (!c) return toast('Сначала создайте персонажа', 'bad');
  if (c.magic.spells.some(x => x.ref === s.id)) return toast(`«${s.name}» уже в листе`);
  updChar(ch => { ch.magic.spells.push({ id: uid(), ref: s.id, prepared: s.level === 0 }); });
  toast(`«${s.name}» добавлено в заклинания ${c.name}`, 'good');
}

const SUB2CAT = { weapon: 'weapon', armor: 'armor', potion: 'potion', magic: 'magic', gear: 'gear' };
export function addItemToChar(x, qty = 1) {
  const c = activeChar(); if (!c) return toast('Сначала создайте персонажа', 'bad');
  const existing = c.inv.items.find(i => i.ref === x.id && (x.sub === 'potion' || x.sub === 'gear'));
  updChar(ch => {
    if (existing) { const it = ch.inv.items.find(i => i.id === existing.id); it.qty = (Number(it.qty) || 0) + qty; return; }
    ch.inv.items.push({
      id: uid(), ref: x.id, name: x.name, qty, weight: Number(x.weight) || 0, cat: SUB2CAT[x.sub] || 'other',
      location: x.sub === 'weapon' || x.sub === 'armor' ? 'carried' : 'backpack', equipped: false, attuned: false,
      cost: x.cost || '', notes: x.sub === 'weapon' ? `${x.dmg} ${x.dtype}; ${x.props}` : x.sub === 'armor' ? `КД ${x.ac}` : (x.desc || ''),
      armor: x.sub === 'armor' ? { type: x.type, base: x.base, dexMax: x.dexMax, stealth: x.stealth } : null,
    });
  });
  toast(`«${x.name}» в сумке${existing ? ' (+' + qty + ')' : ''}`, 'good');
}

export function addAttackFromWeapon(x) {
  const c = activeChar(); if (!c) return;
  const finesse = /фехтовальное/.test(x.props); const ranged = x.cat === 'sr' || x.cat === 'mr';
  updChar(ch => ch.attacks.push({ id: uid(), name: x.name, ability: ranged ? 'dex' : finesse ? 'best' : 'str', prof: true, bonus: 0, dmg: String(x.dmg).split(' ')[0], dmgBonus: true, dtype: x.dtype, range: (x.props.match(/\((\d+\/\d+)\)/) || [])[1] || '5 фт', notes: x.props + (x.mastery ? `; мастерство: ${x.mastery}` : '') }));
  toast(`Атака «${x.name}» добавлена`, 'good');
}

export function addCompanion(m) {
  const c = activeChar(); if (!c) return toast('Сначала создайте персонажа', 'bad');
  updChar(ch => ch.companions.push({ id: uid(), ref: m.id, name: m.name, kind: `${SIZES[m.size] || ''} ${m.type}`.trim(), ac: m.ac, hp: { max: m.hp, current: m.hp, temp: 0 }, speed: m.speed, ab: [...m.ab], notes: '', image: '' }));
  toast(`${m.name} теперь ваш спутник`, 'good');
}

// ===================== СВОИ ЗАПИСИ =====================
const CAT2STORE = { spells: 'spells', monsters: 'monsters' };
function deleteCustom(cat, id) {
  const key = CAT2STORE[cat] || 'items';
  setState(s => { s.custom[key] = s.custom[key].filter(x => x.id !== id); return s; });
  toast('Запись удалена');
}

// Поделиться одной своей записью: JSON-файл, который другой пользователь импортирует кнопкой рядом с «Своя запись»
async function shareEntry(cat, x) {
  await saveTextFile(`${String(x.name || 'zapis').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40)}.dnd-entry.json`,
    JSON.stringify({ app: 'dnd-companion-entry', version: 1, cat, entry: x }, null, 1));
  toast('Файл записи создан — отправьте его другу', 'good');
}
export async function importEntryFile() {
  const f = await pickFile('.json,application/json,text/plain'); if (!f) return;
  try {
    const d = JSON.parse(await readText(f));
    if (d.app !== 'dnd-companion-entry' || !d.entry || !d.entry.name) throw new Error('Файл не похож на запись этого приложения');
    const e = d.entry; const kind = e.kind || (d.cat === 'spells' ? 'spell' : d.cat === 'monsters' ? 'monster' : 'item');
    const key = kind === 'spell' ? 'spells' : kind === 'monster' ? 'monsters' : 'items';
    setState(s => {
      const arr = s.custom[key];
      if (arr.some(x => x.id === e.id)) e.id = 'c-' + uid(); // уже есть такая — сохраняем как копию
      e.custom = true;
      arr.unshift(e);
      return s;
    });
    toast(`Запись «${e.name}» добавлена в справочник`, 'good');
  } catch (err) { toast(err.message || 'Не удалось прочитать файл', 'bad'); }
}

export function openCustomEditor(cat, existing) {
  openModal(close => html`<${CustomEditor} cat=${cat} existing=${existing} close=${close} />`, { title: existing ? 'Редактирование' : 'Новая запись', full: true });
}

const CAT2SUB = { weapons: 'weapon', armor: 'armor', gear: 'gear', potions: 'potion', magic: 'magic' };
function CustomEditor({ cat, existing, close }) {
  const blank = cat === 'spells' ? { name: '', en: '', level: 1, school: 'evocation', time: '1 действие', range: '30 фт', components: 'В, С', duration: 'Мгновенная', concentration: false, ritual: false, classes: [], text: '', higher: '' }
    : cat === 'monsters' ? { name: '', en: '', size: 'M', type: 'чудовище', align: '', ac: 12, acNote: '', hp: 10, hd: '', speed: '30 фт', ab: [10, 10, 10, 10, 10, 10], cr: '1', saves: '', skills: '', senses: '', lang: '', res: '', imm: '', traitsText: '', actionsText: '' }
      : { name: '', en: '', sub: CAT2SUB[cat] || 'gear', cost: '', weight: 0, desc: '', dmg: '1к6', dtype: 'рубящий', props: '', cat: 'sm', type: cat === 'armor' ? 'light' : '', ac: '11 + мод. Ловкости', base: 11, dexMax: 99, rarity: cat === 'potions' || cat === 'magic' ? 'необычное' : '' };
  const [d, setD] = useState(() => ({ ...blank, ...(existing || {}) }));
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const save = () => {
    if (!d.name.trim()) return toast('Укажите название', 'bad');
    const rec = { ...d, id: existing ? existing.id : 'c-' + uid(), kind: cat === 'spells' ? 'spell' : cat === 'monsters' ? 'monster' : 'item', custom: true };
    if (cat === 'spells') rec.level = Number(rec.level) || 0;
    if (cat === 'monsters') { delete rec.traits; delete rec.actions; }
    const key = CAT2STORE[cat] || 'items';
    setState(st => { const arr = st.custom[key]; const i = arr.findIndex(x => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.unshift(rec); return st; });
    toast(existing ? 'Сохранено' : 'Запись добавлена в справочник', 'good'); close();
  };
  let form;
  if (cat === 'spells') form = html`
    <div class="grid2"><${Field} label="Круг"><${Select} value=${String(d.level)} onChange=${v => s('level')(Number(v))} options=${[...Array(10).keys()].map(n => [String(n), levelName(n)])} /><//>
    <${Field} label="Школа"><${Select} value=${d.school} onChange=${s('school')} options=${Object.entries(SCHOOLS)} /><//></div>
    <div class="grid2 mt"><${Field} label="Время накладывания"><${TextIn} value=${d.time} onChange=${s('time')} /><//><${Field} label="Дистанция"><${TextIn} value=${d.range} onChange=${s('range')} /><//></div>
    <div class="grid2 mt"><${Field} label="Компоненты"><${TextIn} value=${d.components} onChange=${s('components')} /><//><${Field} label="Длительность"><${TextIn} value=${d.duration} onChange=${s('duration')} /><//></div>
    <div class="row mt"><label class="check"><input type="checkbox" checked=${d.concentration} onChange=${e => s('concentration')(e.target.checked)} /> Концентрация</label><label class="check"><input type="checkbox" checked=${d.ritual} onChange=${e => s('ritual')(e.target.checked)} /> Ритуал</label></div>
    <${Field} label="Классы" cls="mt"><div class="row wrapr">${Object.entries(SPELL_CLASSES).map(([k, n]) => html`<button class=${'chip' + (d.classes.includes(k) ? ' gold' : '')} onClick=${() => s('classes')(d.classes.includes(k) ? d.classes.filter(x => x !== k) : [...d.classes, k])}>${n}</button>`)}</div><//>
    <${Field} label="Описание" cls="mt"><${Area} rows=${7} value=${d.text} onChange=${s('text')} placeholder="Эффект заклинания. Кости вида 3к6 станут кнопками броска." /><//>
    <${Field} label="На больших кругах" cls="mt"><${Area} rows=${2} value=${d.higher} onChange=${s('higher')} /><//>`;
  else if (cat === 'monsters') form = html`
    <div class="grid3"><${Field} label="Размер"><${Select} value=${d.size} onChange=${s('size')} options=${Object.entries(SIZES)} /><//><${Field} label="Тип"><${TextIn} value=${d.type} onChange=${s('type')} /><//><${Field} label="Опасность"><${TextIn} value=${d.cr} onChange=${s('cr')} /><//></div>
    <div class="grid3 mt"><${Field} label="КД"><${NumIn} value=${d.ac} onChange=${s('ac')} /><//><${Field} label="Хиты"><${NumIn} value=${d.hp} onChange=${s('hp')} /><//><${Field} label="Кость хитов"><${TextIn} value=${d.hd} onChange=${s('hd')} placeholder="2к8+2" /><//></div>
    <div class="grid2 mt"><${Field} label="Скорость"><${TextIn} value=${d.speed} onChange=${s('speed')} /><//><${Field} label="Мировоззрение"><${TextIn} value=${d.align} onChange=${s('align')} /><//></div>
    <div class="grid6 mt">${ABILITIES.map((a, i) => html`<${Field} label=${a.short}><${NumIn} value=${d.ab[i]} onChange=${v => s('ab')(d.ab.map((x, j) => j === i ? v : x))} /><//>`)}</div>
    <div class="grid2 mt"><${Field} label="Спасброски"><${TextIn} value=${d.saves} onChange=${s('saves')} /><//><${Field} label="Навыки"><${TextIn} value=${d.skills} onChange=${s('skills')} /><//></div>
    <div class="grid2 mt"><${Field} label="Сопротивления"><${TextIn} value=${d.res} onChange=${s('res')} /><//><${Field} label="Иммунитеты"><${TextIn} value=${d.imm} onChange=${s('imm')} /><//></div>
    <div class="grid2 mt"><${Field} label="Чувства"><${TextIn} value=${d.senses} onChange=${s('senses')} /><//><${Field} label="Языки"><${TextIn} value=${d.lang} onChange=${s('lang')} /><//></div>
    <${Field} label="Особенности (по строке: «Название. Описание»)" cls="mt"><${Area} rows=${4} value=${d.traitsText} onChange=${s('traitsText')} /><//>
    <${Field} label="Действия (по строке: «Название. Описание»)" cls="mt"><${Area} rows=${5} value=${d.actionsText} onChange=${s('actionsText')} placeholder="Укус. Рукопашная атака: +4 к попаданию. Попадание: 7 (2к4+2) колющего урона." /><//>`;
  else form = html`
    <div class="grid2"><${Field} label="Цена"><${TextIn} value=${d.cost} onChange=${s('cost')} placeholder="10 зм" /><//><${Field} label="Вес, фнт"><${NumIn} value=${d.weight} onChange=${s('weight')} step="0.5" /><//></div>
    ${d.sub === 'weapon' && html`<div class="grid3 mt"><${Field} label="Категория"><${Select} value=${d.cat} onChange=${s('cat')} options=${Object.entries(WEAPON_CATS)} /><//><${Field} label="Урон"><${TextIn} value=${d.dmg} onChange=${s('dmg')} /><//><${Field} label="Вид урона"><${TextIn} value=${d.dtype} onChange=${s('dtype')} /><//></div>
      <${Field} label="Свойства" cls="mt"><${TextIn} value=${d.props} onChange=${s('props')} placeholder="лёгкое, фехтовальное" /><//>`}
    ${d.sub === 'armor' && html`<div class="grid3 mt"><${Field} label="Тип"><${Select} value=${d.type} onChange=${s('type')} options=${Object.entries(ARMOR_TYPES)} /><//><${Field} label="Базовый КД"><${NumIn} value=${d.base} onChange=${v => setD(o => ({ ...o, base: v, ac: o.type === 'shield' ? '+' + v : String(v) }))} /><//><${Field} label="Макс. Ловк."><${NumIn} value=${d.dexMax} onChange=${s('dexMax')} /><//></div>`}
    ${(d.sub === 'potion' || d.sub === 'magic') && html`<div class="grid2 mt"><${Field} label="Редкость"><${Select} value=${d.rarity} onChange=${s('rarity')} options=${['обычное', 'необычное', 'редкое', 'очень редкое', 'легендарное', 'артефакт']} /><//><${Field} label="Тип"><${TextIn} value=${d.type} onChange=${s('type')} placeholder="чудесный предмет" /><//></div>
      ${d.sub === 'magic' && html`<label class="check mt"><input type="checkbox" checked=${!!d.attune} onChange=${e => s('attune')(e.target.checked)} /> Требует настройки</label>`}`}
    <${Field} label="Описание" cls="mt"><${Area} rows=${6} value=${d.desc} onChange=${s('desc')} /><//>`;
  return html`<div>
    <div class="grid2"><${Field} label="Название"><${TextIn} value=${d.name} onChange=${s('name')} /><//><${Field} label="Англ. название"><${TextIn} value=${d.en} onChange=${s('en')} /><//></div>
    <div class="mt">${form}</div>
    <div class="row mt2"><button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}><${Icon} n="check" cls="s" /> Сохранить</button></div>
  </div>`;
}
