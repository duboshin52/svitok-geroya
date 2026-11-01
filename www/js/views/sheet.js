// Лист персонажа: основное, особенности, личность, журнал
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Area, Select, Tabs, Empty, confirmBox, promptBox, Toggle, Prose, PickField, pickOne } from '../ui.js';
import * as O from '../origin.js';
import { deleteCharacter } from './characters.js';
import { FEATS } from '../data/origins.js';
import { bookAllowed } from '../data/books.js';
import { activeChar, updChar, setPath, uid, toast, useStore } from '../store.js';
import { ABILITIES, ABIL, mod, fmt, EDITIONS, skillsFor, CLASS_NAMES, CLASSES, XP_TABLE, levelForXp, totalLevel } from '../rules.js';
import * as K from '../calc.js';
import { imageToDataUrl, pickFile } from '../native.js';
import { CombatTab } from './combat.js';

let sub = 'main';
export function SheetView() {
  const st = useStore();
  const c = activeChar();
  const [t, setT] = useState(sub);
  if (!c) return null;
  const go = (k) => { sub = k; setT(k); };
  void st;
  return html`<div class="wrap">
    <${Tabs} value=${t} onChange=${go} tabs=${[['main', 'Основное'], ['combat', 'Бой'], ['feats', 'Умения'], ['persona', 'Личность'], ['journal', 'Журнал']]} />
    ${t === 'main' && html`<${MainTab} c=${c} />`}
    ${t === 'combat' && html`<${CombatTab} c=${c} />`}
    ${t === 'feats' && html`<${FeaturesTab} c=${c} />`}
    ${t === 'persona' && html`<${PersonaTab} c=${c} />`}
    ${t === 'journal' && html`<${JournalTab} c=${c} />`}
  </div>`;
}

export const classLine = (c) => (c.classes || []).filter(k => k.name).map(k => `${k.name}${k.subclass ? ` (${k.subclass})` : ''} ${k.level}`).join(' / ');

// ================= ОСНОВНОЕ =================
function MainTab({ c }) {
  const md = K.model(c);
  return html`<div>
    <${HeaderCard} c=${c} />
    <div class="grid6 mb">${ABILITIES.map(a => html`<${AbilityBox} c=${c} a=${a} />`)}</div>
    <${QuickStats} c=${c} />
    <${RollModeBar} />
    ${md === '5e' && html`<${SavesCard} c=${c} />`}
    ${md === '35' && html`<${Saves35} c=${c} />`}
    ${md === '4e' && html`<${Defenses4e} c=${c} />`}
    ${md === 'adnd' && html`<${SavesAdnd} c=${c} />`}
    <${SkillsCard} c=${c} />
  </div>`;
}

function HeaderCard({ c }) {
  const L = totalLevel(c); const ed = EDITIONS[c.edition];
  const nextXp = XP_TABLE[L] ?? null;
  return html`<div class="card">
    <div class="row" style="align-items:flex-start">
      <button class="portrait" style=${`width:84px;height:100px;${c.persona.portrait ? `background-image:url(${c.persona.portrait})` : ''}`} onClick=${() => openPortrait(c)} aria-label="Портрет">
        ${!c.persona.portrait && html`<${Icon} n="camera" cls="l" />`}</button>
      <div class="grow">
        <div class="serif" style="font-size:26px;font-weight:700;line-height:1.1">${c.name}</div>
        <div class="small muted">${[c.race, classLine(c)].filter(Boolean).join(' · ') || 'Раса и класс не указаны'}</div>
        <div class="small faint">${[c.background, c.alignment].filter(Boolean).join(' · ')}</div>
        <div class="row wrapr mt" style="gap:6px">
          <span class="chip gold">${ed.short}</span><span class="chip">Уровень ${L}</span>
          <button class=${'chip' + (c.inspiration ? ' gold' : '')} onClick=${() => setPath('inspiration', !c.inspiration)}><${Icon} n="star" cls="xs" /> ${c.inspiration ? 'Вдохновение' : 'Нет вдохн.'}</button>
        </div>
      </div>
      <button class="iconbtn" onClick=${() => openBasics(c)} aria-label="Изменить"><${Icon} n="pencil" cls="s" /></button>
    </div>
    ${K.model(c) !== '4e' && html`<div class="mt"><div class="row between tiny faint"><span>Опыт: ${c.xp || 0}</span><span>${nextXp != null ? `до ${L + 1} ур.: ${nextXp}` : 'максимум'}</span></div>
      <div class="progress mt" style="margin-top:4px"><i style=${`width:${nextXp ? Math.min(100, ((c.xp || 0) - (XP_TABLE[L - 1] || 0)) / (nextXp - (XP_TABLE[L - 1] || 0)) * 100) : 100}%`}></i></div></div>`}
  </div>`;
}

function AbilityBox({ c, a }) {
  const m = mod(c.abilities[a.key]);
  return html`<div class="ability">
    <div class="nm">${a.short}</div>
    <button class="md" onClick=${() => K.rollCheck(m, `Проверка: ${a.name}`)} aria-label=${'Бросок ' + a.name}>${fmt(m)}</button>
    <input class="sc" type="number" inputmode="numeric" value=${c.abilities[a.key]} onFocus=${e => e.target.select()} onInput=${e => setPath('abilities.' + a.key, Number(e.target.value) || 0)} aria-label=${a.name} />
  </div>`;
}

function QuickStats({ c }) {
  const md = K.model(c);
  const ac = K.armorClass(c); const init = K.initiative(c);
  return html`<div class="grid4 mb" style="grid-template-columns:repeat(5,1fr)">
    <button class="stat shield-ac tap" onClick=${() => openAC(c)}><div class="v">${ac}</div><div class="k">КД</div></button>
    <button class="stat tap" onClick=${() => K.rollCheck(init, 'Инициатива')}><div class="v">${fmt(init)}</div><div class="k">Иниц.</div></button>
    <div class="stat"><input class="v" style="font-size:22px" value=${c.speed} onInput=${e => setPath('speed', e.target.value)} /><div class="k">Скорость</div></div>
    ${md === '5e' ? html`<div class="stat"><div class="v">${fmt(K.pb(c))}</div><div class="k">Мастерство</div></div>`
      : md === '35' ? html`<div class="stat"><input class="v" type="number" value=${c.ed.bab} onInput=${e => setPath('ed.bab', Number(e.target.value) || 0)} /><div class="k">БМА</div></div>`
        : md === '4e' ? html`<div class="stat"><div class="v">${fmt(Math.floor(totalLevel(c) / 2))}</div><div class="k">½ уровня</div></div>`
          : html`<div class="stat"><input class="v" type="number" value=${c.ed.thac0} onInput=${e => setPath('ed.thac0', Number(e.target.value) || 0)} /><div class="k">THAC0</div></div>`}
    <div class="stat"><div class="v">${K.passive(c)}</div><div class="k">Пасс. вним.</div></div>
  </div>`;
}

export function RollModeBar() {
  const m = K.rollMode();
  return html`<div class="row mb" style="justify-content:center"><${Toggle} value=${m} onChange=${K.setRollMode} options=${[['dis', 'Помеха'], ['', 'Обычный бросок'], ['adv', 'Преимущество']]} /></div>`;
}

function SavesCard({ c }) {
  return html`<div class="card"><h3><${Icon} n="shield-plus" /> Спасброски</h3>
    <div class="grid2" style="gap:0 14px">${ABILITIES.map(a => { const b = K.saveBonus(c, a.key); return html`<div class="listrow">
      <button class=${'dot' + (c.saveProf[a.key] ? ' on' : '')} onClick=${() => setPath('saveProf.' + a.key, !c.saveProf[a.key])} aria-label="Владение"></button>
      <span class="grow">${a.name}</span>
      <button class="bonus" onClick=${() => K.rollCheck(b, `Спасбросок: ${a.name}`)}>${fmt(b)}</button></div>`; })}</div>
  </div>`;
}
function Saves35({ c }) {
  const s = K.saves35(c);
  const row = (k, name, ab) => html`<div class="listrow"><span class="grow">${name} <span class="faint small">(${ABIL[ab].short})</span></span>
    <span class="tiny faint">база</span><input class="inp num" style="width:52px" type="number" value=${c.ed[k]} onInput=${e => setPath('ed.' + k, Number(e.target.value) || 0)} />
    <button class="bonus" onClick=${() => K.rollCheck(s[k], `Спасбросок: ${name}`)}>${fmt(s[k])}</button></div>`;
  return html`<div class="card"><h3><${Icon} n="shield-plus" /> Спасброски</h3>${row('fort', 'Стойкость', 'con')}${row('ref', 'Реакция', 'dex')}${row('will', 'Воля', 'wis')}</div>`;
}
function Defenses4e({ c }) {
  const d = K.defenses4e(c);
  const row = (k, name) => html`<div class="listrow"><span class="grow">${name}</span><span class="tiny faint">прочее</span>
    <input class="inp num" style="width:52px" type="number" value=${c.ed.defMisc[k]} onInput=${e => setPath('ed.defMisc.' + k, Number(e.target.value) || 0)} />
    <span class="bonus">${d[k]}</span></div>`;
  return html`<div class="card"><h3><${Icon} n="shield-plus" /> Защиты</h3>${row('fort', 'Стойкость')}${row('ref', 'Реакция')}${row('will', 'Воля')}
    <p class="hint">Спасбросок в 4e: к20, успех на 10+. <button class="chip" onClick=${() => K.rollCheck(0, 'Спасбросок')}>Бросить</button></p></div>`;
}
function SavesAdnd({ c }) {
  const names = [['pp', 'Паралич, яд, смертельная магия'], ['rsw', 'Жезл, посох, палочка'], ['pp2', 'Окаменение, превращение'], ['br', 'Дыхание'], ['sp', 'Заклинания']];
  return html`<div class="card"><h3><${Icon} n="shield-plus" /> Спасброски (целевое число)</h3>
    ${names.map(([k, n]) => html`<div class="listrow"><span class="grow small">${n}</span>
      <input class="inp num" style="width:56px" type="number" value=${c.ed.adndSaves[k]} onInput=${e => setPath('ed.adndSaves.' + k, Number(e.target.value) || 0)} />
      <button class="chip" onClick=${() => K.rollCheck(0, `Спасбросок (нужно ${c.ed.adndSaves[k]}+)`)}>к20</button></div>`)}</div>`;
}

function SkillsCard({ c }) {
  const md = K.model(c); const skills = skillsFor(c.edition);
  const cycle = (k) => { const v = Number(c.skills[k]) || 0; setPath('skills.' + k, md === '4e' ? (v ? 0 : 1) : v === 0 ? 1 : v === 1 ? 2 : 0); };
  return html`<div class="card"><h3><${Icon} n="target" /> Навыки
    <span class="grow"></span><span class="tiny faint" style="font-family:var(--sans);font-weight:400">${md === '5e' ? 'точка: владение → компетентность' : md === '4e' ? 'точка: обучен (+5)' : 'ранги'}</span></h3>
    ${md === 'adnd' && html`<p class="hint">В AD&D 2e небоевые навыки проверяются к20: успех, если результат не больше значения характеристики (с модификатором навыка).</p>`}
    ${md !== 'adnd' && skills.map(sk => { const b = K.skillBonus(c, sk); const p = Number(c.skills[sk.key]) || 0; return html`<div class="listrow">
      ${md === '5e' || md === '4e' ? html`<button class=${'dot' + (p === 2 ? ' exp' : p ? ' on' : '')} onClick=${() => cycle(sk.key)} aria-label="Владение"></button>`
        : html`<input class="inp num" style="width:46px;min-height:32px" type="number" value=${c.skillRanks[sk.key] || 0} onInput=${e => setPath('skillRanks.' + sk.key, Number(e.target.value) || 0)} aria-label="Ранги" />`}
      <span class="abtag">${ABIL[sk.ab].short}</span>
      <span class="grow">${sk.name}</span>
      <button class="bonus" onClick=${() => K.rollCheck(b, sk.name)}>${fmt(b)}</button></div>`; })}
    ${md === 'adnd' && html`<${Field} label="Небоевые навыки и владения оружием" cls="mt"><${Area} rows=${6} value=${c.skillNotes || ''} onChange=${v => setPath('skillNotes', v)} placeholder="Верховая езда (МДР +3), Выживание (МДР)…" /><//>
      <button class="btn sm mt" onClick=${() => K.rollCheck(0, 'Проверка навыка (к20)')}><${Icon} n="dices" cls="s" /> Бросить к20</button>`}
  </div>`;
}

// ---------- Редактор основных сведений ----------
export function openBasics(c) { openModal(close => html`<${Basics} close=${close} />`, { title: 'Основные сведения', full: true }); }
function Basics({ close }) {
  const c = activeChar(); if (!c) return null;
  const md = K.model(c);
  const setCls = (i, k, v) => updChar(ch => { ch.classes[i][k] = v; if (k === 'level') O.syncClassFeatures(ch); });
  const subHint = (k) => { const sl = O.subclassLevel(k.name, c.edition); return !k.subclass && Number(k.level) >= sl && (CLASSES[k.name] || k.name) ? `Доступен выбор: ${sl} уровень` : ''; };
  return html`<div>
    <${Field} label="Имя персонажа"><${TextIn} value=${c.name} onChange=${v => setPath('name', v)} /><//>
    <${Field} label="Редакция правил" cls="mt"><${Select} value=${c.edition} onChange=${v => setPath('edition', v)} options=${Object.values(EDITIONS).map(e => [e.key, e.name])} /><//>
    <${Field} label=${c.edition === '2024' ? 'Вид (раса)' : 'Раса'} cls="mt"><${PickField} value=${c.race} placeholder="Выбрать расу…" onClick=${() => O.pickRace()} /><//>
    <div class="grid2 mt"><${Field} label="Предыстория"><${PickField} value=${c.background} onClick=${() => O.pickBackground(c.edition, c.background)} /><//>
      <${Field} label="Мировоззрение"><${PickField} value=${c.alignment} onClick=${async () => { const v = await O.pickAlignment(c.alignment); if (v != null) setPath('alignment', v); }} /><//></div>
    <button class="btn sm mt" onClick=${async () => { const ab = await O.generateAbilities(c.classes[0].name); if (ab) updChar(ch => { Object.assign(ch.abilities, ab); if (ch.raceRef && ch.raceRef.bonus) for (const [k, v] of Object.entries(ch.raceRef.bonus)) ch.abilities[k] += v; if (ch.bgRef && ch.bgRef.bonus) for (const [k, v] of Object.entries(ch.bgRef.bonus)) ch.abilities[k] += v; }); }}><${Icon} n="dices" cls="s" /> Заново распределить характеристики</button>
    <${Field} label="Игрок" cls="mt"><${TextIn} value=${c.player} onChange=${v => setPath('player', v)} /><//>
    <div class="section-title" style="font-size:19px">Классы и уровни</div>
    ${c.classes.map((k, i) => html`<div class="card tight">
      <div class="grid2"><${Field} label="Класс"><${PickField} value=${k.name} placeholder="Выбрать класс…" onClick=${async () => { const v = await O.pickClass(c.edition, k.name); if (v != null) updChar(ch => O.setClass(ch, i, v)); }} /><//>
        <${Field} label=${subHint(k) || 'Подкласс'}><${PickField} value=${k.subclass} placeholder="—" onClick=${async () => { const v = await O.pickSubclass(k.name, k.subclass); if (v != null) setCls(i, 'subclass', v); }} /><//></div>
      <div class="row mt"><${Field} label="Уровень" style="width:90px"><${NumIn} value=${k.level} min="1" max="20" onChange=${v => setCls(i, 'level', v)} /><//>
        ${!CLASSES[k.name] && html`<${Field} label="Кость хитов" style="width:100px"><${Select} value=${String(k.hd || 8)} onChange=${v => setCls(i, 'hd', Number(v))} options=${[['4', 'к4'], ['6', 'к6'], ['8', 'к8'], ['10', 'к10'], ['12', 'к12']]} /><//>`}
        <div class="grow"></div>${c.classes.length > 1 && html`<button class="btn sm red" style="align-self:flex-end" onClick=${() => updChar(ch => { ch.classes.splice(i, 1); O.syncClassFeatures(ch); })}><${Icon} n="trash" cls="s" /></button>`}</div>
    </div>`)}
    <button class="btn sm" onClick=${() => updChar(ch => ch.classes.push({ name: '', level: 1, subclass: '' }))}><${Icon} n="plus" cls="s" /> Мультикласс</button>
    ${md !== '4e' && html`<div class="row mt2"><${Field} label="Опыт" cls="grow"><${NumIn} value=${c.xp} onChange=${v => setPath('xp', v)} /><//>
      <button class="btn sm" style="align-self:flex-end" onClick=${async () => { const v = await promptBox('Сколько опыта добавить?', '', { placeholder: 'например 300' }); if (v) setPath('xp', (Number(activeChar().xp) || 0) + (Number(v) || 0)); }}>+ опыт</button></div>
      ${levelForXp(c.xp || 0) > totalLevel(c) && html`<p class="hint gold-t">По опыту доступен ${levelForXp(c.xp || 0)} уровень — повысьте уровень класса.</p>`}`}
    ${md === '5e' && html`<${Field} label="Бонус мастерства (пусто — по уровню)" cls="mt"><${NumIn} value=${c.profOverride} onChange=${v => setPath('profOverride', v)} placeholder=${String(K.pb({ ...c, profOverride: '' }))} /><//>`}
    <button class="btn gold block mt2" onClick=${close}>Готово</button>
    <button class="btn red block mt2" onClick=${() => deleteCharacter(c, close)}><${Icon} n="trash" cls="s" /> Удалить персонажа</button>
  </div>`;
}

// ---------- КД ----------
function openAC(c) { openModal(close => html`<${ACEditor} close=${close} />`, { title: 'Класс доспеха' }); }
function ACEditor({ close }) {
  const c = activeChar(); const inv = K.armorFromInventory(c);
  return html`<div>
    <label class="check"><input type="checkbox" checked=${!!c.acAuto} onChange=${e => setPath('acAuto', e.target.checked)} /> Считать по надетой броне из сумки</label>
    ${c.acAuto ? html`<div class="card tight mt small">
        <div>Доспех: <b>${inv.body ? inv.body.name : 'нет (10 + Ловкость)'}</b></div>
        ${inv.shields.map(s => html`<div>Щит: <b>${s.name}</b></div>`)}
        ${inv.stealthDis && html`<div class="red-t">Помеха на Скрытность</div>`}
        <div class="hint">Отметьте предметы как «надето» в сумке. Защиту без доспехов (варвар, монах) задайте бонусом ниже.</div></div>
      <${Field} label="Прочие бонусы к КД (кольца, плащ, умения)" cls="mt"><${NumIn} value=${c.acMisc || 0} onChange=${v => setPath('acMisc', v)} /><//>`
      : html`<${Field} label="КД вручную" cls="mt"><${NumIn} value=${c.ac} onChange=${v => setPath('ac', v)} /><//>`}
    <${Field} label="Заметка" cls="mt"><${TextIn} value=${c.acNote} onChange=${v => setPath('acNote', v)} placeholder="напр. Доспехи мага: 13 + Ловк." /><//>
    <div class="center mt2 serif" style="font-size:40px;font-weight:700">${K.armorClass(c)}</div>
    <button class="btn gold block mt" onClick=${close}>Готово</button>
  </div>`;
}

// ================= УМЕНИЯ =================
const FEAT_CATS = [['class', 'Класс'], ['subclass', 'Подкласс'], ['race', 'Раса'], ['feat', 'Черта'], ['dm', 'От Мастера'], ['item', 'Предмет'], ['other', 'Другое']];
const catOf = (f) => f.cat || (f.fromRace ? 'race' : f.fromClass ? 'class' : 'other');
let featFilter = 'all';
function FeaturesTab({ c }) {
  const [flt, setFlt] = useState(featFilter);
  const setF = (v) => { featFilter = v; setFlt(v); };
  const choices = O.classChoices(c);
  const counts = Object.fromEntries(FEAT_CATS.map(([k]) => [k, c.features.filter(f => catOf(f) === k).length]));
  const list = c.features.filter(f => flt === 'all' || catOf(f) === flt)
    .sort((a, b) => FEAT_CATS.findIndex(x => x[0] === catOf(a)) - FEAT_CATS.findIndex(x => x[0] === catOf(b)) || (a.lvl || 0) - (b.lvl || 0));
  return html`<div>
    ${choices.length > 0 && html`<div class="card"><h3><${Icon} n="list-plus" /> Выборы класса</h3>
      ${choices.map(ch => html`<div class="listrow">
        <div class="grow"><div class="t">${ch.o.name}</div><div class="tiny faint">${ch.cls}: выбрано ${ch.taken.length} из ${ch.allowed}${ch.taken.length ? ' — ' + ch.taken.map(t => t.name).join(', ') : ''}</div></div>
        ${ch.taken.length < ch.allowed ? html`<button class="btn sm gold" onClick=${() => O.pickClassOption(ch)}>Выбрать</button>` : html`<span class="chip green">готово</span>`}
      </div>`)}</div>`}
    <div class="row between"><div class="section-title" style="margin-top:4px">Умения и черты</div>
      <div class="row"><button class="btn sm" onClick=${addFeat}><${Icon} n="crown" cls="s" /> Черта</button><button class="btn sm gold" onClick=${() => openFeature(null, flt !== 'all' ? flt : 'dm')}><${Icon} n="plus" cls="s" /> Своё</button></div></div>
    <div class="tabs"><button class=${'tab' + (flt === 'all' ? ' on' : '')} onClick=${() => setF('all')}>Все ${c.features.length}</button>
      ${FEAT_CATS.filter(([k]) => counts[k]).map(([k, n]) => html`<button class=${'tab' + (flt === k ? ' on' : '')} onClick=${() => setF(k)}>${n} ${counts[k]}</button>`)}</div>
    ${list.length ? list.map(f => html`<${FeatureCard} f=${f} />`) : html`<${Empty} icon="crown">Умения класса добавляются сами по уровню. Сюда же — расовые особенности, черты и всё, что дал Мастер.</${Empty}>`}
    <div class="section-title">Владения и языки</div>
    <div class="card">
      <${Field} label="Доспехи"><${TextIn} value=${c.prof.armor} onChange=${v => setPath('prof.armor', v)} /><//>
      <${Field} label="Оружие" cls="mt"><${TextIn} value=${c.prof.weapons} onChange=${v => setPath('prof.weapons', v)} /><//>
      <${Field} label="Инструменты" cls="mt"><${TextIn} value=${c.prof.tools} onChange=${v => setPath('prof.tools', v)} /><//>
      <${Field} label="Языки" cls="mt"><${TextIn} value=${c.prof.languages} onChange=${v => setPath('prof.languages', v)} /><//>
    </div>
  </div>`;
}
async function addFeat() {
  const v = await pickOne({ title: 'Черта', options: FEATS.filter(x => bookAllowed(x[1])).map(([n, src, t, type]) => ({ value: n, label: n, hint: `${type} · ${src} · ${t}`, group: type })), value: '', customPlaceholder: 'Своя черта' });
  if (!v) return;
  const row = FEATS.find(x => x[0] === v);
  updChar(ch => ch.features.push({ id: uid(), name: v, source: 'Черта' + (row ? ' (' + row[1] + ')' : ''), text: row ? row[2] : '', max: 0, used: 0, reset: 'long', cat: 'feat' }));
  toast(`Черта «${v}» добавлена`, 'good');
}
function FeatureCard({ f }) {
  const [open, setOpen] = useState(false);
  const setUsed = (v) => updChar(ch => { const x = ch.features.find(y => y.id === f.id); x.used = Math.max(0, Math.min(Number(x.max) || 0, v)); });
  const max = Number(f.max) || 0; const used = Number(f.used) || 0; const left = max - used;
  const cat = FEAT_CATS.find(x => x[0] === catOf(f));
  return html`<div class="card tight">
    <div class="row"><button class="grow" style="background:none;border:0;text-align:left;padding:4px 0" onClick=${() => setOpen(!open)}>
      <div style="font-weight:700">${f.name} ${catOf(f) === 'dm' ? html`<span class="chip violet" style="padding:0 6px">Мастер</span>` : ''}</div>
      <div class="tiny faint">${[f.source || (cat && cat[1]), max ? (max >= 99 ? 'без ограничений' : `осталось ${left} из ${max} · ${f.reset === 'short' ? 'короткий отдых' : f.reset === 'long' ? 'долгий отдых' : 'не восстанавливается'}`) : ''].filter(Boolean).join(' · ')}</div></button>
      ${max > 0 && max < 99 && (max <= 8 ? html`<div class="row" style="gap:4px">${Array.from({ length: max }, (_, i) => html`<button class=${'dot' + (i < left ? ' on' : '')} onClick=${() => setUsed(i < left ? used + 1 : used - 1)} aria-label="Заряд"></button>`)}</div>`
        : html`<div class="row" style="gap:2px"><button class="iconbtn" style="width:30px" onClick=${() => setUsed(used + 1)}><${Icon} n="minus" cls="xs" /></button><b style="min-width:26px;text-align:center">${left}</b><button class="iconbtn" style="width:30px" onClick=${() => setUsed(used - 1)}><${Icon} n="plus" cls="xs" /></button></div>`)}
      <button class="iconbtn" onClick=${() => openFeature(f)}><${Icon} n="pencil" cls="s" /></button></div>
    ${open && f.text && html`<div class="mt small"><${Prose} text=${f.text} /></div>`}
  </div>`;
}
function openFeature(f, cat) { openModal(close => html`<${FeatureEditor} f=${f} cat=${cat} close=${close} />`, { title: f ? 'Умение' : 'Новое умение' }); }
function FeatureEditor({ f, cat, close }) {
  const [d, setD] = useState(f ? { ...f, cat: catOf(f) } : { name: '', source: '', text: '', max: 0, used: 0, reset: 'long', cat: cat || 'dm' });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const save = () => { if (!d.name.trim()) return; updChar(ch => { if (f) Object.assign(ch.features.find(x => x.id === f.id), d); else ch.features.push({ ...d, id: uid() }); }); close(); };
  return html`<div>
    <${Field} label="Откуда умение"><div class="row wrapr">${FEAT_CATS.map(([k, n]) => html`<button class=${'chip' + (d.cat === k ? ' gold' : '')} onClick=${() => s('cat')(k)}>${n}</button>`)}</div><//>
    <div class="grid2 mt"><${Field} label="Название"><${TextIn} value=${d.name} onChange=${s('name')} /><//><${Field} label="Источник"><${TextIn} value=${d.source} onChange=${s('source')} placeholder=${d.cat === 'dm' ? 'Дар Мастера, награда…' : 'Класс, раса, черта'} /><//></div>
    <div class="grid2 mt"><${Field} label="Зарядов (0 — нет)"><${NumIn} value=${d.max} onChange=${s('max')} /><//>
      <${Field} label="Восстановление"><${Select} value=${d.reset} onChange=${s('reset')} options=${[['short', 'Короткий отдых'], ['long', 'Долгий отдых'], ['none', 'Не восстанавливается']]} /><//></div>
    <${Field} label="Описание" cls="mt"><${Area} rows=${6} value=${d.text} onChange=${s('text')} /><//>
    ${f && f.fromClass && html`<p class="hint">Умение класса: при смене уровня заряды пересчитываются автоматически.</p>`}
    <div class="row mt2">${f && html`<button class="btn red" onClick=${async () => { if (await confirmBox('Удалить умение?')) { updChar(ch => { ch.features = ch.features.filter(x => x.id !== f.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
      <button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}>Сохранить</button></div>
  </div>`;
}

// ================= ЛИЧНОСТЬ =================
export function openPortrait(c) {
  openModal(close => html`<${PortraitEditor} close=${close} />`, { title: 'Портрет' });
}
function PortraitEditor({ close }) {
  const c = activeChar();
  const upload = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    try { const url = await imageToDataUrl(f); setPath('persona.portrait', url); toast('Портрет обновлён', 'good'); } catch (e) { toast('Не удалось загрузить изображение', 'bad'); }
  };
  return html`<div>
    <div class="portrait big" style=${c.persona.portrait ? `background-image:url(${c.persona.portrait});background-size:contain` : ''}>${!c.persona.portrait && html`<${Icon} n="image" cls="l" />`}</div>
    <div class="row mt"><button class="btn gold grow" onClick=${upload}><${Icon} n="upload" cls="s" /> Выбрать изображение</button>
      ${c.persona.portrait && html`<button class="btn red" onClick=${() => setPath('persona.portrait', '')}><${Icon} n="trash" cls="s" /></button>`}</div>
    <p class="hint">Изображение сжимается и хранится в памяти приложения вместе с персонажем.</p>
    <button class="btn block mt" onClick=${close}>Закрыть</button>
  </div>`;
}

function PersonaTab({ c }) {
  const p = c.persona; const s = (k) => (v) => setPath('persona.' + k, v);
  return html`<div>
    <div class="card"><div class="row" style="align-items:flex-start">
      <button class="portrait" style=${p.portrait ? `background-image:url(${p.portrait})` : ''} onClick=${() => openPortrait(c)}>${!p.portrait && html`<div class="center"><${Icon} n="camera" cls="l" /><div class="tiny">Добавить портрет</div></div>`}</button>
      <div class="grow grid2" style="gap:8px">
        <${Field} label="Возраст"><${TextIn} value=${p.age} onChange=${s('age')} /><//><${Field} label="Пол"><${TextIn} value=${p.gender} onChange=${s('gender')} /><//>
        <${Field} label="Рост"><${TextIn} value=${p.height} onChange=${s('height')} /><//><${Field} label="Вес"><${TextIn} value=${p.weight} onChange=${s('weight')} /><//>
      </div></div>
      <div class="grid3 mt"><${Field} label="Глаза"><${TextIn} value=${p.eyes} onChange=${s('eyes')} /><//><${Field} label="Кожа"><${TextIn} value=${p.skin} onChange=${s('skin')} /><//><${Field} label="Волосы"><${TextIn} value=${p.hair} onChange=${s('hair')} /><//></div>
      <${Field} label="Внешность" cls="mt"><${Area} value=${p.look} onChange=${s('look')} placeholder="Шрамы, одежда, манеры, отличительные черты" /><//>
    </div>
    <div class="card"><h3><${Icon} n="heart" /> Характер</h3>
      <${Field} label="Черты характера"><${Area} rows=${3} value=${p.traits} onChange=${s('traits')} /><//>
      <${Field} label="Идеалы" cls="mt"><${Area} rows=${2} value=${p.ideals} onChange=${s('ideals')} /><//>
      <${Field} label="Привязанности" cls="mt"><${Area} rows=${2} value=${p.bonds} onChange=${s('bonds')} /><//>
      <${Field} label="Слабости" cls="mt"><${Area} rows=${2} value=${p.flaws} onChange=${s('flaws')} /><//>
    </div>
    <div class="card"><h3><${Icon} n="scroll-text" /> Предыстория</h3>
      <${Field} label=${'Предыстория: ' + (c.background || 'не указана')}><${Area} rows=${8} value=${p.backstory} onChange=${s('backstory')} placeholder="История персонажа: откуда он, что его сформировало, чего он хочет" /><//>
      <${Field} label="Союзники и организации" cls="mt"><${Area} rows=${3} value=${p.allies} onChange=${s('allies')} /><//>
    </div>
  </div>`;
}

// ================= ЖУРНАЛ =================
function JournalTab({ c }) {
  const [f, setF] = useState('all');
  const list = c.journal.filter(j => f === 'all' || j.type === f).sort((a, b) => (a.done - b.done) || b.date - a.date);
  return html`<div>
    <div class="row between mb"><${Toggle} value=${f} onChange=${setF} options=${[['all', 'Всё'], ['note', 'Заметки'], ['quest', 'Задания'], ['npc', 'НИП']]} />
      <button class="btn sm gold" onClick=${() => openEntry()}><${Icon} n="plus" cls="s" /></button></div>
    ${list.length ? list.map(j => html`<div class="card tight">
      <div class="row">${j.type === 'quest' && html`<button class=${'dot green' + (j.done ? ' on' : '')} onClick=${() => updChar(ch => { const x = ch.journal.find(y => y.id === j.id); x.done = !x.done; })} aria-label="Выполнено"></button>`}
        <button class="grow" style="background:none;border:0;text-align:left;padding:2px 0" onClick=${() => openEntry(j)}>
          <div style=${'font-weight:700;' + (j.done ? 'text-decoration:line-through;opacity:.6' : '')}>${j.title || 'Без названия'}</div>
          <div class="tiny faint">${{ note: 'Заметка', quest: 'Задание', npc: 'НИП' }[j.type]} · ${new Date(j.date).toLocaleDateString('ru-RU')}</div>
          ${j.text && html`<div class="small muted" style="white-space:pre-wrap;max-height:4.2em;overflow:hidden">${j.text}</div>`}</button></div></div>`)
      : html`<${Empty} icon="notebook-pen">Записывайте события сессий, задания и важных персонажей.</${Empty}>`}
  </div>`;
}
function openEntry(j) { openModal(close => html`<${EntryEditor} j=${j} close=${close} />`, { title: j ? 'Запись' : 'Новая запись', full: true }); }
function EntryEditor({ j, close }) {
  const [d, setD] = useState(j ? { ...j } : { title: '', text: '', type: 'note', done: false });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const save = () => { updChar(ch => { if (j) Object.assign(ch.journal.find(x => x.id === j.id), d); else ch.journal.push({ ...d, id: uid(), date: Date.now() }); }); close(); };
  return html`<div>
    <${Toggle} value=${d.type} onChange=${s('type')} options=${[['note', 'Заметка'], ['quest', 'Задание'], ['npc', 'НИП']]} />
    <${Field} label="Заголовок" cls="mt"><${TextIn} value=${d.title} onChange=${s('title')} /><//>
    <${Field} label="Текст" cls="mt"><${Area} rows=${12} value=${d.text} onChange=${s('text')} /><//>
    <div class="row mt2">${j && html`<button class="btn red" onClick=${async () => { if (await confirmBox('Удалить запись?')) { updChar(ch => { ch.journal = ch.journal.filter(x => x.id !== j.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
      <button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}>Сохранить</button></div>
  </div>`;
}
