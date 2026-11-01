// Кубики: быстрые броски, формулы, преимущество/помеха, история
import { useState } from 'preact/hooks';
import { html, Icon, Toggle } from '../ui.js';
import { useStore } from '../store.js';
import { roll, describeParts, clearRolls, kf } from '../dice.js';
import { vibrate } from '../native.js';

const DICE = [4, 6, 8, 10, 12, 20, 100];

export function DicePanel() {
  const st = useStore();
  const [count, setCount] = useState(1); const [modv, setMod] = useState(0); const [mode, setMode] = useState('');
  const [formula, setFormula] = useState('');
  const last = st.rolls[0];
  const quick = (d) => { vibrate(); const f = `${count}d${d}${modv ? (modv > 0 ? '+' : '') + modv : ''}`; roll(f, { label: '', mode: d === 20 ? mode : '' }); };
  const custom = () => { if (!formula.trim()) return; const r = roll(formula, { mode }); if (!r) window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'Не понимаю формулу. Пример: 2к6+3', kind: 'bad' } })); };
  return html`<div>
    <div class="bigresult">${last ? html`<div class="n" key=${last.id} style=${last.nat === 20 ? 'color:#a8d495' : last.nat === 1 ? 'color:#ef8f86' : ''}>${last.total}</div>
      <div class="small muted">${last.label ? last.label + ' · ' : ''}${kf(last.formula)} → ${describeParts(last)}</div>` : html`<div class="n faint" style="font-size:44px">к20</div><div class="small faint">Нажмите на кубик</div>`}</div>
    <div class="row mt" style="justify-content:center"><${Toggle} value=${mode} onChange=${setMode} options=${[['dis', 'Помеха'], ['', 'Обычно'], ['adv', 'Преимущество']]} /></div>
    <div class="row mt" style="justify-content:center;gap:14px">
      <div class="row" style="gap:4px"><span class="tiny faint">Кол-во</span><button class="iconbtn bordered" style="width:34px;height:34px" onClick=${() => setCount(Math.max(1, count - 1))}><${Icon} n="minus" cls="xs" /></button><b style="min-width:20px;text-align:center">${count}</b><button class="iconbtn bordered" style="width:34px;height:34px" onClick=${() => setCount(Math.min(30, count + 1))}><${Icon} n="plus" cls="xs" /></button></div>
      <div class="row" style="gap:4px"><span class="tiny faint">Мод.</span><button class="iconbtn bordered" style="width:34px;height:34px" onClick=${() => setMod(modv - 1)}><${Icon} n="minus" cls="xs" /></button><b style="min-width:24px;text-align:center">${modv >= 0 ? '+' + modv : modv}</b><button class="iconbtn bordered" style="width:34px;height:34px" onClick=${() => setMod(modv + 1)}><${Icon} n="plus" cls="xs" /></button></div>
    </div>
    <div class="dicegrid mt">${DICE.map(d => html`<button class="die" onClick=${() => quick(d)}>${count > 1 && html`<small>×${count}</small>`}<span>к${d}</span></button>`)}
      <button class="die" style="font-size:15px" onClick=${() => { roll('4d6kh3', { label: 'Характеристика (4к6, 3 лучших)' }); }}>4к6<br/><span class="tiny faint" style="font-family:var(--sans)">лучшие 3</span></button></div>
    <div class="row mt"><input class="inp grow" placeholder="Формула: 2к6+1к4+3, 4d6kh3" value=${formula} onInput=${e => setFormula(e.target.value)} onKeyDown=${e => e.key === 'Enter' && custom()} />
      <button class="btn gold" onClick=${custom}>Бросить</button></div>
    <div class="row between mt2"><span class="lbl">История</span>${st.rolls.length > 0 && html`<button class="btn sm ghost" onClick=${clearRolls}>Очистить</button>`}</div>
    ${st.rolls.slice(0, 30).map(r => html`<div class="histrow"><span class="tt" style=${r.nat === 20 ? 'color:#a8d495' : r.nat === 1 ? 'color:#ef8f86' : ''}>${r.total}</span>
      <div class="grow"><div>${r.label || kf(r.formula)}${r.mode === 'adv' ? ' · преим.' : r.mode === 'dis' ? ' · помеха' : ''}</div><div class="tiny faint">${kf(r.formula)} → ${describeParts(r)}</div></div>
      <span class="tiny faint">${new Date(r.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>`)}
  </div>`;
}
