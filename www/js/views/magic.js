// Магия персонажа: характеристика, Сл, ячейки, список заклинаний (или таланты для 4e)
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Area, Select, Empty, confirmBox, Toggle, Prose } from '../ui.js';
import { activeChar, updChar, setPath, uid, toast, useStore } from '../store.js';
import { ABILITIES, fmt, levelName, computeSlots, CLASS_EN, SCHOOLS, CLASSES } from '../rules.js';
import { getList, findSpell } from '../data/index.js';
import { srcOf, matchBook, booksIn } from '../data/books.js';
import { SpellBody, spellMeta, openCustomEditor } from './library.js';
import * as K from '../calc.js';

const n = (v) => Number(v) || 0;

export function slotTable(c) {
  const auto = c.magic.autoSlots && K.model(c) === '5e';
  const out = {};
  if (auto) {
    const { slots, pact } = computeSlots(c);
    for (let l = 1; l <= 9; l++) out[l] = { max: slots[l - 1] || 0, used: Math.min(n((c.magic.slots[l] || {}).used), slots[l - 1] || 0) };
    return { slots: out, pact: pact ? { max: pact[0], level: pact[1], used: Math.min(n(c.magic.pact.used), pact[0]) } : null, auto };
  }
  for (let l = 1; l <= 9; l++) out[l] = { max: n((c.magic.slots[l] || {}).max), used: n((c.magic.slots[l] || {}).used) };
  return { slots: out, pact: n(c.magic.pact.max) ? { ...c.magic.pact, max: n(c.magic.pact.max), used: n(c.magic.pact.used) } : null, auto };
}

// Сколько заговоров/заклинаний положено (5e 2014; для 2024 — ориентир)
const CANTRIPS = { 'Бард': [[1, 2], [4, 3], [10, 4]], 'Жрец': [[1, 3], [4, 4], [10, 5]], 'Друид': [[1, 2], [4, 3], [10, 4]], 'Чародей': [[1, 4], [4, 5], [10, 6]], 'Колдун': [[1, 2], [4, 3], [10, 4]], 'Волшебник': [[1, 3], [4, 4], [10, 5]], 'Изобретатель': [[1, 2], [10, 3], [14, 4]] };
const KNOWN = { 'Бард': [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22], 'Чародей': [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15], 'Колдун': [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15], 'Следопыт': [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11] };
const PREP_FULL = ['Жрец', 'Друид', 'Волшебник'];
export function spellCapacity(c) {
  const out = [];
  for (const k of c.classes || []) {
    const l = Math.max(1, Math.min(20, Number(k.level) || 1)); const parts = [];
    const ct = CANTRIPS[k.name]; if (ct) { let v = 0; for (const [lv, n] of ct) if (l >= lv) v = n; parts.push(`заговоров ${v}`); }
    if (KNOWN[k.name]) parts.push(`известно заклинаний ${KNOWN[k.name][l - 1]}`);
    const ab = (CLASSES[k.name] || {}).spell; const m = ab ? K.am(c, ab) : 0;
    if (PREP_FULL.includes(k.name)) parts.push(`подготовить ${Math.max(1, m + l)}${k.name === 'Волшебник' ? ` (в книге ${6 + 2 * (l - 1)}+)` : ''}`);
    if (k.name === 'Паладин' && l >= 2) parts.push(`подготовить ${Math.max(1, m + Math.floor(l / 2))}`);
    if (k.name === 'Изобретатель') parts.push(`подготовить ${Math.max(1, m + Math.ceil(l / 2))}`);
    if (parts.length) out.push(`${k.name} ${l}: ${parts.join(', ')}`);
  }
  return out;
}

export const resolveSpell = (entry) => entry.data || findSpell(entry.ref) || { id: entry.ref, name: '(удалённое заклинание)', level: 0, text: '', classes: [] };

export function MagicView() {
  useStore();
  const c = activeChar(); if (!c) return null;
  if (K.model(c) === '4e') return html`<div class="wrap"><${Powers4e} c=${c} /></div>`;
  return html`<div class="wrap">
    <${CasterCard} c=${c} />
    <${SlotsCard} c=${c} />
    <${SpellList} c=${c} />
  </div>`;
}

function CasterCard({ c }) {
  const dc = K.spellDC(c); const atk = K.spellAtk(c);
  return html`<div class="card">
    <div class="row">
      <${Field} label="Базовая характеристика" cls="grow"><${Select} value=${c.magic.ability} onChange=${v => setPath('magic.ability', v)} options=${[['', '— не заклинатель —'], ...ABILITIES.map(a => [a.key, a.name])]} /><//>
    </div>
    ${c.magic.ability && html`<div class="grid3 mt">
      <div class="stat"><div class="v">${dc}</div><div class="k">Сл спасброска</div></div>
      <button class="stat tap" onClick=${() => K.rollCheck(atk, 'Атака заклинанием')}><div class="v">${fmt(atk)}</div><div class="k">Атака</div></button>
      <div class="stat"><div class="v">${fmt(K.am(c, c.magic.ability))}</div><div class="k">Модификатор</div></div>
    </div>
    <details class="mt"><summary class="tiny faint">Дополнительные бонусы (фокусировка, предметы)</summary>
      <div class="grid2 mt"><${Field} label="К Сл"><${NumIn} value=${c.magic.dcMisc} onChange=${v => setPath('magic.dcMisc', v)} /><//><${Field} label="К атаке"><${NumIn} value=${c.magic.atkMisc} onChange=${v => setPath('magic.atkMisc', v)} /><//></div></details>`}
  </div>`;
}

function SlotRow({ label, sub, max, used, onSpend, onRestore, pact }) {
  const left = max - used;
  return html`<div class="listrow" style="align-items:center">
    <div style="min-width:74px"><div class="t">${label}</div>${sub && html`<div class="tiny faint">${sub}</div>`}</div>
    <div class="grow">
      <div class="slots">${Array.from({ length: max }, (_, i) => html`<span class=${'slot' + (pact ? ' pact' : '') + (i >= left ? ' used' : '')}></span>`)}</div>
      <div class="tiny muted" style="margin-top:2px">свободно <b class=${left ? 'gold-t' : 'red-t'}>${left}</b> из ${max}</div>
    </div>
    <button class="btn sm" disabled=${left <= 0} onClick=${onSpend} title="Потратить ячейку">−1</button>
    <button class="btn sm ghost" disabled=${used <= 0} onClick=${onRestore} title="Вернуть ячейку">+1</button>
  </div>`;
}
function SlotsCard({ c }) {
  const [edit, setEdit] = useState(false);
  const t = slotTable(c); const is5 = K.model(c) === '5e';
  const levels = Object.entries(t.slots).filter(([, s]) => s.max > 0 || (edit && !t.auto));
  const setUsed = (lvl, v) => updChar(ch => { ch.magic.slots[lvl] = ch.magic.slots[lvl] || { max: t.slots[lvl].max, used: 0 }; ch.magic.slots[lvl].used = Math.max(0, Math.min(t.slots[lvl].max, v)); });
  const hasAny = levels.length > 0 || t.pact;
  return html`<div class="card"><h3><${Icon} n="gem" /> Ячейки заклинаний <span class="grow"></span>
      <button class="btn sm ghost" onClick=${() => setEdit(!edit)}>${edit ? 'Готово' : 'Настроить'}</button></h3>
    ${!edit && hasAny && html`<p class="tiny faint" style="margin:-4px 0 6px">Голубой ромб — свободная ячейка, пустой — потраченная. «−1» тратит, «+1» возвращает. Сотворение заклинания из списка ниже тратит ячейку само.</p>`}
    ${edit && is5 && html`<label class="check mb"><input type="checkbox" checked=${c.magic.autoSlots} onChange=${e => setPath('magic.autoSlots', e.target.checked)} /> Считать автоматически по классам и уровням</label>`}
    ${!hasAny && html`<div class="small faint">${t.auto ? 'У ваших классов на этом уровне нет ячеек заклинаний.' : 'Нажмите «Настроить», чтобы задать число ячеек.'}</div>`}
    ${edit && !t.auto ? html`${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => html`<div class="listrow"><span class="grow">${l} круг — всего ячеек</span><${NumIn} value=${(t.slots[l] || {}).max || 0} onChange=${v => setPath(`magic.slots.${l}`, { max: v, used: 0 })} /></div>`)}
        <div class="listrow"><span class="grow">Ячейки договора: число / круг</span><${NumIn} value=${c.magic.pact.max} onChange=${v => setPath('magic.pact.max', v)} /><${NumIn} value=${c.magic.pact.level} onChange=${v => setPath('magic.pact.level', v)} /></div>`
      : html`
        ${levels.map(([lvl, s]) => html`<${SlotRow} label=${lvl + ' круг'} max=${s.max} used=${s.used} onSpend=${() => setUsed(lvl, s.used + 1)} onRestore=${() => setUsed(lvl, s.used - 1)} />`)}
        ${t.pact && html`<${SlotRow} pact label="Договор" sub=${t.pact.level + ' круг · короткий отдых'} max=${t.pact.max} used=${t.pact.used}
          onSpend=${() => setPath('magic.pact.used', Math.min(t.pact.max, t.pact.used + 1))} onRestore=${() => setPath('magic.pact.used', Math.max(0, t.pact.used - 1))} />`}`}
    ${!edit && hasAny && html`<button class="btn sm ghost mt" onClick=${() => updChar(ch => { for (const k of Object.keys(ch.magic.slots)) ch.magic.slots[k].used = 0; ch.magic.pact.used = 0; })}><${Icon} n="rotate-ccw" cls="s" /> Восстановить все</button>`}
    ${t.pact && levels.length > 0 && html`<p class="hint">Ячейки договора колдуна и обычные ячейки других классов считаются отдельно.</p>`}
  </div>`;
}

function SpellList({ c }) {
  const [f, setF] = useState('all');
  const entries = c.magic.spells.map(e => ({ e, s: resolveSpell(e) }));
  const shown = entries.filter(({ e, s }) => f === 'all' || (f === 'prep' && (e.prepared || s.level === 0)));
  const byLvl = {};
  for (const x of shown) (byLvl[x.s.level] = byLvl[x.s.level] || []).push(x);
  const prepCount = entries.filter(({ e, s }) => e.prepared && s.level > 0).length;
  return html`<div>
    <div class="row between mt"><div class="section-title" style="margin:6px 4px">Заклинания</div>
      <button class="btn sm gold" onClick=${openPicker}><${Icon} n="plus" cls="s" /> Добавить</button></div>
    ${spellCapacity(c).map(t => html`<div class="tiny muted" style="margin:-4px 4px 6px">${t}${c.edition === '2024' ? ' (по таблице 2014, в 2024 число подготовленных — по таблице класса)' : ''}</div>`)}
    <div class="row between mb"><${Toggle} value=${f} onChange=${setF} options=${[['all', 'Все'], ['prep', 'Подготовленные']]} />
      <span class="small muted">Подготовлено: ${prepCount}</span></div>
    ${!entries.length ? html`<${Empty} icon="sparkles">Добавьте заклинания из справочника — они появятся здесь, сгруппированные по кругам.</${Empty}>`
      : Object.keys(byLvl).sort((a, b) => a - b).map(l => html`<div class="card tight">
        <div class="lbl" style="margin:4px 2px 2px">${levelName(Number(l))}</div>
        ${byLvl[l].sort((a, b) => a.s.name.localeCompare(b.s.name, 'ru')).map(({ e, s }) => html`<div class="listrow">
          ${s.level > 0 ? html`<button class=${'dot' + (e.prepared ? ' on' : '')} onClick=${() => updChar(ch => { const x = ch.magic.spells.find(y => y.id === e.id); x.prepared = !x.prepared; })} aria-label="Подготовлено"></button>` : html`<span style="width:20px"></span>`}
          <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => openSpell(e)}>
            <div class="t">${s.name}${s.concentration ? html` <span class="chip blue" style="padding:0 6px">К</span>` : ''}${s.ritual ? html` <span class="chip" style="padding:0 6px">Р</span>` : ''}</div>
            <div class="tiny faint">${[s.time, s.range, s.duration].filter(Boolean).join(' · ')}</div></button>
          <button class="btn sm" onClick=${() => cast(e)}>${s.level === 0 ? 'Применить' : 'Сотворить'}</button>
        </div>`)}</div>`)}
  </div>`;
}

function openSpell(e) {
  openModal(close => { const s = resolveSpell(e); return html`<div class="detail">
    <h2>${s.name}</h2><div class="en">${s.en || ''}</div><${SpellBody} s=${s} />
    <${Field} label="Мои заметки" cls="mt"><${Area} rows=${2} value=${e.note || ''} onChange=${v => updChar(ch => { ch.magic.spells.find(y => y.id === e.id).note = v; })} /><//>
    <div class="row mt2"><button class="btn red" onClick=${async () => { if (await confirmBox(`Убрать «${s.name}» из листа?`, { ok: 'Убрать' })) { updChar(ch => { ch.magic.spells = ch.magic.spells.filter(y => y.id !== e.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>
      <button class="btn gold grow" onClick=${() => { close(); cast(e); }}>${s.level === 0 ? 'Применить' : 'Сотворить'}</button></div>
  </div>`; }, { title: 'Заклинание', full: true });
}

export function cast(e) {
  const c = activeChar(); const s = resolveSpell(e);
  const conc = () => { if (s.concentration) { if (c.concentration && c.concentration !== s.name) toast(`Концентрация на «${c.concentration}» прервана`); updChar(ch => { ch.concentration = s.name; }); } };
  if (s.level === 0) { conc(); toast(`${s.name}`, 'good'); return; }
  const t = slotTable(c);
  const options = [];
  for (let l = s.level; l <= 9; l++) { const sl = t.slots[l]; if (sl && sl.max > 0) options.push({ kind: 'slot', l, left: sl.max - sl.used }); }
  if (t.pact && t.pact.level >= s.level) options.push({ kind: 'pact', l: t.pact.level, left: t.pact.max - t.pact.used });
  openModal(close => html`<div>
    <p class="muted" style="margin-top:0">Какую ячейку потратить на «${s.name}»?</p>
    ${options.length ? options.map(o => html`<button class="menu-item" disabled=${o.left <= 0} style=${o.left <= 0 ? 'opacity:.4' : ''} onClick=${() => {
      updChar(ch => { if (o.kind === 'pact') ch.magic.pact.used = n(ch.magic.pact.used) + 1; else { ch.magic.slots[o.l] = ch.magic.slots[o.l] || { max: t.slots[o.l].max, used: 0 }; ch.magic.slots[o.l].used = n(ch.magic.slots[o.l].used) + 1; } });
      conc(); toast(`«${s.name}» сотворено ячейкой ${o.l} круга`, 'good'); close();
    }}><${Icon} n=${o.kind === 'pact' ? 'flame' : 'gem'} /><span class="grow">${o.kind === 'pact' ? 'Ячейка договора' : 'Ячейка'} ${o.l} круга${o.l > s.level ? ' (усиленное)' : ''}</span><span class="chip">${o.left}</span></button>`)
      : html`<p class="small faint">Нет подходящих ячеек.</p>`}
    ${s.ritual && html`<button class="menu-item" onClick=${() => { conc(); toast(`«${s.name}» сотворено как ритуал (+10 минут)`, 'good'); close(); }}><${Icon} n="hourglass" /><span class="grow">Как ритуал (без ячейки)</span></button>`}
    <button class="menu-item" onClick=${() => { conc(); close(); }}><${Icon} n="wand-sparkles" /><span class="grow">Без ячейки (умение, предмет)</span></button>
  </div>`, { title: 'Сотворение' });
}

// ---------- Выбор заклинаний из справочника ----------
export function openPicker() { openModal(close => html`<${Picker} close=${close} />`, { title: 'Добавить заклинание', full: true }); }
function Picker({ close }) {
  const c = activeChar();
  const myClasses = (c.classes || []).map(k => CLASS_EN[k.name]).filter(Boolean);
  const [q, setQ] = useState(''); const [lvl, setLvl] = useState(''); const [book, setBook] = useState(''); const [onlyMine, setOnlyMine] = useState(myClasses.length > 0);
  const have = new Set(c.magic.spells.map(e => e.ref));
  const nq = q.toLowerCase().replace(/ё/g, 'е');
  const list = getList('spells').filter(s => matchBook(srcOf(s), book) && (!nq || s.name.toLowerCase().replace(/ё/g, 'е').includes(nq) || (s.en || '').toLowerCase().includes(nq) || (s.alt || '').includes(nq))
    && (lvl === '' || s.level === Number(lvl)) && (!onlyMine || s.custom || (s.classes || []).some(k => myClasses.includes(k))));
  const add = (s) => { updChar(ch => ch.magic.spells.push({ id: uid(), ref: s.id, prepared: s.level === 0 })); toast(`+ ${s.name}`, 'good'); };
  const remove = (s) => updChar(ch => { ch.magic.spells = ch.magic.spells.filter(e => e.ref !== s.id); });
  return html`<div>
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Поиск заклинания" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    <div class="grid2 mb"><${Select} value=${lvl} onChange=${setLvl} options=${[['', 'Все круги'], ...[...Array(10).keys()].map(l => [String(l), levelName(l)])]} />
      <${Select} value=${book} onChange=${setBook} options=${[['', 'Все книги'], ...booksIn(getList('spells')).map(([k, n]) => [k, n])]} />
      ${myClasses.length > 0 && html`<label class="check" style="white-space:nowrap"><input type="checkbox" checked=${onlyMine} onChange=${e => setOnlyMine(e.target.checked)} /> Мои классы</label>`}</div>
    ${list.slice(0, 250).map(s => html`<div class="libitem" style="padding:8px 10px">
      <div class=${'lvlbadge' + (s.level === 0 ? ' cantrip' : '')}>${s.level === 0 ? 'З' : s.level}</div>
      <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => openModal(() => html`<div class="detail"><h2>${s.name}</h2><div class="en">${s.en}</div><${SpellBody} s=${s} /></div>`, { title: 'Заклинание', full: true })}>
        <div class="nm">${s.name}</div><div class="meta">${spellMeta(s)}</div></button>
      ${have.has(s.id) ? html`<button class="iconbtn bordered" onClick=${() => remove(s)} aria-label="Убрать"><${Icon} n="check" cls="s" /></button>`
        : html`<button class="iconbtn bordered" onClick=${() => add(s)} aria-label="Добавить"><${Icon} n="plus" cls="s" /></button>`}
    </div>`)}
    ${!list.length && html`<${Empty} icon="search">Не найдено</${Empty}>`}
    <button class="btn block mt" onClick=${() => { openCustomEditor('spells'); }}><${Icon} n="pencil" cls="s" /> Создать своё заклинание</button>
    <button class="btn gold block mt" onClick=${close}>Готово</button>
  </div>`;
}

// ---------- 4e: таланты ----------
const PTYPES = [['atwill', 'Неограниченный'], ['encounter', 'На сцену'], ['daily', 'На день'], ['utility', 'Приём']];
function Powers4e({ c }) {
  const powers = c.ed.powers || [];
  return html`<div>
    <div class="row between"><div class="section-title" style="margin-top:4px">Таланты (powers)</div><button class="btn sm gold" onClick=${() => openPower()}><${Icon} n="plus" cls="s" /></button></div>
    ${!powers.length && html`<${Empty} icon="zap">Добавьте неограниченные, сценические и ежедневные таланты. Они восстанавливаются при отдыхе.</${Empty}>`}
    ${PTYPES.map(([k, l]) => { const arr = powers.filter(p => p.type === k); return arr.length ? html`<div class="card tight"><div class="lbl" style="margin:4px 2px">${l}</div>
      ${arr.map(p => html`<div class="listrow">${k !== 'atwill' && html`<button class=${'dot' + (!p.used ? ' on' : '')} onClick=${() => updChar(ch => { const x = ch.ed.powers.find(y => y.id === p.id); x.used = !x.used; })}></button>`}
        <button class="grow" style=${'background:none;border:0;text-align:left;padding:0;' + (p.used ? 'opacity:.5' : '')} onClick=${() => openPower(p)}><div class="t">${p.name}</div><div class="tiny faint">${p.action || ''}</div></button></div>`)}</div>` : null; })}
  </div>`;
}
function openPower(p) { openModal(close => html`<${PowerEditor} p=${p} close=${close} />`, { title: p ? 'Талант' : 'Новый талант' }); }
function PowerEditor({ p, close }) {
  const [d, setD] = useState(p ? { ...p } : { name: '', type: 'atwill', action: 'Стандартное действие', text: '', used: false });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const save = () => { if (!d.name.trim()) return; updChar(ch => { ch.ed.powers = ch.ed.powers || []; if (p) Object.assign(ch.ed.powers.find(x => x.id === p.id), d); else ch.ed.powers.push({ ...d, id: uid() }); }); close(); };
  return html`<div>
    <${Field} label="Название"><${TextIn} value=${d.name} onChange=${s('name')} /><//>
    <div class="grid2 mt"><${Field} label="Использование"><${Select} value=${d.type} onChange=${s('type')} options=${PTYPES} /><//><${Field} label="Действие"><${TextIn} value=${d.action} onChange=${s('action')} /><//></div>
    <${Field} label="Описание" cls="mt"><${Area} rows=${6} value=${d.text} onChange=${s('text')} placeholder="Цель, атака, попадание, эффект" /><//>
    ${p && p.text && html`<div class="card tight mt"><${Prose} text=${p.text} /></div>`}
    <div class="row mt">${p && html`<button class="btn red" onClick=${async () => { if (await confirmBox('Удалить талант?')) { updChar(ch => { ch.ed.powers = ch.ed.powers.filter(x => x.id !== p.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
      <button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}>Сохранить</button></div>
  </div>`;
}
export { SCHOOLS };
