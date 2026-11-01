// Точка входа: оболочка приложения, навигация, кнопка кубиков
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html, Icon, ModalHost, Toasts, openModal, hasModal, closeModal } from './ui.js';
import { useStore, activeChar } from './store.js';
import { EDITIONS, totalLevel } from './rules.js';
import { SheetView, classLine } from './views/sheet.js';
import { MagicView } from './views/magic.js';
import { InventoryView } from './views/inventory.js';
import { CompanionsView } from './views/companions.js';
import { LibraryView } from './views/library.js';
import { DicePanel } from './views/dice-view.js';
import { openCharacters, openMenu, openNewChar } from './views/characters.js';
import { onBackButton, setupStatusBar } from './native.js';

const NAV = [
  ['sheet', 'Лист', 'scroll-text'],
  ['magic', 'Магия', 'sparkles'],
  ['bag', 'Сумка', 'backpack'],
  ['pets', 'Спутники', 'paw-print'],
  ['lib', 'Справочник', 'book-open'],
];

let setTabGlobal = null;
export const openDice = () => openModal(() => html`<${DicePanel} />`, { title: 'Кубики', full: true });

function App() {
  const st = useStore();
  const [tab, setTab] = useState(() => sessionStorage.getItem('tab') || 'sheet');
  setTabGlobal = setTab;
  const go = (t) => { setTab(t); try { sessionStorage.setItem('tab', t); } catch (e) { /* ignore */ } document.querySelector('.main')?.scrollTo(0, 0); };
  const c = activeChar();
  useEffect(() => { if (!c && st.characters.length) { /* активный удалён */ } }, [c]);
  const needsChar = tab !== 'lib' && !c;
  const title = tab === 'lib' ? 'Справочник' : c ? c.name : 'Свиток героя';
  const subtitle = tab === 'lib' ? 'SRD 5e / 2024 · ваши записи' : c ? `${EDITIONS[c.edition].short} · ур. ${totalLevel(c)}${classLine(c) ? ' · ' + classLine(c) : ''}` : '';
  return html`<div id="shell" style="display:contents">
    <header class="top">
      <button class="iconbtn bordered" onClick=${openCharacters} aria-label="Персонажи">
        ${c && c.persona.portrait ? html`<span class="avatar" style=${`width:38px;height:38px;border:0;background-image:url(${c.persona.portrait})`}></span>` : html`<${Icon} n="users" />`}</button>
      <div class="titlebox"><h1>${title}</h1>${subtitle && html`<div class="sub">${subtitle}</div>`}</div>
      <button class="iconbtn" onClick=${openMenu} aria-label="Меню"><${Icon} n="settings" /></button>
    </header>
    <main class="main">
      ${needsChar ? html`<${Welcome} hasChars=${st.characters.length > 0} />`
        : tab === 'sheet' ? html`<${SheetView} />`
          : tab === 'magic' ? html`<${MagicView} />`
            : tab === 'bag' ? html`<${InventoryView} />`
              : tab === 'pets' ? html`<${CompanionsView} />`
                : html`<${LibraryView} />`}
    </main>
    <button class="fab" onClick=${openDice} aria-label="Кубики"><${Icon} n="dices" cls="l" /></button>
    <nav class="nav">${NAV.map(([k, l, ic]) => html`<button class=${tab === k ? 'on' : ''} onClick=${() => go(k)} aria-current=${tab === k ? 'page' : null}><${Icon} n=${ic} /><span>${l}</span></button>`)}</nav>
    <${ModalHost} /><${Toasts} />
  </div>`;
}

function Welcome({ hasChars }) {
  return html`<div class="wrap center" style="padding-top:8vh">
    <div style="font-size:64px;line-height:1" class="gold-t"><${Icon} n="scroll-text" cls="l" /></div>
    <h2 class="serif" style="font-size:34px;margin:12px 0 4px">Свиток героя</h2>
    <p class="muted">Лист персонажа, заклинания, сумка, спутники и справочник — всё в одном месте, без интернета.</p>
    <button class="btn gold mt2" onClick=${() => openNewChar()}><${Icon} n="plus" cls="s" /> ${hasChars ? 'Создать ещё персонажа' : 'Создать первого персонажа'}</button>
    ${hasChars && html`<div><button class="btn mt" onClick=${openCharacters}>Выбрать персонажа</button></div>`}
    <div><button class="btn ghost mt" onClick=${() => setTabGlobal && setTabGlobal('lib')}><${Icon} n="book-open" cls="s" /> Открыть справочник</button></div>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
setupStatusBar();
onBackButton(() => {
  if (hasModal()) { closeModal(); return true; }
  return false;
});
document.getElementById('boot')?.remove();
