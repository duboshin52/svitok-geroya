// Спутники: фамильяры, скакуны, призванные существа, наёмники
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, NumIn, Area, Empty, confirmBox } from '../ui.js';
import { activeChar, updChar, uid, toast, useStore } from '../store.js';
import { ABILITIES, mod, fmt, SIZES, crValue } from '../rules.js';
import { getList, findMonster } from '../data/index.js';
import { MonsterBody, addCompanion } from './library.js';
import { roll } from '../dice.js';
import { imageToDataUrl, pickFile } from '../native.js';

const n = (v) => Number(v) || 0;

export function CompanionsView() {
  useStore();
  const c = activeChar(); if (!c) return null;
  return html`<div class="wrap">
    <div class="row between"><div class="section-title" style="margin-top:4px">Спутники</div>
      <div class="row"><button class="btn sm" onClick=${openBlank}><${Icon} n="pencil" cls="s" /> Свой</button>
      <button class="btn sm gold" onClick=${openFromBestiary}><${Icon} n="skull" cls="s" /> Из бестиария</button></div></div>
    ${!c.companions.length && html`<${Empty} icon="paw-print">Фамильяр, скакун, звериный спутник следопыта, призванный дух или наёмник — храните их здесь с хитами, характеристиками и заметками.</${Empty}>`}
    ${c.companions.map(cp => html`<${CompanionCard} cp=${cp} />`)}
  </div>`;
}

function CompanionCard({ cp }) {
  const [amt, setAmt] = useState('');
  const pct = Math.min(100, n(cp.hp.current) / Math.max(1, n(cp.hp.max)) * 100);
  const upd = (fn) => updChar(ch => fn(ch.companions.find(x => x.id === cp.id)));
  const hpAct = (sign) => { const v = n(amt); if (!v) return; upd(x => { if (sign < 0) { const t = Math.min(n(x.hp.temp), v); x.hp.temp = n(x.hp.temp) - t; x.hp.current = Math.max(0, n(x.hp.current) - (v - t)); } else x.hp.current = Math.min(n(x.hp.max), n(x.hp.current) + v); }); setAmt(''); };
  return html`<div class="card">
    <div class="row">
      <div class="avatar" style=${cp.image ? `background-image:url(${cp.image})` : ''}>${!cp.image && (cp.name || '?')[0]}</div>
      <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => openCompanion(cp)}>
        <div class="serif" style="font-size:21px;font-weight:700">${cp.name}</div><div class="tiny faint">${cp.kind || ''}</div></button>
      <div class="stat" style="min-height:50px;width:56px"><div class="v" style="font-size:22px">${cp.ac}</div><div class="k">КД</div></div>
    </div>
    <div class="row mt small"><span class="grow"><b class=${n(cp.hp.current) === 0 ? 'red-t' : ''}>${cp.hp.current}</b> / ${cp.hp.max} хитов${n(cp.hp.temp) ? ` (+${cp.hp.temp})` : ''}</span><span class="faint">${cp.speed}</span></div>
    <div class="hpbar mt" style="margin-top:4px"><i style=${`width:${pct}%`}></i></div>
    <div class="row mt"><button class="btn sm red" onClick=${() => hpAct(-1)}>Урон</button><input class="inp num grow" type="number" inputmode="numeric" value=${amt} onInput=${e => setAmt(e.target.value)} placeholder="0" style="min-height:32px" /><button class="btn sm green" onClick=${() => hpAct(1)}>Лечение</button></div>
    <div class="abrow">${ABILITIES.map((a, i) => html`<button style="background:none;border:0;padding:0;color:inherit" onClick=${() => roll(`1d20${fmt(mod(cp.ab[i])).replace('−', '-')}`, { label: `${cp.name}: ${a.name}` })}><b>${a.short}</b><span>${fmt(mod(cp.ab[i]))}</span></button>`)}</div>
  </div>`;
}

function openBlank() {
  updChar(ch => ch.companions.push({ id: uid(), name: 'Спутник', kind: '', ac: 12, hp: { max: 10, current: 10, temp: 0 }, speed: '30 фт', ab: [10, 10, 10, 10, 10, 10], notes: '', image: '' }));
  const c = activeChar(); openCompanion(c.companions[c.companions.length - 1]);
}

function openFromBestiary() { openModal(close => html`<${BestiaryPick} close=${close} />`, { title: 'Выбрать существо', full: true }); }
function BestiaryPick({ close }) {
  const [q, setQ] = useState(''); const [beasts, setBeasts] = useState(true);
  const nq = q.toLowerCase();
  const list = getList('monsters').filter(m => (!nq || m.name.toLowerCase().includes(nq) || (m.en || '').toLowerCase().includes(nq)) && (!beasts || /зверь/.test(m.type) || crValue(m.cr) <= 1));
  return html`<div>
    <div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Волк, сова, боевой конь…" value=${q} onInput=${e => setQ(e.target.value)} /></div>
    <label class="check mb"><input type="checkbox" checked=${beasts} onChange=${e => setBeasts(e.target.checked)} /> Только звери и существа ПО ≤ 1</label>
    ${list.map(m => html`<div class="libitem" style="padding:8px 10px"><div class="lvlbadge" style="font-size:15px;color:#e08a80">${m.cr}</div>
      <div class="grow"><div class="nm">${m.name}</div><div class="meta">${SIZES[m.size]} ${m.type} · КД ${m.ac} · ${m.hp} хитов</div></div>
      <button class="iconbtn bordered" onClick=${() => { addCompanion(m); close(); }}><${Icon} n="plus" cls="s" /></button></div>`)}
  </div>`;
}

function openCompanion(cp) { openModal(close => html`<${CompanionEditor} id=${cp.id} close=${close} />`, { title: 'Спутник', full: true }); }
function CompanionEditor({ id, close }) {
  const c = activeChar(); const cp = c && c.companions.find(x => x.id === id);
  const [tab, setTab] = useState('edit');
  if (!cp) return null;
  const upd = (fn) => updChar(ch => fn(ch.companions.find(x => x.id === id)));
  const ref = cp.ref ? findMonster(cp.ref) : null;
  const upload = async () => { const f = await pickFile('image/*'); if (!f) return; try { const url = await imageToDataUrl(f, 360); upd(x => { x.image = url; }); } catch (e) { toast('Не удалось загрузить изображение', 'bad'); } };
  return html`<div>
    ${ref && html`<div class="tabs"><button class=${'tab' + (tab === 'edit' ? ' on' : '')} onClick=${() => setTab('edit')}>Карточка</button><button class=${'tab' + (tab === 'stat' ? ' on' : '')} onClick=${() => setTab('stat')}>Статблок</button></div>`}
    ${tab === 'stat' && ref ? html`<div class="detail"><h2>${ref.name}</h2><${MonsterBody} m=${ref} /></div>` : html`<div>
      <div class="row"><button class="avatar" style=${`width:64px;height:64px;${cp.image ? `background-image:url(${cp.image})` : ''}`} onClick=${upload}>${!cp.image && html`<${Icon} n="camera" />`}</button>
        <div class="grow"><${Field} label="Имя"><${TextIn} value=${cp.name} onChange=${v => upd(x => { x.name = v; })} /><//></div></div>
      <${Field} label="Вид / роль" cls="mt"><${TextIn} value=${cp.kind} onChange=${v => upd(x => { x.kind = v; })} placeholder="Фамильяр (сова), скакун, наёмник" /><//>
      <div class="grid4 mt"><${Field} label="КД"><${NumIn} value=${cp.ac} onChange=${v => upd(x => { x.ac = v; })} /><//><${Field} label="Хиты"><${NumIn} value=${cp.hp.current} onChange=${v => upd(x => { x.hp.current = v; })} /><//><${Field} label="Макс."><${NumIn} value=${cp.hp.max} onChange=${v => upd(x => { x.hp.max = v; })} /><//><${Field} label="Врем."><${NumIn} value=${cp.hp.temp} onChange=${v => upd(x => { x.hp.temp = v; })} /><//></div>
      <${Field} label="Скорость" cls="mt"><${TextIn} value=${cp.speed} onChange=${v => upd(x => { x.speed = v; })} /><//>
      <div class="grid6 mt">${ABILITIES.map((a, i) => html`<${Field} label=${a.short}><${NumIn} value=${cp.ab[i]} onChange=${v => upd(x => { x.ab[i] = v; })} /><//>`)}</div>
      <${Field} label="Атаки, умения, заметки" cls="mt"><${Area} rows=${6} value=${cp.notes} onChange=${v => upd(x => { x.notes = v; })} placeholder="Укус: +4, 2к4+2 колющего. Понимает команды. Верность: …" /><//>
    </div>`}
    <div class="row mt2"><button class="btn red" onClick=${async () => { if (await confirmBox(`Расстаться со спутником «${cp.name}»?`, { ok: 'Удалить' })) { updChar(ch => { ch.companions = ch.companions.filter(x => x.id !== id); }); close(); } }}><${Icon} n="trash" cls="s" /></button>
      <button class="btn gold grow" onClick=${close}>Готово</button></div>
  </div>`;
}
