// Сумка персонажа: деньги, вес, предметы по месту хранения, настройка
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Area, Select, Empty, confirmBox, Toggle } from '../ui.js';
import { activeChar, updChar, setPath, uid, toast, useStore } from '../store.js';
import { COIN_NAMES, COIN_IN_GP, LOCATIONS, ITEM_CATS } from '../rules.js';
import { getList, findById } from '../data/index.js';
import { itemMeta, ItemBody, addItemToChar } from './library.js';
import * as K from '../calc.js';

const n = (v) => Number(v) || 0;
const COIN_COLORS = { pp: '#d9dde3', gp: '#e3bd5b', ep: '#c9c3a0', sp: '#b9bec4', cp: '#c27c4d' };

export function InventoryView() {
  useStore();
  const [view, setView] = useState('loc');
  const c = activeChar(); if (!c) return null;
  const groups = view === 'loc'
    ? LOCATIONS.map(l => ({ key: l.key, name: l.name, items: c.inv.items.filter(i => (i.location || 'backpack') === l.key) }))
    : Object.entries(ITEM_CATS).map(([k, name]) => ({ key: k, name, items: c.inv.items.filter(i => (i.cat || 'other') === k) }));
  const attuned = c.inv.items.filter(i => i.attuned).length;
  return html`<div class="wrap">
    <${MoneyCard} c=${c} />
    <${WeightCard} c=${c} />
    <div class="row between mt"><${Toggle} value=${view} onChange=${setView} options=${[['loc', 'По месту'], ['cat', 'По типу']]} />
      <button class="btn sm gold" onClick=${openAddItem}><${Icon} n="plus" cls="s" /> Предмет</button></div>
    ${attuned > 0 && html`<p class=${'small ' + (attuned > 3 ? 'red-t' : 'muted')}>Настроено предметов: ${attuned}/3</p>`}
    ${!c.inv.items.length && html`<${Empty} icon="backpack">Сумка пуста. Добавьте снаряжение из справочника или создайте свой предмет.</${Empty}>`}
    ${groups.filter(g => g.items.length).map(g => html`<div class="card tight mt">
      <div class="row between" style="margin:4px 2px"><span class="lbl">${g.name}</span><span class="tiny faint">${Math.round(g.items.reduce((s, i) => s + n(i.weight) * n(i.qty), 0) * 100) / 100} фнт</span></div>
      ${g.items.map(i => html`<${ItemRow} i=${i} />`)}</div>`)}
  </div>`;
}

function MoneyCard({ c }) {
  const total = Object.entries(c.inv.money).reduce((s, [k, v]) => s + n(v) * COIN_IN_GP[k], 0);
  return html`<div class="card"><h3><${Icon} n="coins" /> Кошелёк <span class="grow"></span><span class="small muted" style="font-family:var(--sans)">≈ ${Math.round(total * 100) / 100} зм</span></h3>
    <div class="grid4" style="grid-template-columns:repeat(5,1fr)">${COIN_NAMES.map(([k, short]) => html`<div class="coin">
      <div class="c" style=${`background:radial-gradient(circle at 35% 30%, #fff8, ${COIN_COLORS[k]} 60%)`}>${short}</div>
      <input class="inp num" type="number" inputmode="numeric" value=${c.inv.money[k]} onFocus=${e => e.target.select()} onInput=${e => setPath('inv.money.' + k, n(e.target.value))} aria-label=${short} /></div>`)}</div>
    <div class="row mt"><button class="btn sm grow" onClick=${() => openMoney(-1)}><${Icon} n="minus" cls="s" /> Потратить</button><button class="btn sm grow" onClick=${() => openMoney(1)}><${Icon} n="plus" cls="s" /> Получить</button></div>
  </div>`;
}
function openMoney(sign) { openModal(close => html`<${MoneyOp} sign=${sign} close=${close} />`, { title: sign > 0 ? 'Получить деньги' : 'Потратить деньги' }); }
function MoneyOp({ sign, close }) {
  const [amt, setAmt] = useState(''); const [coin, setCoin] = useState('gp');
  const apply = () => {
    const a = n(amt); if (!a) return;
    const c = activeChar();
    if (sign > 0) { updChar(ch => { ch.inv.money[coin] = n(ch.inv.money[coin]) + a; }); close(); return; }
    // Списание с разменом: переводим всё в медь
    const rate = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
    let have = Object.entries(c.inv.money).reduce((s, [k, v]) => s + n(v) * rate[k], 0);
    const need = a * rate[coin];
    if (need > have) return toast('Недостаточно денег', 'bad');
    if (n(c.inv.money[coin]) >= a) { updChar(ch => { ch.inv.money[coin] = n(ch.inv.money[coin]) - a; }); close(); return; }
    have -= need;
    updChar(ch => { const m = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }; for (const k of ['pp', 'gp', 'sp', 'cp']) { m[k] = Math.floor(have / rate[k]); have -= m[k] * rate[k]; } ch.inv.money = m; });
    toast('Списано с разменом монет'); close();
  };
  return html`<div><div class="row"><input class="inp num grow" style="font-size:22px" type="number" inputmode="numeric" value=${amt} onInput=${e => setAmt(e.target.value)} placeholder="0" />
    <${Select} value=${coin} onChange=${setCoin} options=${COIN_NAMES.map(([k, s]) => [k, s])} /></div>
    <button class=${'btn block mt ' + (sign > 0 ? 'green' : 'red')} onClick=${apply}>${sign > 0 ? 'Добавить' : 'Списать'}</button></div>`;
}

function WeightCard({ c }) {
  const w = K.carry(c); const pct = Math.min(100, w.total / Math.max(1, w.cap) * 100);
  const str = n(c.abilities.str);
  const state = w.total > w.cap ? 'Перегружен: скорость 5 фт' : w.total > str * 10 ? 'Сильно нагружен (вариант): −20 фт' : w.total > str * 5 ? 'Нагружен (вариант): −10 фт' : 'Без штрафов';
  return html`<div class="card tight"><div class="row between small"><span><${Icon} n="weight" cls="xs" /> Вес: <b>${w.total}</b> / ${w.cap} фнт</span><span class=${w.total > w.cap ? 'red-t' : 'faint'}>${state}</span></div>
    <div class=${'progress mt' + (w.total > w.cap ? ' over' : '')} style="margin-top:6px"><i style=${`width:${pct}%`}></i></div>
    <div class="tiny faint mt" style="margin-top:4px">Монеты: ${w.coins} шт. (${Math.round(w.coins / 50 * 100) / 100} фнт). Толкать/тянуть до ${w.push} фнт.</div></div>`;
}

function ItemRow({ i }) {
  const step = (d) => updChar(ch => { const x = ch.inv.items.find(y => y.id === i.id); x.qty = Math.max(0, n(x.qty) + d); });
  return html`<div class="listrow">
    ${i.armor || i.cat === 'weapon' || i.cat === 'magic' ? html`<button class=${'dot' + (i.equipped ? ' on' : '')} title="Надето / в руках" onClick=${() => updChar(ch => { const x = ch.inv.items.find(y => y.id === i.id); x.equipped = !x.equipped; if (x.equipped) x.location = 'equipped'; else if (x.location === 'equipped') x.location = 'carried'; })}></button>` : html`<span style="width:20px"></span>`}
    <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => openItem(i)}>
      <div class="t">${i.name}${i.attuned ? html` <span class="chip violet" style="padding:0 6px">настроен</span>` : ''}</div>
      <div class="tiny faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52vw">${[i.weight ? `${i.weight} фнт` : '', i.notes].filter(Boolean).join(' · ')}</div></button>
    <div class="row" style="gap:2px"><button class="iconbtn" style="width:30px" onClick=${() => step(-1)} aria-label="Меньше"><${Icon} n="minus" cls="xs" /></button>
      <span style="min-width:22px;text-align:center;font-weight:700">${i.qty}</span>
      <button class="iconbtn" style="width:30px" onClick=${() => step(1)} aria-label="Больше"><${Icon} n="plus" cls="xs" /></button></div>
  </div>`;
}

function openItem(i) { openModal(close => html`<${ItemEditor} i=${i} close=${close} />`, { title: i ? 'Предмет' : 'Новый предмет', full: true }); }
function ItemEditor({ i, close }) {
  const [d, setD] = useState(i ? { ...i } : { name: '', qty: 1, weight: 0, cat: 'personal', location: 'backpack', equipped: false, attuned: false, cost: '', notes: '' });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const ref = i && i.ref ? findById(i.ref) : null;
  const save = () => { if (!d.name.trim()) return; updChar(ch => { if (i) Object.assign(ch.inv.items.find(x => x.id === i.id), d); else ch.inv.items.push({ ...d, id: uid() }); }); close(); };
  return html`<div>
    <${Field} label="Название"><${TextIn} value=${d.name} onChange=${s('name')} /><//>
    <div class="grid3 mt"><${Field} label="Кол-во"><${NumIn} value=${d.qty} onChange=${s('qty')} /><//><${Field} label="Вес (шт.), фнт"><${NumIn} value=${d.weight} onChange=${s('weight')} step="0.1" /><//><${Field} label="Цена"><${TextIn} value=${d.cost} onChange=${s('cost')} /><//></div>
    <div class="grid2 mt"><${Field} label="Тип"><${Select} value=${d.cat} onChange=${s('cat')} options=${Object.entries(ITEM_CATS)} /><//><${Field} label="Где"><${Select} value=${d.location} onChange=${s('location')} options=${LOCATIONS.map(l => [l.key, l.name])} /><//></div>
    <div class="row wrapr mt"><label class="check"><input type="checkbox" checked=${d.equipped} onChange=${e => s('equipped')(e.target.checked)} /> Надето / в руках</label>
      <label class="check"><input type="checkbox" checked=${d.attuned} onChange=${e => s('attuned')(e.target.checked)} /> Настроен</label></div>
    ${d.cat === 'armor' && html`<div class="card tight mt"><div class="lbl">Параметры брони (для авто-КД)</div>
      <div class="grid3 mt"><${Field} label="Тип"><${Select} value=${(d.armor || {}).type || 'light'} onChange=${v => setD(o => ({ ...o, armor: { ...(o.armor || {}), type: v } }))} options=${[['light', 'Лёгкий'], ['medium', 'Средний'], ['heavy', 'Тяжёлый'], ['shield', 'Щит']]} /><//>
        <${Field} label="Базовый КД"><${NumIn} value=${(d.armor || {}).base ?? 11} onChange=${v => setD(o => ({ ...o, armor: { ...(o.armor || {}), base: v } }))} /><//>
        <${Field} label="Магия +"><${NumIn} value=${(d.armor || {}).bonus || 0} onChange=${v => setD(o => ({ ...o, armor: { ...(o.armor || {}), bonus: v } }))} /><//></div></div>`}
    <${Field} label="Заметки" cls="mt"><${Area} rows=${3} value=${d.notes} onChange=${s('notes')} /><//>
    ${ref && html`<details class="card tight mt"><summary class="small gold-t">Справка: ${ref.name}</summary><${ItemBody} x=${ref} /></details>`}
    <div class="row mt2">${i && html`<button class="btn red" onClick=${async () => { if (await confirmBox(`Выбросить «${i.name}»?`, { ok: 'Удалить' })) { updChar(ch => { ch.inv.items = ch.inv.items.filter(x => x.id !== i.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
      <button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}>Сохранить</button></div>
  </div>`;
}

function openAddItem() { openModal(close => html`<${AddItem} close=${close} />`, { title: 'Добавить в сумку', full: true }); }
function AddItem({ close }) {
  const [cat, setCat] = useState('gear'); const [q, setQ] = useState('');
  const nq = q.toLowerCase();
  const list = getList(cat).filter(x => !nq || x.name.toLowerCase().includes(nq) || (x.en || '').toLowerCase().includes(nq));
  return html`<div>
    <button class="btn block mb" onClick=${() => { close(); openItem(null); }}><${Icon} n="pencil" cls="s" /> Свой предмет (личная вещь, трофей…)</button>
    <div class="tabs">${[['gear', 'Снаряжение'], ['weapons', 'Оружие'], ['armor', 'Броня'], ['potions', 'Зелья'], ['magic', 'Магические']].map(([k, l]) => html`<button class=${'tab' + (cat === k ? ' on' : '')} onClick=${() => setCat(k)}>${l}</button>`)}</div>
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Поиск" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    ${list.map(x => html`<div class="libitem" style="padding:8px 10px"><div class="grow"><div class="nm">${x.name}</div><div class="meta">${itemMeta(x)}</div></div>
      <button class="iconbtn bordered" onClick=${() => addItemToChar(x)} aria-label="Добавить"><${Icon} n="plus" cls="s" /></button></div>`)}
    <button class="btn gold block mt" onClick=${close}>Готово</button>
  </div>`;
}
