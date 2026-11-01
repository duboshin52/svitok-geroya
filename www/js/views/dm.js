// Инструменты мастера: конструктор сражений, трекер боя, генераторы, таблицы
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Select, Tabs, Empty, Toggle, confirmBox, pickOne } from '../ui.js';
import { getState, setState, useStore, uid, toast } from '../store.js';
import { CR_XP, crValue, SIZES, mod, fmt, CONDITION_NAMES } from '../rules.js';
import { getList } from '../data/index.js';
import { MAGIC_ITEMS, POTIONS } from '../data/items.js';
import { MonsterBody } from './library.js';
import { roll } from '../dice.js';

const n = (v) => Number(v) || 0;
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const d = (sides, count = 1) => { let s = 0; for (let i = 0; i < count; i++) s += 1 + Math.floor(Math.random() * sides); return s; };
const dm = () => getState().dm;
const updDM = (fn) => setState(s => { fn(s.dm); return s; });

export function openDM() { openModal(() => html`<${DMView} />`, { title: 'Инструменты мастера', full: true }); }

let dmTab = 'enc';
function DMView() {
  useStore();
  const [t, setT] = useState(dmTab);
  const go = (k) => { dmTab = k; setT(k); };
  return html`<div>
    <${Tabs} value=${t} onChange=${go} tabs=${[['enc', 'Сражение'], ['init', 'Трекер боя'], ['gen', 'Генераторы'], ['tables', 'Таблицы']]} />
    ${t === 'enc' && html`<${EncounterBuilder} />`}
    ${t === 'init' && html`<${DMTracker} />`}
    ${t === 'gen' && html`<${Generators} />`}
    ${t === 'tables' && html`<${Tables} />`}
  </div>`;
}

// ===================== КОНСТРУКТОР СРАЖЕНИЙ =====================
const TH14 = [null, [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]];
const TH24 = [null, [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000]];
const mult = (count) => count <= 1 ? 1 : count === 2 ? 1.5 : count <= 6 ? 2 : count <= 10 ? 2.5 : count <= 14 ? 3 : 4;

function EncounterBuilder() {
  const D = dm(); const p = D.party; const ed = p.ed || '5e';
  const lvl = Math.max(1, Math.min(20, n(p.level))); const size = Math.max(1, n(p.size));
  const total = D.enc.reduce((s, e) => s + (CR_XP[e.cr] || 0) * n(e.count), 0);
  const count = D.enc.reduce((s, e) => s + n(e.count), 0);
  let verdict, rows;
  if (ed === '2024') {
    const b = TH24[lvl].map(x => x * size); rows = [['Низкая', b[0]], ['Умеренная', b[1]], ['Высокая', b[2]]];
    verdict = total === 0 ? '—' : total <= b[0] ? 'Низкая' : total <= b[1] ? 'Умеренная' : total <= b[2] ? 'Высокая' : 'Выше высокой — очень опасно';
  } else {
    const b = TH14[lvl].map(x => x * size); const adj = Math.round(total * mult(count));
    rows = [['Лёгкая', b[0]], ['Средняя', b[1]], ['Сложная', b[2]], ['Смертельная', b[3]]];
    verdict = total === 0 ? '—' : adj < b[0] ? 'Тривиальная' : adj < b[1] ? 'Лёгкая' : adj < b[2] ? 'Средняя' : adj < b[3] ? 'Сложная' : 'Смертельная';
    rows.push(['С множителем ×' + mult(count), adj]);
  }
  const add = async () => {
    const list = getList('monsters');
    const id = await pickOne({ title: 'Существо', options: list.map(m => ({ value: m.id, label: m.name, hint: `ПО ${m.cr} · ${CR_XP[m.cr] || 0} опыта · ${SIZES[m.size] || ''} ${m.type}` })), value: '', custom: false });
    if (!id) return; const m = list.find(x => x.id === id);
    updDM(x => { const ex = x.enc.find(e => e.ref === id); if (ex) ex.count = n(ex.count) + 1; else x.enc.push({ id: uid(), ref: id, name: m.name, cr: m.cr, count: 1 }); });
  };
  return html`<div>
    <div class="card"><h3><${Icon} n="users" /> Отряд</h3>
      <div class="grid3"><${Field} label="Игроков"><${NumIn} value=${p.size} onChange=${v => updDM(x => { x.party.size = v; })} /><//>
        <${Field} label="Уровень"><${NumIn} value=${p.level} min="1" max="20" onChange=${v => updDM(x => { x.party.level = v; })} /><//>
        <${Field} label="Правила"><${Select} value=${ed} onChange=${v => updDM(x => { x.party.ed = v; })} options=${[['5e', '2014'], ['2024', '2024']]} /><//></div></div>
    <div class="card"><h3><${Icon} n="skull" /> Противники <span class="grow"></span><button class="btn sm gold" onClick=${add}><${Icon} n="plus" cls="s" /></button></h3>
      ${D.enc.length ? D.enc.map(e => html`<div class="listrow"><span class="grow"><b>${e.name}</b><div class="tiny faint">ПО ${e.cr} · ${(CR_XP[e.cr] || 0) * n(e.count)} опыта</div></span>
        <button class="iconbtn" style="width:30px" onClick=${() => updDM(x => { const y = x.enc.find(z => z.id === e.id); y.count = n(y.count) - 1; if (y.count <= 0) x.enc = x.enc.filter(z => z.id !== e.id); })}><${Icon} n="minus" cls="xs" /></button>
        <b style="min-width:22px;text-align:center">${e.count}</b>
        <button class="iconbtn" style="width:30px" onClick=${() => updDM(x => { x.enc.find(z => z.id === e.id).count++; })}><${Icon} n="plus" cls="xs" /></button></div>`)
        : html`<div class="small faint">Добавьте существ из бестиария.</div>`}
    </div>
    <div class="card"><h3><${Icon} n="target" /> Сложность: <span class=${/Смерт|очень|Высокая|Сложная/.test(verdict) ? 'red-t' : 'gold-t'}>${verdict}</span></h3>
      <div class="small">Опыт монстров: <b>${total}</b>${count ? ` (${count} шт.)` : ''} · на игрока ${Math.round(total / size)}</div>
      <dl class="kv mt">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
      ${D.enc.length > 0 && html`<div class="row mt"><button class="btn gold grow" onClick=${() => { toTracker(); toast('Противники отправлены в трекер боя', 'good'); }}><${Icon} n="swords" cls="s" /> В трекер боя</button>
        <button class="btn ghost" onClick=${() => updDM(x => { x.enc = []; })}>Очистить</button></div>`}
    </div>
  </div>`;
}

function monsterToCombatant(m, i, total) {
  const avg = m.hp; const init = d(20) + mod(m.ab[1]);
  return { id: uid(), ref: m.id, name: total > 1 ? `${m.name} ${i + 1}` : m.name, init, hp: avg, max: avg, ac: m.ac, cond: [], enemy: true };
}
function toTracker() {
  const list = getList('monsters');
  updDM(x => { for (const e of x.enc) { const m = list.find(y => y.id === e.ref); if (!m) continue; for (let i = 0; i < n(e.count); i++) x.combat.push(monsterToCombatant(m, i, n(e.count))); } });
}

// ===================== ТРЕКЕР БОЯ МАСТЕРА =====================
function DMTracker() {
  const D = dm();
  const list = [...D.combat].sort((a, b) => n(b.init) - n(a.init));
  const cur = list.length ? list[D.turn % list.length] : null;
  const next = () => updDM(x => { if (!x.combat.length) return; x.turn = (x.turn + 1) % x.combat.length; if (x.turn === 0) x.round++; });
  const addMonster = async () => {
    const all = getList('monsters');
    const id = await pickOne({ title: 'Существо', options: all.map(m => ({ value: m.id, label: m.name, hint: `ПО ${m.cr} · КД ${m.ac} · ${m.hp} хитов` })), value: '', custom: false });
    if (!id) return; const m = all.find(x => x.id === id); updDM(x => x.combat.push(monsterToCombatant(m, 0, 1)));
  };
  const addPC = () => openModal(close => html`<${AddPC} close=${close} />`, { title: 'Участник' });
  return html`<div>
    <div class="row wrapr mb"><button class="btn sm gold" onClick=${addMonster}><${Icon} n="skull" cls="s" /> Монстр</button>
      <button class="btn sm" onClick=${addPC}><${Icon} n="user" cls="s" /> Игрок / НИП</button>
      <span class="grow"></span>${list.length > 0 && html`<span class="chip gold">Раунд ${D.round}</span>`}</div>
    ${!list.length && html`<${Empty} icon="swords">Добавьте участников или отправьте сюда сражение из конструктора.</${Empty}>`}
    ${list.map(c => html`<${TrackerRow} c=${c} active=${cur && cur.id === c.id} />`)}
    ${list.length > 0 && html`<div class="row mt"><button class="btn gold grow" onClick=${next}>Следующий ход <${Icon} n="chevron-right" cls="s" /></button>
      <button class="btn ghost" onClick=${async () => { if (await confirmBox('Завершить бой и очистить трекер?', { ok: 'Завершить' })) updDM(x => { x.combat = []; x.round = 1; x.turn = 0; }); }}>Конец</button></div>`}
  </div>`;
}
function TrackerRow({ c, active }) {
  const [amt, setAmt] = useState('');
  const upd = (fn) => updDM(x => fn(x.combat.find(y => y.id === c.id)));
  const pct = c.max ? Math.max(0, Math.min(100, n(c.hp) / n(c.max) * 100)) : 0;
  const ref = c.ref ? getList('monsters').find(m => m.id === c.ref) : null;
  return html`<div class="card tight" style=${active ? 'border-color:var(--gold)' : ''}>
    <div class="row"><input class="inp num" style="width:50px;min-height:34px" type="number" value=${c.init} onInput=${e => upd(y => { y.init = n(e.target.value); })} aria-label="Инициатива" />
      <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => ref && openModal(() => html`<div class="detail"><h2>${ref.name}</h2><${MonsterBody} m=${ref} /></div>`, { title: 'Статблок', full: true })}>
        <div class="t" style=${c.enemy ? 'color:#e08a80' : 'color:var(--gold2)'}>${c.name}${n(c.hp) <= 0 && c.max ? ' ☠' : ''}</div>
        <div class="tiny faint">КД ${c.ac || '—'}${c.max ? ` · ${c.hp}/${c.max}` : ''}${ref ? ' · статблок' : ''}</div></button>
      <button class="iconbtn" onClick=${() => updDM(x => { x.combat = x.combat.filter(y => y.id !== c.id); })}><${Icon} n="x" cls="s" /></button></div>
    ${c.max > 0 && html`<div class="hpbar mt" style="margin-top:6px;height:7px"><i style=${`width:${pct}%`}></i></div>
      <div class="row mt" style="margin-top:6px"><button class="btn sm red" onClick=${() => { upd(y => { y.hp = n(y.hp) - n(amt); }); setAmt(''); }}>Урон</button>
        <input class="inp num grow" style="min-height:32px" type="number" inputmode="numeric" value=${amt} onInput=${e => setAmt(e.target.value)} placeholder="0" />
        <button class="btn sm green" onClick=${() => { upd(y => { y.hp = Math.min(n(y.max), n(y.hp) + n(amt)); }); setAmt(''); }}>Лечение</button></div>`}
    <div class="row wrapr mt" style="margin-top:6px">${(c.cond || []).map(k => html`<button class="chip red" onClick=${() => upd(y => { y.cond = y.cond.filter(z => z !== k); })}>${k} ×</button>`)}
      <button class="chip" onClick=${async () => { const v = await pickOne({ title: 'Состояние', options: CONDITION_NAMES, value: '', custom: true }); if (v) upd(y => { y.cond = [...(y.cond || []), v]; }); }}>+ состояние</button></div>
  </div>`;
}
function AddPC({ close }) {
  const [x, setX] = useState({ name: '', init: '', hp: '', ac: '', enemy: false });
  const s = (k) => (v) => setX(o => ({ ...o, [k]: v }));
  return html`<div>
    <${Field} label="Имя"><${TextIn} value=${x.name} onChange=${s('name')} /><//>
    <div class="grid3 mt"><${Field} label="Инициатива"><${NumIn} value=${x.init} onChange=${s('init')} placeholder="к20" /><//><${Field} label="Хиты"><${NumIn} value=${x.hp} onChange=${s('hp')} /><//><${Field} label="КД"><${NumIn} value=${x.ac} onChange=${s('ac')} /><//></div>
    <label class="check mt"><input type="checkbox" checked=${x.enemy} onChange=${e => s('enemy')(e.target.checked)} /> Противник</label>
    <button class="btn gold block mt" onClick=${() => { if (!x.name.trim()) return; updDM(D => D.combat.push({ id: uid(), name: x.name, init: x.init === '' ? d(20) : n(x.init), hp: n(x.hp), max: n(x.hp), ac: x.ac, cond: [], enemy: x.enemy })); close(); }}>Добавить</button>
  </div>`;
}

// ===================== ГЕНЕРАТОРЫ =====================
const NAMES = {
  'Человек': { m: ['Алрик', 'Бранд', 'Вилмар', 'Годрик', 'Дарен', 'Ивор', 'Калеб', 'Лоран', 'Мартин', 'Орвин', 'Ратмир', 'Стефан', 'Торвальд', 'Эдрик'], f: ['Алина', 'Бранка', 'Велеса', 'Гвен', 'Дарья', 'Ирма', 'Лира', 'Марта', 'Нелли', 'Ровена', 'Селина', 'Тесса', 'Эльза'], last: ['Брандт', 'Вейл', 'Гринвуд', 'Дорн', 'Кросс', 'Мейсон', 'Блэквуд', 'Рейн', 'Стоун', 'Торн', 'Хартли'] },
  'Эльф': { m: ['Аэлар', 'Галинндан', 'Иварр', 'Лаэрел', 'Миндартис', 'Пелен', 'Риардон', 'Тарантар', 'Фаэлин', 'Эреван'], f: ['Адрие', 'Бирель', 'Иэлениа', 'Келлеат', 'Лиа', 'Мералис', 'Наивара', 'Сариэль', 'Тиая', 'Энна'], last: ['Амакиир', 'Галанодель', 'Илфелкиир', 'Лиадон', 'Мелиамне', 'Сианодель', 'Холимион'] },
  'Дварф': { m: ['Адрик', 'Барендд', 'Бруенор', 'Даин', 'Гардаин', 'Морадин', 'Рурик', 'Траубон', 'Ульфгар', 'Харбек'], f: ['Амбер', 'Бардрин', 'Гуннлода', 'Диеса', 'Илде', 'Лифтраса', 'Ристи', 'Торбера', 'Эльдет'], last: ['Боевой Молот', 'Железный Кулак', 'Каменная Борода', 'Огнековарь', 'Хольдерхек', 'Ункарт', 'Рамнаттен'] },
  'Полурослик': { m: ['Альтон', 'Гаррет', 'Корин', 'Линдал', 'Майло', 'Осборн', 'Перрин', 'Розко', 'Эльдон'], f: ['Андри', 'Бри', 'Верна', 'Каллиста', 'Лавиния', 'Мерла', 'Серафина', 'Шена'], last: ['Добрый Бочонок', 'Зеленобутылка', 'Подхолмье', 'Тёплый Очаг', 'Чайный Лист', 'Высокий Холм'] },
  'Орк / полуорк': { m: ['Грумш', 'Денч', 'Краск', 'Мурен', 'Ронт', 'Тэрк', 'Уршак', 'Хольг', 'Шумп'], f: ['Багги', 'Вола', 'Ингра', 'Кансиф', 'Мев', 'Ова', 'Сутха', 'Эмен'], last: ['Клык', 'Костолом', 'Ревущий', 'Чёрный Топор'] },
  'Тифлинг': { m: ['Акменос', 'Дамакос', 'Каиро', 'Леукис', 'Мордай', 'Скамос', 'Терай'], f: ['Акта', 'Бриселия', 'Крайла', 'Немея', 'Орианна', 'Рията'], last: ['Надежда', 'Скорбь', 'Песнь', 'Отчаяние', 'Поиск', 'Искусство'] },
};
const NPC = {
  // Только то, что видно глазами
  look: ['шрам через бровь', 'золотой зуб', 'татуировки на руках', 'не хватает пальца на левой руке', 'очень высокий и широкоплечий', 'сутулый и худой', 'яркая, кричащая одежда', 'повязка на глазу', 'седые волосы не по годам', 'густые веснушки', 'перстни на каждом пальце', 'обритая голова', 'длинная заплетённая борода', 'ожог на половину лица', 'безупречно чистая одежда', 'потрёпанный плащ с заплатами', 'разноцветные глаза', 'хромает, опирается на трость', 'очень маленький рост', 'серьга в носу'],
  // Голос, запах, манеры, привычки
  quirk: ['пахнет специями', 'пахнет дымом и копотью', 'говорит шёпотом', 'громогласен', 'заикается, когда волнуется', 'постоянно жуёт травинку', 'теребит амулет', 'щёлкает пальцами', 'напевает себе под нос', 'смотрит собеседнику в глаза не моргая', 'смеётся невпопад', 'говорит о себе в третьем лице', 'вставляет словечки из другого языка', 'грызёт ногти', 'всё время что-то записывает', 'обращается ко всем «дружище»'],
  trait: ['говорит загадками', 'постоянно шутит', 'нервен и подозрителен', 'чрезмерно вежлив', 'груб, но честен', 'любит хвастаться', 'дотошен до мелочей', 'очень набожен', 'жаден до денег', 'мечтатель', 'не доверяет магам', 'обожает животных', 'труслив, но скрывает это', 'добродушен и простоват', 'холоден и расчётлив', 'вспыльчив'],
  want: ['вернуть долг', 'отомстить обидчику', 'найти пропавшего родственника', 'разбогатеть', 'покинуть город', 'получить титул', 'защитить семью', 'найти древний артефакт', 'искупить вину', 'прославиться', 'обрести покой', 'выдать дочь замуж'],
  secret: ['работает на воровскую гильдию', 'на самом деле дворянин в бегах', 'задолжал опасным людям', 'видел убийство и молчит', 'поклоняется запретному божеству', 'перевёртыш', 'прячет краденое в подвале', 'шпионит для соседнего королевства', 'когда-то был искателем приключений', 'знает, где спрятан клад', 'проклят', 'секретов нет — честный человек'],
  job: [['трактирщик', 'трактирщица'], ['кузнец', 'кузнечиха'], ['стражник', 'стражница'], ['жрец', 'жрица'], ['торговец', 'торговка'], ['вор', 'воровка'], ['бард', 'бард'], ['фермер', 'фермерша'], ['алхимик', 'алхимик'], ['наёмник', 'наёмница'], ['писарь', 'писарь'], ['рыбак', 'рыбачка'], ['аристократ', 'аристократка'], ['охотник', 'охотница'], ['конюх', 'конюх'], ['травник', 'травница'], ['могильщик', 'могильщица'], ['капитан корабля', 'капитан корабля']],
  age: [['юный', 'юная'], ['молодой', 'молодая'], ['средних лет', 'средних лет'], ['пожилой', 'пожилая'], ['очень старый', 'очень старая']],
};
const TAVERN = { a: ['Пьяный', 'Золотой', 'Ржавый', 'Весёлый', 'Хромой', 'Серебряный', 'Сонный', 'Красный', 'Танцующий', 'Одноглазый'], b: ['Дракон', 'Кабан', 'Гоблин', 'Единорог', 'Котёл', 'Грифон', 'Пони', 'Тролль', 'Якорь', 'Рыцарь'] };
const WEATHER = ['Ясно и тепло', 'Лёгкий туман утром', 'Пасмурно, моросит', 'Сильный ливень (помеха на Внимательность по слуху и зрению)', 'Гроза с молниями', 'Сильный ветер (помеха на дальнобойные атаки)', 'Снегопад (труднопроходимая местность)', 'Жара (спасбросок Телосложения от истощения без воды)', 'Мороз', 'Густой туман (сильно заслонено)'];

function treasure(crBand) {
  const p = d(100); const c = {};
  const add = (k, v) => { c[k] = (c[k] || 0) + v; };
  if (crBand === 0) { if (p <= 30) add('ММ', d(6, 5)); else if (p <= 60) add('СМ', d(6, 4)); else if (p <= 70) add('ЭМ', d(6, 3)); else if (p <= 95) add('ЗМ', d(6, 3)); else add('ПМ', d(6)); }
  if (crBand === 1) { if (p <= 30) { add('ММ', d(6, 4) * 100); add('ЭМ', d(6) * 10); } else if (p <= 60) { add('СМ', d(6, 6) * 10); add('ЗМ', d(6, 2) * 10); } else if (p <= 70) { add('ЭМ', d(6, 3) * 10); add('ЗМ', d(6, 2) * 10); } else if (p <= 95) add('ЗМ', d(6, 4) * 10); else { add('ЗМ', d(6, 2) * 10); add('ПМ', d(6, 3)); } }
  if (crBand === 2) { if (p <= 20) { add('СМ', d(6, 4) * 100); add('ЗМ', d(6) * 100); } else if (p <= 35) { add('ЭМ', d(6) * 100); add('ЗМ', d(6) * 100); } else if (p <= 75) { add('ЗМ', d(6, 2) * 100); add('ПМ', d(6) * 10); } else { add('ЗМ', d(6, 2) * 100); add('ПМ', d(6, 2) * 10); } }
  if (crBand === 3) { if (p <= 15) { add('ЭМ', d(6, 2) * 1000); add('ЗМ', d(6, 8) * 100); } else if (p <= 55) { add('ЗМ', d(6) * 1000); add('ПМ', d(6) * 100); } else { add('ЗМ', d(6) * 1000); add('ПМ', d(6, 2) * 100); } }
  return Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ');
}

function Generators() {
  const [out, setOut] = useState([]);
  const [race, setRace] = useState('Человек'); const [band, setBand] = useState('0');
  const push = (title, text) => setOut(o => [{ id: uid(), title, text }, ...o].slice(0, 20));
  const person = () => { const r = NAMES[race]; const g = Math.random() < 0.5 ? 'm' : 'f'; return { g, name: `${rnd(r[g])} ${rnd(r.last)}` }; };
  const name = () => person().name;
  const npc = () => { const p = person(); const i = p.g === 'f' ? 1 : 0; return `${p.name} — ${rnd(NPC.age)[i]} ${rnd(NPC.job)[i]} (${race.toLowerCase()}).\nВнешность: ${rnd(NPC.look)}.\nОсобенность: ${rnd(NPC.quirk)}.\nХарактер: ${rnd(NPC.trait)}.\nХочет: ${rnd(NPC.want)}.\nСекрет: ${rnd(NPC.secret)}.`; };
  return html`<div>
    <div class="card"><h3><${Icon} n="user" /> Имена и НИП</h3>
      <${Select} value=${race} onChange=${setRace} options=${Object.keys(NAMES)} />
      <div class="row wrapr mt"><button class="btn sm gold" onClick=${() => push('Имена', Array.from({ length: 5 }, name).join(', '))}>5 имён</button>
        <button class="btn sm" onClick=${() => push('НИП', npc())}>Случайный НИП</button>
        <button class="btn sm" onClick=${() => push('Таверна', `«${rnd(TAVERN.a)} ${rnd(TAVERN.b)}». Хозяин: ${name()}, ${rnd(NPC.trait)}.`)}>Таверна</button>
        <button class="btn sm" onClick=${() => push('Погода', rnd(WEATHER))}>Погода</button></div></div>
    <div class="card"><h3><${Icon} n="coins" /> Сокровища</h3>
      <${Select} value=${band} onChange=${setBand} options=${[['0', 'ПО 0–4'], ['1', 'ПО 5–10'], ['2', 'ПО 11–16'], ['3', 'ПО 17+']]} />
      <div class="row wrapr mt"><button class="btn sm gold" onClick=${() => push('Добыча с существа', treasure(n(band)))}>Монеты с существа</button>
        <button class="btn sm" onClick=${() => { const pool = [...POTIONS, ...MAGIC_ITEMS].filter(x => n(band) >= 2 || !/очень|легенд/.test(x.rarity || '')); const it = rnd(pool); push('Магический предмет', `${it.name} (${it.rarity})`); }}>Магический предмет</button>
        <button class="btn sm" onClick=${() => push('Клад', `${treasure(n(band))}; а также ${rnd([...POTIONS, ...MAGIC_ITEMS]).name}`)}>Клад</button></div></div>
    ${out.map(o => html`<div class="card tight"><div class="lbl">${o.title}</div><div style="margin-top:4px;white-space:pre-line">${o.text}</div></div>`)}
  </div>`;
}

// ===================== ТАБЛИЦЫ =====================
function Tables() {
  return html`<div>
    <div class="card"><h3>Сложность проверок</h3><dl class="kv"><dt>5</dt><dd>Очень лёгкая</dd><dt>10</dt><dd>Лёгкая</dd><dt>15</dt><dd>Средняя</dd><dt>20</dt><dd>Трудная</dd><dt>25</dt><dd>Очень трудная</dd><dt>30</dt><dd>Почти невозможная</dd></dl></div>
    <div class="card"><h3>Урон от импровизированных опасностей</h3><dl class="kv"><dt>1–4 ур.</dt><dd>помеха 1к10, опасно 2к10, смертельно 4к10</dd><dt>5–10 ур.</dt><dd>2к10 / 4к10 / 10к10</dd><dt>11–16 ур.</dt><dd>4к10 / 10к10 / 18к10</dd><dt>17–20 ур.</dt><dd>10к10 / 18к10 / 24к10</dd></dl></div>
    <div class="card"><h3>Сл спасбросков и бонус атаки ловушек</h3><dl class="kv"><dt>Помеха</dt><dd>Сл 10–11, атака +3…+5</dd><dt>Опасно</dt><dd>Сл 12–15, атака +6…+8</dd><dt>Смертельно</dt><dd>Сл 16–20, атака +9…+12</dd></dl></div>
    <div class="card"><h3>Опыт за ПО</h3><dl class="kv">${Object.entries(CR_XP).map(([k, v]) => html`<dt>ПО ${k}</dt><dd>${v}</dd>`)}</dl></div>
    <div class="card"><h3>Путешествие</h3><dl class="kv"><dt>Быстро</dt><dd>400 фт/мин, 4 мили/ч, 30 миль/день, −5 к пассивной Внимательности</dd><dt>Нормально</dt><dd>300 фт/мин, 3 мили/ч, 24 мили/день</dd><dt>Медленно</dt><dd>200 фт/мин, 2 мили/ч, 18 миль/день, можно скрытно</dd></dl></div>
    <button class="btn block" onClick=${() => roll('1d100', { label: 'к100' })}><${Icon} n="dices" cls="s" /> Бросить к100</button>
  </div>`;
}
export { fmt, Toggle, crValue };
