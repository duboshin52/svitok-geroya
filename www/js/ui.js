// Общие UI-компоненты
import { h } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import htm from '../vendor/htm/index.js';
import { ICONS } from './icons.js';
import { describeParts, kf } from './dice.js';
import { useStore } from './store.js';

export const html = htm.bind(h);

export function Icon({ n, cls = '', title }) {
  return html`<svg class=${'ic ' + cls} viewBox="0 0 24 24" aria-hidden=${title ? null : 'true'} dangerouslySetInnerHTML=${{ __html: (title ? `<title>${title}</title>` : '') + (ICONS[n] || '') }}></svg>`;
}

// ---------- Модальные окна (стек) ----------
let modals = []; const mListeners = new Set();
const emitM = () => mListeners.forEach(l => l());
export function openModal(render, opts = {}) {
  const m = { id: Math.random().toString(36).slice(2), render, opts };
  modals = [...modals, m]; emitM();
  return () => closeModal(m.id);
}
export function closeModal(id) { modals = id ? modals.filter(m => m.id !== id) : modals.slice(0, -1); emitM(); }
export const hasModal = () => modals.length > 0;
export function ModalHost() {
  useStore(); // содержимое модалок перерисовывается при изменении данных
  const [, f] = useState(0);
  useEffect(() => { const l = () => f(n => n + 1); mListeners.add(l); return () => mListeners.delete(l); }, []);
  return html`${modals.map(m => html`<${Sheet} key=${m.id} id=${m.id} ...${m.opts}>${m.render(() => closeModal(m.id))}<//>`)}`;
}
function Sheet({ id, title, full, children, foot }) {
  return html`<div class="overlay" onClick=${(e) => { if (e.target === e.currentTarget) closeModal(id); }}>
    <div class=${'sheet' + (full ? ' full' : '')} role="dialog" aria-label=${title}>
      <div class="grab"></div>
      ${title && html`<div class="sh-head"><h2>${title}</h2><button class="iconbtn" aria-label="Закрыть" onClick=${() => closeModal(id)}><${Icon} n="x" /></button></div>`}
      <div class="sh-body">${children}</div>
    </div>
  </div>`;
}

export function confirmBox(text, { ok = 'Удалить', danger = true } = {}) {
  return new Promise(res => {
    openModal(close => html`<div>
      <p style="margin:4px 0 16px;font-size:16px">${text}</p>
      <div class="row"><button class="btn grow" onClick=${() => { close(); res(false); }}>Отмена</button>
      <button class=${'btn grow ' + (danger ? 'red' : 'gold')} onClick=${() => { close(); res(true); }}>${ok}</button></div>
    </div>`, { title: 'Подтвердите' });
  });
}

export function promptBox(title, initial = '', { placeholder = '', multiline = false, ok = 'Готово' } = {}) {
  return new Promise(res => {
    openModal(close => html`<${PromptBody} initial=${initial} placeholder=${placeholder} multiline=${multiline} ok=${ok} onDone=${(v) => { close(); res(v); }} />`, { title });
  });
}
function PromptBody({ initial, placeholder, multiline, ok, onDone }) {
  const [v, setV] = useState(initial); const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current && ref.current.focus(), 120); }, []);
  return html`<div>
    ${multiline ? html`<textarea ref=${ref} class="inp" rows="6" value=${v} placeholder=${placeholder} onInput=${e => setV(e.target.value)} />`
      : html`<input ref=${ref} class="inp" value=${v} placeholder=${placeholder} onInput=${e => setV(e.target.value)} onKeyDown=${e => e.key === 'Enter' && onDone(v)} />`}
    <div class="row mt"><button class="btn grow" onClick=${() => onDone(null)}>Отмена</button><button class="btn gold grow" onClick=${() => onDone(v)}>${ok}</button></div>
  </div>`;
}

// ---------- Поля ввода ----------
export function Field({ label, children, cls = '', style }) {
  return html`<div class=${'field ' + cls} style=${style}>${label && html`<label>${label}</label>`}${children}</div>`;
}
export function TextIn({ value, onChange, placeholder, cls = '', type = 'text', list }) {
  return html`<input class=${'inp ' + cls} type=${type} value=${value ?? ''} placeholder=${placeholder} list=${list} onInput=${e => onChange(e.target.value)} />`;
}
export function NumIn({ value, onChange, cls = '', min, max, placeholder, step }) {
  return html`<input class=${'inp num ' + cls} type="number" inputmode="numeric" value=${value ?? ''} min=${min} max=${max} step=${step} placeholder=${placeholder}
    onInput=${e => { const v = e.target.value; onChange(v === '' ? '' : Number(v)); }} onFocus=${e => e.target.select()} />`;
}
export function Area({ value, onChange, placeholder, rows = 4 }) {
  return html`<textarea class="inp" rows=${rows} value=${value ?? ''} placeholder=${placeholder} onInput=${e => onChange(e.target.value)} />`;
}
export function Select({ value, onChange, options, cls = '' }) {
  return html`<select class=${'inp ' + cls} value=${value} onChange=${e => onChange(e.target.value)}>
    ${options.map(o => Array.isArray(o) ? html`<option value=${o[0]}>${o[1]}</option>` : html`<option value=${o}>${o}</option>`)}
  </select>`;
}
export function Tabs({ tabs, value, onChange }) {
  return html`<div class="tabs" role="tablist">${tabs.map(([k, label]) => html`<button role="tab" aria-selected=${value === k} class=${'tab' + (value === k ? ' on' : '')} onClick=${() => onChange(k)}>${label}</button>`)}</div>`;
}
export function Toggle({ options, value, onChange }) {
  return html`<div class="pill-toggle">${options.map(([k, l]) => html`<button class=${value === k ? 'on' : ''} onClick=${() => onChange(k)}>${l}</button>`)}</div>`;
}
export function Empty({ icon = 'scroll-text', children }) {
  return html`<div class="empty"><${Icon} n=${icon} /><div>${children}</div></div>`;
}

// Простейший «markdown»: абзацы, **жирный**, списки «- »
export function Prose({ text }) {
  if (!text) return null;
  const esc = (s) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const blocks = String(text).split(/\n{2,}|\n(?=- )/);
  let out = ''; let inList = false;
  for (const raw of String(text).split('\n')) {
    const line = esc(raw).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    if (/^- /.test(raw)) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + line.slice(2) + '</li>'; }
    else { if (inList) { out += '</ul>'; inList = false; } if (line.trim()) out += '<p>' + line + '</p>'; }
  }
  if (inList) out += '</ul>';
  void blocks;
  return html`<div class="prose" dangerouslySetInnerHTML=${{ __html: out }}></div>`;
}

// ---------- Тосты ----------
export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (it) => { const id = Math.random(); setItems(x => [...x.slice(-2), { ...it, id }]); setTimeout(() => setItems(x => x.filter(i => i.id !== id)), it.roll ? 3800 : 2600); };
    const t = (e) => add(e.detail);
    const r = (e) => add({ roll: e.detail });
    window.addEventListener('toast', t); window.addEventListener('rolled', r);
    return () => { window.removeEventListener('toast', t); window.removeEventListener('rolled', r); };
  }, []);
  return html`<div class="toasts" aria-live="polite">${items.map(it => it.roll ? html`<${RollToast} key=${it.id} r=${it.roll} />` : html`<div key=${it.id} class=${'toast ' + (it.kind || '')}>${it.text}</div>`)}</div>`;
}
function RollToast({ r }) {
  const cls = r.nat === 20 ? 'crit' : r.nat === 1 ? 'fail' : '';
  return html`<div class="toast rolltoast">
    <div class=${'tot ' + cls}>${r.total}</div>
    <div class="grow"><div style="font-weight:700">${r.label || kf(r.formula)}${r.mode === 'adv' ? ' · преимущество' : r.mode === 'dis' ? ' · помеха' : ''}</div>
    <div class="small muted">${kf(r.formula)} → ${describeParts(r)}</div>
    ${r.nat === 20 && html`<div class="small green-t">Критический успех!</div>`}${r.nat === 1 && html`<div class="small red-t">Критический провал</div>`}</div>
  </div>`;
}

export function useLongPress(cb, ms = 500) {
  const t = useRef(); const fired = useRef(false);
  return {
    onTouchStart: () => { fired.current = false; t.current = setTimeout(() => { fired.current = true; cb(); }, ms); },
    onTouchEnd: (e) => { clearTimeout(t.current); if (fired.current) e.preventDefault(); },
    onTouchMove: () => clearTimeout(t.current),
    onContextMenu: (e) => { e.preventDefault(); cb(); },
  };
}

// ---------- Выбор из списка (вместо datalist, который плохо работает на Android) ----------
// options: строки или { value, label, hint, group }
export function pickOne({ title, options, value, custom = true, customPlaceholder = 'Свой вариант' }) {
  return new Promise(res => {
    openModal(close => html`<${PickList} options=${options} value=${value} custom=${custom} ph=${customPlaceholder}
      onDone=${(v) => { close(); res(v); }} />`, { title, full: options.length > 8 });
  });
}
function PickList({ options, value, custom, ph, onDone }) {
  const [q, setQ] = useState('');
  const norm = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const nq = q.trim().toLowerCase();
  const list = nq ? norm.filter(o => o.label.toLowerCase().includes(nq)) : norm;
  let lastGroup = null;
  return html`<div>
    ${norm.length > 10 && html`<div class="search mb"><${Icon} n="search" cls="s" /><input class="inp" placeholder="Поиск" value=${q} onInput=${e => setQ(e.target.value)} /></div>`}
    ${list.map(o => { const g = o.group && o.group !== lastGroup ? (lastGroup = o.group) : null; return html`
      ${g && html`<div class="lbl" style="margin:12px 4px 4px">${g}</div>`}
      <button class="menu-item" onClick=${() => onDone(o.value)} style=${o.value === value ? 'color:var(--gold2)' : ''}>
        <span class="grow"><div>${o.label}</div>${o.hint && html`<div class="tiny faint">${o.hint}</div>`}</span>
        ${o.value === value && html`<${Icon} n="check" cls="s" />`}</button>`; })}
    ${custom && html`<div class="row mt"><input class="inp grow" placeholder=${ph} value=${q} onInput=${e => setQ(e.target.value)} />
      <button class="btn gold" disabled=${!q.trim()} onClick=${() => onDone(q.trim())}>Своё</button></div>`}
    ${value && html`<button class="btn ghost block mt" onClick=${() => onDone('')}>Очистить</button>`}
  </div>`;
}
export function PickField({ value, placeholder = 'Выбрать…', onClick }) {
  return html`<button class="inp" style="text-align:left;display:flex;align-items:center;gap:6px" onClick=${onClick}>
    <span class="grow" style=${value ? '' : 'color:var(--faint)'}>${value || placeholder}</span><${Icon} n="chevron-down" cls="s" /></button>`;
}
