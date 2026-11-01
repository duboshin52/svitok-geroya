// Список персонажей, создание, резервные копии, «О приложении»
import { useState } from 'preact/hooks';
import { html, Icon, openModal, Field, TextIn, Select, confirmBox, PickField } from '../ui.js';
import * as O from '../origin.js';
import { BOOKS } from '../data/books.js';
import { openDM } from './dm.js';
import { getState, setState, newCharacter, normalizeChar, uid, toast, exportAll, importData, useStore } from '../store.js';
import { EDITIONS, CLASS_NAMES, CLASSES, totalLevel } from '../rules.js';
import { saveTextFile, pickFile, readText } from '../native.js';
import { classLine } from './sheet.js';
import { printSheet } from '../print.js';
import { checkForUpdate, APP_VERSION } from '../update.js';

export function openCharacters() { openModal(close => html`<${CharList} close=${close} />`, { title: 'Персонажи', full: true }); }

function CharList({ close }) {
  const st = useStore();
  const pick = (id) => { setState(s => { s.activeId = id; return s; }); close(); };
  return html`<div>
    ${st.characters.map(c => html`<div class=${'libitem' + (c.id === st.activeId ? ' on' : '')} style=${c.id === st.activeId ? 'border-color:rgba(208,169,86,.6)' : ''}>
      <button class="avatar" style=${c.persona.portrait ? `background-image:url(${c.persona.portrait})` : ''} onClick=${() => pick(c.id)}>${!c.persona.portrait && (c.name || '?')[0]}</button>
      <button class="grow" style="background:none;border:0;text-align:left;padding:0" onClick=${() => pick(c.id)}>
        <div class="nm">${c.name}</div><div class="meta">${[c.race, classLine(c)].filter(Boolean).join(' · ')} · ${EDITIONS[c.edition].short}</div></button>
      <button class="iconbtn" onClick=${() => charMenu(c)} aria-label="Копировать или экспортировать"><${Icon} n="copy" cls="s" /></button>
      <button class="iconbtn" style="color:#ef8f86" onClick=${() => deleteCharacter(c)} aria-label="Удалить персонажа"><${Icon} n="trash" cls="s" /></button>
    </div>`)}
    <button class="btn gold block mt" onClick=${() => openNewChar(close)}><${Icon} n="plus" cls="s" /> Новый персонаж</button>
    <button class="btn block mt" onClick=${importFile}><${Icon} n="upload" cls="s" /> Импорт из файла</button>
  </div>`;
}

export async function deleteCharacter(c, after) {
  if (!(await confirmBox(`Удалить персонажа «${c.name}» безвозвратно? Отменить будет нельзя.`, { ok: 'Удалить' }))) return false;
  setState(s => { s.characters = s.characters.filter(x => x.id !== c.id); if (s.activeId === c.id) s.activeId = s.characters[0] ? s.characters[0].id : null; return s; });
  toast(`«${c.name}» удалён`);
  if (after) after();
  return true;
}

function charMenu(c) {
  openModal(close => html`<div>
    <button class="menu-item" onClick=${() => { const copy = normalizeChar(JSON.parse(JSON.stringify(c))); copy.id = uid(); copy.name = c.name + ' (копия)'; setState(s => { s.characters.push(copy); return s; }); toast('Копия создана', 'good'); close(); }}><${Icon} n="copy" /> Дублировать</button>
    <button class="menu-item" onClick=${async () => { await saveTextFile(`${safe(c.name)}.dnd.json`, JSON.stringify({ app: 'dnd-companion-character', version: 1, character: c }, null, 1)); close(); }}><${Icon} n="download" /> Экспорт персонажа</button>
    <button class="menu-item" onClick=${async () => { close(); await printSheet(c); }}><${Icon} n="printer" /> Печать / PDF листа</button>
    <button class="menu-item" style="color:#ef8f86" onClick=${() => deleteCharacter(c, close)}><${Icon} n="trash" /> Удалить</button>
  </div>`, { title: c.name });
}
const safe = (s) => String(s || 'hero').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);

export function openNewChar(after) { openModal(close => html`<${NewChar} close=${() => { close(); if (after) after(); }} />`, { title: 'Новый персонаж' }); }
function NewChar({ close }) {
  const [name, setName] = useState(''); const [ed, setEd] = useState('2024'); const [cls, setCls] = useState('');
  const create = () => {
    if (!cls) return toast('Выберите класс', 'bad');
    const c = newCharacter(ed); c.name = name.trim() || 'Безымянный герой'; c.classes = [{ name: cls, level: 1, subclass: '' }];
    O.setClass(c, 0, cls);
    const def = CLASSES[cls]; if (def) { c.hp.max = c.hp.current = def.hd; }
    setState(s => { s.characters.push(normalizeChar(c)); s.activeId = c.id; return s; });
    close();
    // Пошаговый мастер: навыки класса → подкласс (если на 1 уровне) → раса → предыстория → выборы класса
    setTimeout(() => O.creationWizard(c.id), 150);
  };
  return html`<div>
    <${Field} label="Имя"><${TextIn} value=${name} onChange=${setName} placeholder="Например, Эльвира Тихий Шаг" /><//>
    <${Field} label="Редакция" cls="mt"><${Select} value=${ed} onChange=${(v) => { setEd(v); setCls(''); }} options=${Object.values(EDITIONS).map(e => [e.key, e.name])} /><//>
    <${Field} label="Класс" cls="mt"><${PickField} value=${cls} placeholder="Выбрать класс…" onClick=${async () => { const v = await O.pickClass(ed, cls); if (v != null) setCls(v); }} /><//>
    <p class="hint">Дальше по шагам: навыки класса, подкласс (если даётся на 1 уровне), раса, предыстория и особые выборы класса. Всё можно изменить позже.</p>
    <button class="btn gold block mt" onClick=${create}>Создать</button>
  </div>`;
}

async function importFile() {
  const f = await pickFile('.json,application/json,text/plain'); if (!f) return;
  try { const n = importData(await readText(f)); toast(`Импортировано персонажей: ${n}`, 'good'); }
  catch (e) { toast(e.message || 'Не удалось прочитать файл', 'bad'); }
}

export function openMenu() {
  openModal(close => html`<div>
    <button class="menu-item" onClick=${() => { close(); openCharacters(); }}><${Icon} n="users" /> Персонажи</button>
    <button class="menu-item" onClick=${async () => { await saveTextFile(`dnd-backup-${new Date().toISOString().slice(0, 10)}.json`, exportAll()); toast('Резервная копия создана', 'good'); }}><${Icon} n="download" /> Резервная копия всего</button>
    <button class="menu-item" onClick=${importFile}><${Icon} n="upload" /> Восстановить из копии</button>
    <button class="menu-item" onClick=${() => { close(); openBooks(); }}><${Icon} n="book-marked" /> Мои книги (какие источники использовать)</button>
    <button class="menu-item" onClick=${() => { close(); openDM(); }}><${Icon} n="crown" /> Инструменты мастера</button>
    <button class="menu-item" onClick=${() => { close(); checkForUpdate({ manual: true }); }}><${Icon} n="download" /> Проверить обновление</button>
    <button class="menu-item" onClick=${() => { close(); openAbout(); }}><${Icon} n="info" /> О приложении</button>
    <p class="hint">Данные хранятся только на этом устройстве. Делайте резервные копии перед переустановкой приложения.</p>
  </div>`, { title: 'Меню' });
}

export function openBooks() { openModal(() => html`<${BooksSettings} />`, { title: 'Мои книги', full: true }); }
function BooksSettings() {
  const st = useStore(); const off = st.settings.offBooks || [];
  const toggle = (k) => setState(s => { const o = new Set(s.settings.offBooks || []); o.has(k) ? o.delete(k) : o.add(k); s.settings.offBooks = [...o]; return s; });
  const list = BOOKS.filter(([k]) => !['SRD', 'Своё', 'Book of Many Things', 'GGtR'].includes(k));
  return html`<div>
    <p class="muted small" style="margin-top:0">Снимите галочки с книг, которые не используются в вашей игре. Их заклинания, расы, подклассы и черты пропадут из списков и мастера создания. Базовые правила (SRD) и ваши записи видны всегда.</p>
    ${list.map(([k, n]) => html`<button class="menu-item" onClick=${() => toggle(k)}><span class=${'dot' + (off.includes(k) ? '' : ' on')}></span><span class="grow">${n}</span><span class="tiny faint">${k}</span></button>`)}
    <div class="row mt"><button class="btn grow" onClick=${() => setState(s => { s.settings.offBooks = list.map(b => b[0]).filter(k => k !== 'PHB' && k !== 'PHB24'); return s; })}>Только Книги игрока</button>
      <button class="btn grow" onClick=${() => setState(s => { s.settings.offBooks = []; return s; })}>Все книги</button></div>
  </div>`;
}

function openAbout() {
  const st = getState();
  openModal(() => html`<div class="prose">
    <p><b>Свиток героя</b> ${APP_VERSION} — офлайн-помощник игрока D&D: лист персонажа для 5e, 2024, 4e, 3.5 и AD&D 2e, заклинания, бестиарий, снаряжение, кубики и трекер боя.</p>
    <p>Персонажей: ${st.characters.length}. Своих записей в справочнике: ${st.custom.spells.length + st.custom.monsters.length + st.custom.items.length}.</p>
    <p class="small">Справочные материалы основаны на System Reference Document 5.1 и 5.2 © Wizards of the Coast LLC, распространяемых по лицензии Creative Commons Attribution 4.0 (creativecommons.org/licenses/by/4.0). Тексты пересказаны и переведены на русский. Приложение не связано с Wizards of the Coast и не одобрено ею. Dungeons & Dragons — товарный знак Wizards of the Coast.</p>
    <p class="small">Шрифты Cormorant Garamond и PT Sans — SIL Open Font License. Иконки Lucide — ISC. Preact и htm — MIT.</p>
  </div>`, { title: 'О приложении' });
}

export { totalLevel };
