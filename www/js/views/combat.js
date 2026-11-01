// Вкладка «Бой»: хиты, спасброски от смерти, кости хитов, состояния, отдых, атаки, инициатива
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Select, Empty, confirmBox, Prose } from '../ui.js';
import { activeChar, updChar, setPath, uid, toast } from '../store.js';
import { ABILITIES, ABIL, fmt, CONDITION_NAMES, CLASSES } from '../rules.js';
import { CONDITIONS } from '../data/rules-ref.js';
import * as K from '../calc.js';
import { roll } from '../dice.js';
import { RollModeBar } from './sheet.js';
import { computeSlots } from '../rules.js';

const n = (v) => Number(v) || 0;

export function CombatTab({ c }) {
  const md = K.model(c);
  return html`<div>
    <${HPCard} c=${c} />
    ${c.hp.current <= 0 && html`<${DeathSaves} c=${c} />`}
    <${RestCard} c=${c} />
    <${ConditionsCard} c=${c} />
    ${md === '4e' && html`<${Surges4e} c=${c} />`}
    <${RollModeBar} />
    <${AttacksCard} c=${c} />
    <${InitiativeCard} c=${c} />
  </div>`;
}

// ---------- ХИТЫ ----------
export function applyDamage(ch, amount) {
  let a = n(amount); if (a <= 0) return;
  const t = Math.min(n(ch.hp.temp), a); ch.hp.temp = n(ch.hp.temp) - t; a -= t;
  const was = n(ch.hp.current);
  ch.hp.current = Math.max(0, was - a);
  if (was === 0 && a > 0) ch.death.f = Math.min(3, n(ch.death.f) + 1);
  if (ch.concentration) toast(`Концентрация: спасбросок Телосложения Сл ${Math.max(10, Math.floor((t + a) / 2))}`);
}
export function applyHeal(ch, amount) {
  const a = n(amount); if (a <= 0) return;
  if (n(ch.hp.current) === 0) ch.death = { s: 0, f: 0 };
  ch.hp.current = Math.min(n(ch.hp.max), n(ch.hp.current) + a);
}

function HPCard({ c }) {
  const [amt, setAmt] = useState('');
  const max = Math.max(1, n(c.hp.max)); const cur = n(c.hp.current); const tmp = n(c.hp.temp);
  const pct = Math.min(100, cur / max * 100); const tpct = Math.min(100 - pct, tmp / max * 100);
  const act = (fn) => { const v = n(amt); if (!v) return toast('Введите число'); updChar(ch => fn(ch, v)); setAmt(''); };
  return html`<div class="card">
    <div class="row between"><h3 style="margin:0"><${Icon} n="heart" /> Хиты</h3>
      ${c.concentration && html`<span class="chip blue"><${Icon} n="circle-dot" cls="xs" /> ${c.concentration}</span>`}</div>
    <div class="row mt" style="align-items:flex-end">
      <div class="grow"><span class=${'hpbig' + (cur === 0 ? ' red-t' : '')}>${cur}</span><span class="muted serif" style="font-size:24px"> / ${n(c.hp.max)}</span>
        ${tmp > 0 && html`<span class="chip blue" style="margin-left:8px">+${tmp} врем.</span>`}</div>
    </div>
    <div class="hpbar mt"><i style=${`width:${pct}%`}></i>${tmp > 0 && html`<b style=${`left:${pct}%;width:${tpct}%`}></b>`}</div>
    <div class="row mt">
      <button class="btn red" onClick=${() => act(applyDamage)}><${Icon} n="heart-crack" cls="s" /> Урон</button>
      <input class="inp num grow" type="number" inputmode="numeric" placeholder="0" value=${amt} onInput=${e => setAmt(e.target.value)} style="font-size:20px" />
      <button class="btn green" onClick=${() => act(applyHeal)}><${Icon} n="heart" cls="s" /> Лечение</button>
    </div>
    <div class="grid3 mt">
      <${Field} label="Текущие"><${NumIn} value=${c.hp.current} onChange=${v => setPath('hp.current', v)} /><//>
      <${Field} label="Максимум"><${NumIn} value=${c.hp.max} onChange=${v => setPath('hp.max', v)} /><//>
      <${Field} label="Временные"><${NumIn} value=${c.hp.temp} onChange=${v => setPath('hp.temp', v)} /><//>
    </div>
    ${K.model(c) === '5e' && html`<button class="btn sm ghost mt" onClick=${() => { const v = avgMaxHp(c); updChar(ch => { ch.hp.max = v; ch.hp.current = Math.min(n(ch.hp.current) || v, v); }); toast(`Максимум хитов по среднему: ${v}`); }}><${Icon} n="rotate-ccw" cls="s" /> Рассчитать максимум по классам (среднее)</button>`}
    <${HitDiceRow} c=${c} />
  </div>`;
}

// Максимум хитов: максимум кости на 1 уровне первого класса + среднее (к/2+1) дальше, плюс Телосложение за уровень
export function avgMaxHp(c) {
  const con = K.am(c, 'con'); let hp = 0; let first = true;
  for (const k of c.classes || []) {
    const die = (CLASSES[k.name] || {}).hd || n(k.hd) || 8;
    for (let i = 0; i < n(k.level); i++) { hp += (first ? die : die / 2 + 1) + con; first = false; }
  }
  return Math.max(1, hp);
}

function HitDiceRow({ c }) {
  const hd = K.hitDice(c); const con = K.am(c, 'con');
  const spend = (die) => {
    const r = roll(`1d${die}${con >= 0 ? '+' : ''}${con}`, { label: `Кость хитов к${die}` });
    if (!r) return;
    updChar(ch => { ch.hitDiceUsed[die] = n(ch.hitDiceUsed[die]) + 1; applyHeal(ch, Math.max(1, r.total)); });
  };
  if (!hd.length) return null;
  return html`<div class="mt"><div class="lbl">Кости хитов</div><div class="row wrapr mt" style="margin-top:6px">${hd.map(h => html`
    <button class="chip" disabled=${h.used >= h.count} onClick=${() => spend(h.die)} style=${h.used >= h.count ? 'opacity:.4' : ''}>
      <${Icon} n="dice-5" cls="xs" /> к${h.die}: ${h.count - h.used}/${h.count}</button>`)}
    <span class="tiny faint">нажмите, чтобы потратить</span></div></div>`;
}

function DeathSaves({ c }) {
  const rollDS = () => {
    const r = roll('1d20', { label: 'Спасбросок от смерти' }); if (!r) return;
    updChar(ch => {
      const v = r.nat ?? r.total;
      if (v === 20) { ch.hp.current = 1; ch.death = { s: 0, f: 0 }; toast('Вы приходите в себя с 1 хитом!', 'good'); }
      else if (v === 1) ch.death.f = Math.min(3, n(ch.death.f) + 2);
      else if (v >= 10) ch.death.s = Math.min(3, n(ch.death.s) + 1);
      else ch.death.f = Math.min(3, n(ch.death.f) + 1);
      if (ch.death.s >= 3) toast('Стабилизирован', 'good');
      if (ch.death.f >= 3) toast('Персонаж погиб…', 'bad');
    });
  };
  const dots = (k, cls) => [0, 1, 2].map(i => html`<button class=${'dot ' + cls + (n(c.death[k]) > i ? ' on' : '')} onClick=${() => setPath('death.' + k, n(c.death[k]) > i ? i : i + 1)}></button>`);
  return html`<div class="card" style="border-color:rgba(196,84,74,.6)"><h3 class="red-t"><${Icon} n="skull" /> Спасброски от смерти</h3>
    <div class="row between"><div><div class="lbl">Успехи</div><div class="row mt" style="margin-top:6px">${dots('s', 'green')}</div></div>
      <div><div class="lbl">Провалы</div><div class="row mt" style="margin-top:6px">${dots('f', 'red')}</div></div>
      <button class="btn" onClick=${rollDS}><${Icon} n="dices" cls="s" /> Бросок</button></div>
  </div>`;
}

// ---------- ОТДЫХ ----------
function RestCard({ c }) {
  return html`<div class="row mb">
    <button class="btn grow" onClick=${() => openShortRest()}><${Icon} n="hourglass" cls="s" /> Короткий отдых</button>
    <button class="btn grow" onClick=${async () => { if (await confirmBox('Продолжительный отдых: восстановить хиты, ячейки, умения и половину костей хитов?', { ok: 'Отдохнуть', danger: false })) longRest(); }}><${Icon} n="bed" cls="s" /> Долгий отдых</button>
  </div>`;
}
export function longRest() {
  updChar(ch => {
    ch.hp.current = n(ch.hp.max); ch.hp.temp = 0; ch.death = { s: 0, f: 0 };
    for (const k of Object.keys(ch.magic.slots)) ch.magic.slots[k].used = 0;
    ch.magic.pact.used = 0;
    for (const f of ch.features) if (f.reset !== 'none') f.used = 0;
    for (const p of ch.ed.powers || []) if (p.type !== 'atwill') p.used = false;
    ch.ed.surgesUsed = 0;
    // Кости хитов: восстанавливается половина от общего числа (минимум 1)
    const total = (ch.classes || []).reduce((s, k) => s + n(k.level), 0);
    let back = Math.max(1, Math.floor(total / 2));
    for (const d of Object.keys(ch.hitDiceUsed).sort((a, b) => b - a)) { const r = Math.min(back, n(ch.hitDiceUsed[d])); ch.hitDiceUsed[d] = n(ch.hitDiceUsed[d]) - r; back -= r; }
    if (n(ch.exhaustion) > 0) ch.exhaustion = n(ch.exhaustion) - 1;
    ch.concentration = '';
  });
  toast('Продолжительный отдых завершён', 'good');
}
function openShortRest() { openModal(close => html`<${ShortRest} close=${close} />`, { title: 'Короткий отдых' }); }
function ShortRest({ close }) {
  const c = activeChar();
  const finish = () => {
    updChar(ch => { for (const f of ch.features) if (f.reset === 'short') f.used = 0; ch.magic.pact.used = 0; for (const p of ch.ed.powers || []) if (p.type === 'encounter') p.used = false; });
    toast('Короткий отдых завершён: умения «до короткого отдыха» и ячейки договора восстановлены', 'good'); close();
  };
  return html`<div>
    <p class="muted small">Потратьте кости хитов, чтобы восстановить хиты. Каждая кость: бросок + модификатор Телосложения (${fmt(K.am(c, 'con'))}).</p>
    <div class="center"><span class="hpbig">${c.hp.current}</span><span class="muted"> / ${c.hp.max}</span></div>
    <${HitDiceRow} c=${c} />
    <button class="btn gold block mt2" onClick=${finish}>Завершить отдых</button>
  </div>`;
}

// ---------- СОСТОЯНИЯ ----------
function ConditionsCard({ c }) {
  const toggle = (name) => updChar(ch => { ch.conditions = ch.conditions.includes(name) ? ch.conditions.filter(x => x !== name) : [...ch.conditions, name]; });
  const info = (name) => { const row = CONDITIONS.find(x => x[0].startsWith(name.split(' ')[0])); if (row) openModal(() => html`<${Prose} text=${row[2]} />`, { title: row[0] }); };
  const [edit, setEdit] = useState(false);
  return html`<div class="card"><h3><${Icon} n="eye" /> Состояния <span class="grow"></span><button class="btn sm ghost" onClick=${() => setEdit(!edit)}>${edit ? 'Готово' : 'Изменить'}</button></h3>
    ${edit ? html`<div class="row wrapr">${CONDITION_NAMES.filter(x => x !== 'Истощённый').map(nm => html`<button class=${'chip' + (c.conditions.includes(nm) ? ' cond-on' : '')} onClick=${() => toggle(nm)}>${nm}</button>`)}</div>`
      : c.conditions.length ? html`<div class="row wrapr">${c.conditions.map(nm => html`<button class="chip red" onClick=${() => info(nm)}>${nm} <${Icon} n="info" cls="xs" /></button>`)}</div>`
        : html`<div class="small faint">Нет активных состояний</div>`}
    <div class="row mt"><span class="grow">Истощение</span>
      <div class="row" style="gap:4px">${[1, 2, 3, 4, 5, 6].map(i => html`<button class=${'dot red' + (n(c.exhaustion) >= i ? ' on' : '')} onClick=${() => setPath('exhaustion', n(c.exhaustion) >= i ? i - 1 : i)}></button>`)}</div>
      <button class="iconbtn" onClick=${() => info('Истощённый')}><${Icon} n="info" cls="s" /></button></div>
    <div class="row mt"><${Icon} n="circle-dot" cls="s" /><input class="inp grow" placeholder="Концентрация на заклинании…" value=${c.concentration} onInput=${e => setPath('concentration', e.target.value)} />
      ${c.concentration && html`<button class="iconbtn" onClick=${() => setPath('concentration', '')}><${Icon} n="x" cls="s" /></button>`}</div>
  </div>`;
}

function Surges4e({ c }) {
  const val = Math.floor(n(c.hp.max) / 4);
  return html`<div class="card"><h3><${Icon} n="heart" /> Исцеления (healing surges)</h3>
    <div class="row"><span class="grow">Величина: <b>${val}</b> · осталось ${n(c.ed.surges) - n(c.ed.surgesUsed)} из</span>
      <input class="inp num" style="width:60px" type="number" value=${c.ed.surges} onInput=${e => setPath('ed.surges', n(e.target.value))} />
      <button class="btn sm green" onClick=${() => { if (n(c.ed.surgesUsed) >= n(c.ed.surges)) return toast('Исцеления закончились'); updChar(ch => { ch.ed.surgesUsed = n(ch.ed.surgesUsed) + 1; applyHeal(ch, val); }); }}>Потратить</button></div>
  </div>`;
}

// ---------- АТАКИ ----------
function AttacksCard({ c }) {
  const spellAtk = K.spellAtk(c);
  return html`<div class="card"><h3><${Icon} n="swords" /> Атаки <span class="grow"></span><button class="btn sm" onClick=${() => openAttack()}><${Icon} n="plus" cls="s" /></button></h3>
    ${c.attacks.length ? c.attacks.map(a => { const { atk } = K.attackBonus(c, a); const dmg = K.damageFormula(c, a); return html`<div class="listrow">
      <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => openAttack(a)}>
        <div class="t">${a.name}</div><div class="tiny faint">${[a.range, dmg && `${dmg.replace(/d/g, 'к')} ${a.dtype || ''}`, a.notes].filter(Boolean).join(' · ')}</div></button>
      <button class="bonus" onClick=${() => K.rollCheck(atk, `Атака: ${a.name}`)}>${fmt(atk)}</button>
      ${dmg && html`<button class="btn sm" onClick=${() => roll(dmg, { label: `Урон: ${a.name}` })}>урон</button>`}
      ${dmg && html`<button class="btn sm ghost" title="Критический урон" onClick=${() => roll(critFormula(dmg), { label: `Крит: ${a.name}` })}>крит</button>`}
    </div>`; }) : html`<div class="small faint">Добавьте оружие из справочника («Как атаку») или вручную.</div>`}
    ${spellAtk != null && html`<div class="listrow"><div class="grow"><div class="t">Атака заклинанием</div><div class="tiny faint">Сл спасброска ${K.spellDC(c)}</div></div>
      <button class="bonus" onClick=${() => K.rollCheck(spellAtk, 'Атака заклинанием')}>${fmt(spellAtk)}</button></div>`}
  </div>`;
}
const critFormula = (f) => f.replace(/(\d*)d(\d+)/g, (m, cnt, s) => `${(Number(cnt) || 1) * 2}d${s}`);

function openAttack(a) { openModal(close => html`<${AttackEditor} a=${a} close=${close} />`, { title: a ? 'Атака' : 'Новая атака' }); }
function AttackEditor({ a, close }) {
  const c = activeChar();
  const [d, setD] = useState(a ? { ...a } : { name: '', ability: 'str', prof: true, bonus: 0, dmg: '1к8', dmgBonus: true, dmgExtra: 0, dtype: 'рубящий', range: '5 фт', notes: '' });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const save = () => { if (!d.name.trim()) return; updChar(ch => { if (a) Object.assign(ch.attacks.find(x => x.id === a.id), d); else ch.attacks.push({ ...d, id: uid() }); }); close(); };
  const preview = K.attackBonus(c, d);
  return html`<div>
    <${Field} label="Название"><${TextIn} value=${d.name} onChange=${s('name')} /><//>
    <div class="grid2 mt"><${Field} label="Характеристика"><${Select} value=${d.ability} onChange=${s('ability')} options=${[['str', 'Сила'], ['dex', 'Ловкость'], ['best', 'Лучшая из СИЛ/ЛОВ'], ['spell', 'Заклинательная'], ...ABILITIES.slice(2).map(x => [x.key, x.name]), ['none', 'Без модификатора']]} /><//>
      <${Field} label="Доп. бонус к атаке"><${NumIn} value=${d.bonus} onChange=${s('bonus')} /><//></div>
    <label class="check mt"><input type="checkbox" checked=${d.prof} onChange=${e => s('prof')(e.target.checked)} /> Владение (бонус мастерства)</label>
    <div class="grid3 mt"><${Field} label="Урон"><${TextIn} value=${d.dmg} onChange=${s('dmg')} placeholder="1к8" /><//><${Field} label="Доп. урон"><${NumIn} value=${d.dmgExtra} onChange=${s('dmgExtra')} /><//><${Field} label="Вид урона"><${TextIn} value=${d.dtype} onChange=${s('dtype')} /><//></div>
    <label class="check mt"><input type="checkbox" checked=${d.dmgBonus} onChange=${e => s('dmgBonus')(e.target.checked)} /> Добавлять модификатор характеристики к урону</label>
    <div class="grid2 mt"><${Field} label="Дистанция"><${TextIn} value=${d.range} onChange=${s('range')} /><//><${Field} label="Заметки"><${TextIn} value=${d.notes} onChange=${s('notes')} /><//></div>
    <p class="hint">Итог: атака ${fmt(preview.atk)}, урон ${K.damageFormula(c, d).replace(/d/g, 'к') || '—'}</p>
    <div class="row mt">${a && html`<button class="btn red" onClick=${async () => { if (await confirmBox('Удалить атаку?')) { updChar(ch => { ch.attacks = ch.attacks.filter(x => x.id !== a.id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>`}
      <button class="btn grow" onClick=${close}>Отмена</button><button class="btn gold grow" onClick=${save}>Сохранить</button></div>
  </div>`;
}

// ---------- ИНИЦИАТИВА ----------
function InitiativeCard({ c }) {
  const list = [...c.combat.list].sort((a, b) => n(b.init) - n(a.init));
  const cur = list[c.combat.turn % Math.max(1, list.length)];
  const addMe = () => { const r = K.rollCheck(K.initiative(c), 'Инициатива'); if (!r) return; updChar(ch => { ch.combat.list = ch.combat.list.filter(x => !x.me); ch.combat.list.push({ id: uid(), name: ch.name, init: r.total, me: true }); }); };
  const addOther = () => openModal(close => html`<${InitAdd} close=${close} />`, { title: 'Участник боя' });
  const next = () => updChar(ch => { const len = ch.combat.list.length; if (!len) return; ch.combat.turn = (ch.combat.turn + 1) % len; if (ch.combat.turn === 0) ch.combat.round += 1; });
  return html`<div class="card"><h3><${Icon} n="arrow-up-down" /> Инициатива <span class="grow"></span>${list.length > 0 && html`<span class="chip gold">Раунд ${c.combat.round}</span>`}</h3>
    ${list.length ? list.map(x => html`<div class=${'listrow initrow' + (cur && cur.id === x.id ? ' active' : '')}>
      <input class="inp num" style="width:52px" type="number" value=${x.init} onInput=${e => updChar(ch => { ch.combat.list.find(y => y.id === x.id).init = n(e.target.value); })} />
      <span class="grow" style=${x.me ? 'font-weight:700;color:var(--gold2)' : ''}>${x.name}</span>
      ${x.hp != null && html`<input class="inp num" style="width:58px" type="number" value=${x.hp} onInput=${e => updChar(ch => { ch.combat.list.find(y => y.id === x.id).hp = n(e.target.value); })} aria-label="Хиты" />`}
      <button class="iconbtn" onClick=${() => updChar(ch => { ch.combat.list = ch.combat.list.filter(y => y.id !== x.id); })}><${Icon} n="x" cls="s" /></button></div>`)
      : html`<div class="small faint">Бросьте инициативу и добавьте врагов и союзников, чтобы отслеживать очерёдность.</div>`}
    <div class="row wrapr mt">
      <button class="btn sm gold" onClick=${addMe}><${Icon} n="dices" cls="s" /> Я</button>
      ${c.companions.length > 0 && html`<button class="btn sm" onClick=${() => updChar(ch => { for (const cp of ch.companions) if (!ch.combat.list.some(x => x.cid === cp.id)) { const ini = Math.floor(Math.random() * 20) + 1 + Math.floor(((cp.ab || [])[1] - 10) / 2 || 0); ch.combat.list.push({ id: uid(), cid: cp.id, name: cp.name, init: ini, hp: cp.hp.current }); } })}><${Icon} n="paw-print" cls="s" /> Спутники</button>`}
      <button class="btn sm" onClick=${addOther}><${Icon} n="plus" cls="s" /> Участник</button>
      <div class="grow"></div>
      ${list.length > 0 && html`<button class="btn sm" onClick=${next}>Следующий ход <${Icon} n="chevron-right" cls="s" /></button>
        <button class="btn sm ghost" onClick=${async () => { if (await confirmBox('Завершить бой и очистить список?', { ok: 'Завершить' })) updChar(ch => { ch.combat = { list: [], round: 1, turn: 0 }; }); }}>Конец</button>`}
    </div>
  </div>`;
}
function InitAdd({ close }) {
  const [d, setD] = useState({ name: '', init: '', hp: '', count: 1 });
  const s = (k) => (v) => setD(o => ({ ...o, [k]: v }));
  const add = () => {
    if (!d.name.trim()) return;
    updChar(ch => { for (let i = 0; i < Math.max(1, n(d.count)); i++) ch.combat.list.push({ id: uid(), name: n(d.count) > 1 ? `${d.name} ${i + 1}` : d.name, init: d.init === '' ? Math.floor(Math.random() * 20) + 1 : n(d.init), hp: d.hp === '' ? null : n(d.hp) }); });
    close();
  };
  return html`<div>
    <${Field} label="Имя"><${TextIn} value=${d.name} onChange=${s('name')} placeholder="Гоблин" /><//>
    <div class="grid3 mt"><${Field} label="Инициатива"><${NumIn} value=${d.init} onChange=${s('init')} placeholder="к20" /><//><${Field} label="Хиты"><${NumIn} value=${d.hp} onChange=${s('hp')} /><//><${Field} label="Количество"><${NumIn} value=${d.count} onChange=${s('count')} /><//></div>
    <p class="hint">Пустая инициатива — бросок к20.</p>
    <button class="btn gold block mt" onClick=${add}>Добавить</button>
  </div>`;
}

export { computeSlots, CLASSES, ABIL };
