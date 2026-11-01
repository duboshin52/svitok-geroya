// Происхождение и развитие персонажа: класс, навыки, подкласс, раса, предыстория, умения класса, выборы класса
import { useState } from 'preact/hooks';
import { html, pickOne, openModal, Icon, Prose } from './ui.js';
import { activeChar, updChar, uid, toast, getState } from './store.js';
import { CLASSES, CLASS_NAMES, ABILITIES, ABIL, fmt, skillsFor, levelName } from './rules.js';
import { racesFor, BACKGROUND_NAMES, findBackground, ALIGNMENTS, OLD_CLASSES, FEATS } from './data/origins.js';
import { CLASS_DATA, CLASS_OPTIONS, SUBCLASS_DATA, RES } from './data/classes.js';
import { bookAllowed } from './data/books.js';

const isModern = (ed) => ed === '5e' || ed === '2024';
const SKILL_NAME = Object.fromEntries(skillsFor('5e').map(s => [s.key, s.name]));
const abText = (ab) => Object.entries(ab || {}).filter(([k]) => ABIL[k]).map(([k, v]) => `${ABIL[k].short} ${fmt(v)}`).join(', ');
const firstSentence = (t) => String(t || '').split(/(?<=\.)\s/)[0];
const modal = (title, render, full = true) => new Promise(res => openModal(close => render((v) => { close(); res(v); }), { title, full }));

// ===================== КЛАСС =====================
export function classOptions(ed) {
  if (isModern(ed)) return CLASS_NAMES.map(n => { const d = CLASS_DATA[n] || {}; return { value: n, label: n, hint: `к${CLASSES[n].hd} · ${d.primary || ''}${d.desc ? ' — ' + firstSentence(d.desc) : ''}` }; });
  return (OLD_CLASSES[ed] || []).map(([n, hd]) => ({ value: n, label: n, hint: hd ? `Кость хитов к${hd}` : '' }));
}

// Выбор класса с карточкой описания
export async function pickClass(ed, current) {
  for (;;) {
    const v = await pickOne({ title: 'Класс', options: classOptions(ed), value: current, customPlaceholder: 'Свой класс' });
    if (v == null || v === '' || !CLASS_DATA[v] || !isModern(ed)) return v;
    const ok = await modal(v, (done) => html`<${ClassInfo} name=${v} ed=${ed} done=${done} />`);
    if (ok) return v;
  }
}
function ClassInfo({ name, ed, done }) {
  const d = CLASS_DATA[name]; const def = CLASSES[name] || {};
  const feats = d.features.filter(f => f[0] <= 3 && (!f[4] || f[4] === ed));
  return html`<div>
    <div class="small muted">${d.en} · кость хитов к${d.hd} · ${d.primary}</div>
    <p>${d.desc}</p>
    <dl class="kv">
      <dt>Спасброски</dt><dd>${d.saves.map(s => ABIL[s].name).join(', ')}</dd>
      <dt>Доспехи</dt><dd>${d.armor}</dd><dt>Оружие</dt><dd>${d.weapons}</dd>
      ${d.tools && d.tools !== '—' && html`<dt>Инструменты</dt><dd>${d.tools}</dd>`}
      <dt>Навыки</dt><dd>${d.skills.n} на выбор${d.skills.from === 'any' ? ' из любых' : ': ' + d.skills.from.map(k => SKILL_NAME[k]).join(', ')}</dd>
      <dt>${d.subTitle}</dt><dd>с ${d.sub[ed === '2024' ? '2024' : '5e']} уровня</dd>
      ${def.caster && html`<dt>Магия</dt><dd>${def.caster === 'full' ? 'полный заклинатель' : def.caster === 'half' || def.caster === 'artificer' ? 'полузаклинатель' : def.caster === 'pact' ? 'магия договора' : 'в подклассе'}${def.spell ? ' (' + ABIL[def.spell].name + ')' : ''}</dd>`}
    </dl>
    <div class="lbl mt">Умения 1–3 уровня</div>
    ${feats.map(f => html`<p class="entry small"><b>${f[0]} ур. ${f[1]}.</b> ${f[2]}</p>`)}
    <div class="row mt"><button class="btn grow" onClick=${() => done(false)}>Назад</button><button class="btn gold grow" onClick=${() => done(true)}><${Icon} n="check" cls="s" /> Выбрать ${name}</button></div>
  </div>`;
}

export function setClass(ch, i, name) {
  ch.classes[i].name = name;
  ch.classes[i].subclass = '';
  const def = CLASSES[name]; const d = CLASS_DATA[name];
  if (!def) { const old = (OLD_CLASSES[ch.edition] || []).find(x => x[0] === name); if (old && old[1]) ch.classes[i].hd = old[1]; }
  if (i === 0 && def && isModern(ch.edition)) {
    ch.saveProf = {}; for (const s of def.saves) ch.saveProf[s] = true;
    ch.magic.ability = def.spell || '';
    if (d) { ch.prof.armor = d.armor; ch.prof.weapons = d.weapons; if (d.tools && d.tools !== '—') ch.prof.tools = d.tools; }
  }
  syncClassFeatures(ch);
}

export async function pickSubclass(cls, current) {
  const list = (SUBCLASS_DATA[cls] || []).filter(x => bookAllowed(x[1]));
  return pickOne({ title: (CLASS_DATA[cls] || {}).subTitle || 'Подкласс', options: list.map(([n, src, t]) => ({ value: n, label: n, hint: `${src}${t ? ' · ' + t : ''}` })), value: current, customPlaceholder: 'Свой подкласс' });
}
export const subclassLevel = (cls, ed) => ((CLASS_DATA[cls] || {}).sub || {})[ed === '2024' ? '2024' : '5e'] || 3;

// ===================== НАВЫКИ =====================
// Выбор n навыков из списка; taken — уже есть владение (показываются отмеченными и недоступными)
export function chooseSkills({ title, n, from, taken = [] }) {
  const all = skillsFor('5e');
  const pool = from === 'any' ? all : all.filter(s => from.includes(s.key));
  return modal(title, (done) => html`<${SkillChooser} n=${n} pool=${pool} taken=${taken} done=${done} />`);
}
function SkillChooser({ n, pool, taken, done }) {
  const [sel, setSel] = useState([]);
  const toggle = (k) => setSel(s => s.includes(k) ? s.filter(x => x !== k) : s.length < n ? [...s, k] : s);
  return html`<div>
    <p class="muted small" style="margin-top:0">Выберите ${n}: отмечено ${sel.length} из ${n}. Уже имеющиеся владения недоступны.</p>
    ${pool.map(s => { const has = taken.includes(s.key); const on = sel.includes(s.key); return html`<button class="menu-item" disabled=${has} style=${has ? 'opacity:.45' : ''} onClick=${() => toggle(s.key)}>
      <span class=${'dot' + (on || has ? ' on' : '')}></span><span class="grow">${s.name}</span><span class="tiny faint">${ABIL[s.ab].short}</span></button>`; })}
    <div class="row mt"><button class="btn grow" onClick=${() => done([])}>Пропустить</button><button class="btn gold grow" disabled=${sel.length < Math.min(n, pool.filter(p => !taken.includes(p.key)).length)} onClick=${() => done(sel)}>Готово</button></div>
  </div>`;
}
const profSkills = (c) => Object.entries(c.skills || {}).filter(([, v]) => Number(v) > 0).map(([k]) => k);
function grantSkills(ch, keys, srcTag) {
  ch.skillSrc = ch.skillSrc || {};
  for (const k of keys) { if (!Number(ch.skills[k])) { ch.skills[k] = 1; ch.skillSrc[k] = srcTag; } }
}
function revokeSkills(ch, srcTag) {
  for (const [k, v] of Object.entries(ch.skillSrc || {})) if (v === srcTag) { if (Number(ch.skills[k]) === 1) ch.skills[k] = 0; delete ch.skillSrc[k]; }
}

// ===================== ГИБКИЕ БОНУСЫ ХАРАКТЕРИСТИК =====================
// allowed — допустимые характеристики; patterns — варианты распределения, например [[2,1],[1,1,1]]
function chooseASI({ title, allowed, intro, patterns = [[2, 1], [1, 1, 1]] }) {
  return modal(title, (done) => html`<${ASIChooser} allowed=${allowed} intro=${intro} patterns=${patterns} done=${done} />`, false);
}
function ASIChooser({ allowed, intro, patterns, done }) {
  const keys = allowed || ABILITIES.map(a => a.key);
  const usable = patterns.filter(p => p.length <= keys.length);
  const [pi, setPi] = useState(0);
  const pat = usable[pi] || usable[0];
  const [sel, setSel] = useState(keys.slice(0, 3));
  const picks = pat.map((_, i) => sel[i] || keys[i]);
  const valid = new Set(picks).size === picks.length;
  const result = valid ? Object.fromEntries(picks.map((k, i) => [k, pat[i]])) : null;
  return html`<div>
    ${intro && html`<p class="muted small" style="margin-top:0">${intro}</p>`}
    ${usable.length > 1 && html`<div class="pill-toggle mb">${usable.map((p, i) => html`<button class=${i === pi ? 'on' : ''} onClick=${() => setPi(i)}>${p.map(x => '+' + x).join(' ')}</button>`)}</div>`}
    <div class=${pat.length === 3 ? 'grid3' : 'grid2'}>${pat.map((v, i) => html`<div class="field"><label>+${v}</label>
      <select class="inp" value=${picks[i]} onChange=${e => setSel(s => { const n = [...s]; n[i] = e.target.value; return n; })}>${keys.map(k => html`<option value=${k}>${ABIL[k].name}</option>`)}</select></div>`)}</div>
    ${!valid && html`<p class="hint red-t">Выберите разные характеристики.</p>`}
    <div class="row mt"><button class="btn grow" onClick=${() => done(null)}>Без бонусов</button><button class="btn gold grow" disabled=${!valid} onClick=${() => done(result)}>Применить</button></div>
  </div>`;
}
function applyBonus(ch, bonus, sign = 1) { for (const [k, v] of Object.entries(bonus || {})) ch.abilities[k] = (Number(ch.abilities[k]) || 0) + sign * v; }

// ===================== РАСА =====================
export async function pickRace(onDone) {
  const c = activeChar(); if (!c) return;
  const races = racesFor(c.edition).filter(r => bookAllowed(r.src || (c.edition === '2024' ? 'PHB24' : 'PHB')));
  const opts = races.map(r => ({ value: r.id, label: r.name, group: r.src ? 'Другие книги' : (c.edition === '2024' ? 'Книга игрока 2024' : 'Книга игрока'),
    hint: isModern(c.edition) ? [r.src, r.size !== 'Средний' ? r.size : '', `скорость ${r.speed} фт`, r.flex && c.edition === '5e' ? '+2/+1 на выбор' : (r.abText || abText(r.ab)), r.subs.length ? `${r.subs.length} вар.` : ''].filter(Boolean).join(' · ') : '' }));
  const id = await pickOne({ title: c.edition === '2024' ? 'Вид (раса)' : 'Раса', options: opts, value: (c.raceRef || {}).id, customPlaceholder: 'Своя раса' });
  if (id == null) return;
  if (id === '') { updChar(ch => { clearRace(ch); ch.race = ''; }); onDone && onDone(); return; }
  const race = races.find(r => r.id === id);
  if (!race) { updChar(ch => { clearRace(ch); ch.race = id; }); onDone && onDone(); return; }
  let sub = null;
  if (race.subs.length) {
    const sid = await pickOne({ title: race.name + ': вариант', options: race.subs.map(s => ({ value: s.id, label: s.name, hint: [abText(s.ab), (s.traits || []).map(t => t[0]).join(', ')].filter(Boolean).join(' · ') })), value: (c.raceRef || {}).sub, custom: false });
    if (sid == null) return;
    sub = race.subs.find(s => s.id === sid) || null;
  }
  if (!isModern(c.edition)) { updChar(ch => { clearRace(ch); ch.race = race.name; ch.raceRef = { ed: c.edition, id: race.id }; }); onDone && onDone(); return; }
  const ok = await modal(sub ? sub.name : race.name, (done) => html`<${RaceInfo} race=${race} sub=${sub} done=${done} />`);
  if (!ok) return;
  // Бонусы характеристик
  let bonus = null;
  const fixed = { ...race.ab, ...((sub && sub.ab) || {}) }; const variant = sub && sub.ab && sub.ab._all === 0; delete fixed._all;
  if (c.edition === '5e') {
    if (race.flex) bonus = await chooseASI({ title: 'Бонусы характеристик', intro: 'Гибкие бонусы расы («Монстры Мультивселенной» / правило «Таши»).' });
    else if (variant) bonus = await chooseASI({ title: 'Человек (вариант)', intro: '+1 к двум разным характеристикам.', patterns: [[1, 1]] });
    else if (Object.keys(fixed).length) {
      bonus = { ...fixed };
      if (race.flexExtra) { const extra = await chooseASI({ title: 'Ещё +1 и +1', allowed: ABILITIES.map(a => a.key).filter(k => !fixed[k]), intro: '+1 к двум другим характеристикам.', patterns: [[1, 1]] }); if (extra) for (const [k, v] of Object.entries(extra)) bonus[k] = (bonus[k] || 0) + v; }
    }
  }
  // Навыки
  const fixedSkills = [...(race.skills || []), ...((sub && sub.skills) || [])];
  const choice = (sub && sub.skillChoice) || race.skillChoice;
  let chosen = [];
  if (choice) chosen = await chooseSkills({ title: `Навыки расы: ${choice.n}`, n: choice.n, from: choice.from, taken: [...profSkills(activeChar()), ...fixedSkills] });
  const traits = [...race.traits, ...((sub && sub.traits) || [])];
  const speed = (sub && sub.speed) || race.speed;
  updChar(ch => {
    clearRace(ch);
    ch.race = sub ? sub.name : race.name;
    ch.speed = speed;
    ch.prof.languages = race.langs;
    if (bonus) applyBonus(ch, bonus);
    grantSkills(ch, [...fixedSkills, ...(chosen || [])], 'race');
    ch.raceRef = { ed: race.ed, id: race.id, sub: sub ? sub.id : null, bonus };
    for (const [n, t] of traits) ch.features.push({ id: uid(), name: n, source: ch.race, text: t, max: 0, used: 0, reset: 'long', fromRace: true, cat: 'race' });
  });
  toast(`Раса: ${sub ? sub.name : race.name}`, 'good'); onDone && onDone();
}
function clearRace(ch) {
  if (ch.raceRef && ch.raceRef.bonus) applyBonus(ch, ch.raceRef.bonus, -1);
  revokeSkills(ch, 'race');
  ch.features = ch.features.filter(f => !f.fromRace);
  ch.raceRef = null;
}
function RaceInfo({ race, sub, done }) {
  const traits = [...race.traits, ...((sub && sub.traits) || [])];
  const skills = [...(race.skills || []), ...((sub && sub.skills) || [])];
  const ch = (sub && sub.skillChoice) || race.skillChoice;
  return html`<div>
    <div class="small muted">${race.src ? race.src + ' · ' : ''}${race.size} · скорость ${(sub && sub.speed) || race.speed} фт · языки: ${race.langs}</div>
    <div class="row wrapr mt">
      ${race.ed === '5e' && race.flex ? html`<span class="chip gold">+2 и +1 на выбор</span>` : abText({ ...race.ab, ...((sub && sub.ab) || {}) }) ? html`<span class="chip gold">${race.abText || abText({ ...race.ab, ...((sub && sub.ab) || {}) })}</span>` : ''}
      ${race.ed === '2024' && html`<span class="chip">Бонусы характеристик даёт предыстория</span>`}
      ${skills.map(k => html`<span class="chip blue">${SKILL_NAME[k]}</span>`)}${ch && html`<span class="chip blue">+${ch.n} навык(а) на выбор</span>`}
    </div>
    <div class="mt">${traits.map(([n, t]) => html`<p class="entry small"><b>${n}.</b> ${t}</p>`)}</div>
    <p class="hint">Скорость, языки, навыки и бонусы подставятся в лист, особенности — во вкладку «Умения». При смене расы всё старое уберётся.</p>
    <div class="row mt"><button class="btn grow" onClick=${() => done(false)}>Назад</button><button class="btn gold grow" onClick=${() => done(true)}><${Icon} n="check" cls="s" /> Выбрать</button></div>
  </div>`;
}

// ===================== ПРЕДЫСТОРИЯ =====================
export async function pickBackground(ed, current, apply = true) {
  const names = BACKGROUND_NAMES[ed === '2024' ? '2024' : '5e'];
  const opts = names.map(n => { const b = findBackground(ed, n); return { value: n, label: n, hint: b ? [b.abil ? b.abil.map(k => ABIL[k].short).join(', ') : '', b.skills.map(k => SKILL_NAME[k]).join(', ') + (b.choice ? ` + ${b.choice.n} на выбор` : ''), b.feat ? 'черта: ' + b.feat : ''].filter(Boolean).join(' · ') : '' }; });
  const v = await pickOne({ title: 'Предыстория', options: opts, value: current, customPlaceholder: 'Своя предыстория' });
  if (v == null || !apply) return v;
  const b = findBackground(ed, v);
  if (!isModern(ed) || !b) { updChar(ch => { clearBackground(ch); ch.background = v; }); return v; }
  // 2024: бонусы характеристик
  let bonus = null;
  if (ed === '2024' && b.abil) bonus = await chooseASI({ title: 'Бонусы предыстории', allowed: b.abil, intro: `${v}: +2 и +1 или +1 к каждой из: ${b.abil.map(k => ABIL[k].name).join(', ')}.` });
  let chosen = [];
  const c = activeChar();
  if (b.choice) chosen = await chooseSkills({ title: 'Навыки предыстории', n: b.choice.n, from: b.choice.from, taken: [...profSkills(c), ...b.skills] });
  // Пересечение навыков (5e): если навык уже есть, даём выбрать замену
  const dup = b.skills.filter(k => profSkills(c).includes(k) && (c.skillSrc || {})[k] !== 'bg');
  let repl = [];
  if (dup.length) repl = await chooseSkills({ title: `Замена повторяющихся навыков: ${dup.length}`, n: dup.length, from: 'any', taken: [...profSkills(c), ...b.skills, ...chosen] });
  updChar(ch => {
    clearBackground(ch);
    ch.background = v;
    if (bonus) applyBonus(ch, bonus);
    grantSkills(ch, [...b.skills, ...chosen, ...repl], 'bg');
    if (b.tools) ch.prof.tools = [ch.prof.tools, b.tools].filter(Boolean).join('; ');
    ch.bgRef = { name: v, bonus };
    if (b.feat) { const f = FEATS.find(x => b.feat.startsWith(x[0])); ch.features.push({ id: uid(), name: b.feat, source: 'Предыстория: ' + v, text: f ? f[2] : 'Черта происхождения.', max: 0, used: 0, reset: 'long', fromBg: true, cat: 'feat' }); }
  });
  toast(`Предыстория: ${v}`, 'good');
  return v;
}
function clearBackground(ch) {
  if (ch.bgRef && ch.bgRef.bonus) applyBonus(ch, ch.bgRef.bonus, -1);
  revokeSkills(ch, 'bg');
  ch.features = ch.features.filter(f => !f.fromBg);
  ch.bgRef = null;
}
export async function pickAlignment(current) { return pickOne({ title: 'Мировоззрение', options: ALIGNMENTS, value: current }); }

// ===================== УМЕНИЯ КЛАССА ПО УРОВНЯМ =====================
export function syncClassFeatures(ch) {
  const ed = ch.edition === '2024' ? '2024' : '5e';
  if (!isModern(ch.edition)) return;
  const want = new Map();
  for (const k of ch.classes || []) {
    const d = CLASS_DATA[k.name]; const lvl = Number(k.level) || 0;
    if (!d) continue;
    for (const f of d.features) {
      if (f[0] > lvl || (f[4] && f[4] !== ed)) continue;
      // На мультиклассе «Увеличение характеристик» и общие умения дублируются по классу — это корректно
      want.set(`${k.name}|${f[1]}|${f[0]}`, { k, f, lvl });
    }
  }
  ch.features = ch.features.filter(x => !x.fromClass || want.has(x.ckey));
  for (const [key, { k, f, lvl }] of want) {
    const r = f[3] && RES[f[3]];
    const max = r ? r.max(lvl, ch, ed) : 0;
    const reset = r ? (r.resetFn ? r.resetFn(lvl) : r.reset) : 'long';
    const ex = ch.features.find(x => x.ckey === key);
    if (ex) { if (r) { ex.max = max; ex.reset = reset; ex.used = Math.min(Number(ex.used) || 0, max); } continue; }
    ch.features.push({ id: uid(), name: f[1], source: `${k.name}, ${f[0]} ур.`, text: f[2], max, used: 0, reset, fromClass: true, ckey: key, cat: 'class', lvl: f[0] });
  }
}

// ===================== ВЫБОРЫ КЛАССА (договор, воззвания, стили, метамагия) =====================
export function classChoices(c) {
  const ed = c.edition === '2024' ? '2024' : '5e'; const out = [];
  for (const k of c.classes || []) {
    for (const o of CLASS_OPTIONS[k.name] || []) {
      const allowed = o.count(Number(k.level) || 0, ed);
      if (!allowed) continue;
      const taken = c.features.filter(f => f.optKey === `${k.name}|${o.key}`);
      out.push({ cls: k.name, lvl: Number(k.level) || 0, o, allowed, taken });
    }
  }
  return out;
}
export async function pickClassOption(choice) {
  const { cls, lvl, o, taken } = choice;
  const takenNames = taken.map(t => t.name);
  const opts = o.list.filter(x => !takenNames.includes(x[0])).map(([n, t, req]) => ({ value: n, label: n + (req && req > lvl ? ` (с ${req} ур.)` : ''), hint: t }));
  const v = await pickOne({ title: o.name, options: opts, value: '', customPlaceholder: 'Своё' });
  if (!v) return;
  const row = o.list.find(x => x[0] === v);
  updChar(ch => ch.features.push({ id: uid(), name: v, source: `${cls}: ${o.name}`, text: row ? row[1] : '', max: 0, used: 0, reset: 'long', cat: 'class', optKey: `${cls}|${o.key}` }));
  toast(`${o.name}: ${v}`, 'good');
}

// ===================== МАСТЕР СОЗДАНИЯ =====================
export async function creationWizard(charId) {
  const st = () => getState().characters.find(x => x.id === charId);
  let c = st(); if (!c) return;
  const ed = c.edition; const cls = c.classes[0].name; const d = CLASS_DATA[cls];
  // 0. Характеристики
  const ab = await generateAbilities(cls);
  if (ab) updChar(ch => { Object.assign(ch.abilities, ab); const def = CLASSES[cls]; if (def) { const v = def.hd + Math.floor((ab.con - 10) / 2); ch.hp.max = ch.hp.current = Math.max(1, v); } });
  if (isModern(ed) && d) {
    // 1. Навыки класса
    const sk = await chooseSkills({ title: `Навыки класса ${cls}: ${d.skills.n}`, n: d.skills.n, from: d.skills.from, taken: profSkills(c) });
    if (sk && sk.length) updChar(ch => grantSkills(ch, sk, 'class'));
    // 2. Подкласс на 1 уровне
    if (subclassLevel(cls, ed) <= 1) {
      const sc = await pickSubclass(cls, '');
      if (sc) updChar(ch => { ch.classes[0].subclass = sc; });
    }
  }
  // 3. Раса
  await new Promise(res => pickRace(res).then(() => res()));
  // 4. Предыстория
  c = st();
  await pickBackground(ed, '', true);
  // 5. Выборы класса на 1 уровне
  c = st();
  for (const ch of classChoices(c)) for (let i = ch.taken.length; i < ch.allowed; i++) await pickClassOption({ ...ch, taken: classChoices(st()).find(x => x.o.key === ch.o.key).taken });
  toast(`${st().name} готов к приключениям!`, 'good');
}

export { levelName, Prose };

// ===================== ХАРАКТЕРИСТИКИ =====================
const STANDARD = [15, 14, 13, 12, 10, 8];
const PB_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export function generateAbilities(cls) {
  return modal('Характеристики', (done) => html`<${AbilityGen} cls=${cls} done=${done} />`);
}
function rollStat() { const r = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a); return r[0] + r[1] + r[2]; }
function AbilityGen({ cls, done }) {
  const [method, setMethod] = useState('std');
  const [pool, setPool] = useState(STANDARD);
  const [assign, setAssign] = useState({});
  const [pb, setPb] = useState({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [manual, setManual] = useState({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  const d = CLASS_DATA[cls];
  const pbSpent = Object.values(pb).reduce((s, v) => s + PB_COST[v], 0);
  const switchM = (m) => { setMethod(m); setAssign({}); if (m === 'std') setPool(STANDARD); if (m === 'roll') setPool(Array.from({ length: 6 }, rollStat).sort((a, b) => b - a)); };
  // Распределение значений из набора: каждое значение используется один раз
  const usedIdx = Object.values(assign);
  const result = method === 'pb' ? pb : method === 'manual' ? manual : (Object.keys(assign).length === 6 ? Object.fromEntries(Object.entries(assign).map(([k, i]) => [k, pool[i]])) : null);
  const auto = () => { // рекомендация: основные характеристики класса и Телосложение — выше
    const order = { 'Бард': 'cha dex con wis int str', 'Варвар': 'str con dex wis cha int', 'Воин': 'str con dex wis cha int', 'Волшебник': 'int con dex wis cha str', 'Друид': 'wis con dex int cha str', 'Жрец': 'wis con str cha int dex', 'Изобретатель': 'int con dex wis cha str', 'Колдун': 'cha con dex wis int str', 'Монах': 'dex wis con str int cha', 'Паладин': 'str cha con wis dex int', 'Плут': 'dex con int wis cha str', 'Следопыт': 'dex wis con str int cha', 'Чародей': 'cha con dex wis int str', 'Охотник на кровь': 'str int con dex wis cha' }[cls] || 'str dex con int wis cha';
    const idx = pool.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    setAssign(Object.fromEntries(order.split(' ').map((k, i) => [k, idx[i]])));
  };
  return html`<div>
    ${d && html`<p class="small muted" style="margin-top:0">Для класса ${cls} важнее всего: <b>${d.primary}</b>. Бонусы расы и предыстории добавятся на следующих шагах.</p>`}
    <div class="tabs">${[['std', 'Стандартный набор'], ['pb', 'Покупка очков'], ['roll', 'Броски 4к6'], ['manual', 'Вручную']].map(([k, l]) => html`<button class=${'tab' + (method === k ? ' on' : '')} onClick=${() => switchM(k)}>${l}</button>`)}</div>
    ${(method === 'std' || method === 'roll') && html`<div>
      <div class="row wrapr mb">${pool.map((v, i) => html`<span class=${'chip' + (usedIdx.includes(i) ? '' : ' gold')}>${v}</span>`)}
        ${method === 'roll' && html`<button class="chip" onClick=${() => switchM('roll')}><${Icon} n="dices" cls="xs" /> Перебросить</button>`}
        <button class="chip blue" onClick=${auto}>Расставить для класса</button></div>
      ${ABILITIES.map(a => html`<div class="listrow"><span class="grow">${a.name}</span>
        <select class="inp" style="width:110px" value=${assign[a.key] ?? ''} onChange=${e => { const i = e.target.value === '' ? undefined : Number(e.target.value); setAssign(s => { const n = { ...s }; for (const k of Object.keys(n)) if (n[k] === i) delete n[k]; if (i === undefined) delete n[a.key]; else n[a.key] = i; return n; }); }}>
          <option value="">—</option>${pool.map((v, i) => html`<option value=${i}>${v}</option>`)}</select>
        <span class="bonus">${assign[a.key] != null ? fmt(Math.floor((pool[assign[a.key]] - 10) / 2)) : ''}</span></div>`)}
    </div>`}
    ${method === 'pb' && html`<div>
      <p class="small" style="margin-top:0">Очки: <b class=${pbSpent > 27 ? 'red-t' : 'gold-t'}>${27 - pbSpent}</b> из 27. Значения от 8 до 15.</p>
      ${ABILITIES.map(a => html`<div class="listrow"><span class="grow">${a.name}</span>
        <button class="iconbtn bordered" style="width:34px;height:34px" disabled=${pb[a.key] <= 8} onClick=${() => setPb(s => ({ ...s, [a.key]: s[a.key] - 1 }))}><${Icon} n="minus" cls="xs" /></button>
        <b style="min-width:28px;text-align:center">${pb[a.key]}</b>
        <button class="iconbtn bordered" style="width:34px;height:34px" disabled=${pb[a.key] >= 15 || pbSpent + PB_COST[pb[a.key] + 1] - PB_COST[pb[a.key]] > 27} onClick=${() => setPb(s => ({ ...s, [a.key]: s[a.key] + 1 }))}><${Icon} n="plus" cls="xs" /></button>
        <span class="bonus">${fmt(Math.floor((pb[a.key] - 10) / 2))}</span></div>`)}
    </div>`}
    ${method === 'manual' && html`<div class="grid3">${ABILITIES.map(a => html`<div class="field"><label>${a.name}</label>
      <input class="inp num" type="number" value=${manual[a.key]} onInput=${e => setManual(s => ({ ...s, [a.key]: Number(e.target.value) || 0 }))} /></div>`)}</div>`}
    <div class="row mt"><button class="btn grow" onClick=${() => done(null)}>Пропустить</button><button class="btn gold grow" disabled=${!result} onClick=${() => done(result)}>Готово</button></div>
  </div>`;
}
