// Печатная версия листа персонажа: автономный HTML для печати / сохранения в PDF
import { ABILITIES, ABIL, EDITIONS, skillsFor, mod, fmt, totalLevel, CLASSES, COIN_NAMES, hitDiceSummary, XP_TABLE, levelName, SCHOOLS } from './rules.js';
import * as K from './calc.js';
import { findSpell } from './data/index.js';
import { saveTextFile, isNative } from './native.js';
import { toast } from './store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const classLineP = (c) => (c.classes || []).filter(k => k.name).map(k => `${k.name}${k.subclass ? ` (${k.subclass})` : ''} ${k.level}`).join(' / ');

export function sheetHtml(c) {
  const ed = EDITIONS[c.edition] || EDITIONS['5e'];
  const md = ed.model;
  const L = totalLevel(c);
  const prof = md === '5e' ? K.pb(c) : null;
  const skills = skillsFor(c.edition).map(sk => {
    const b = K.skillBonus(c, sk); const p = Number(c.skills[sk.key]) || 0;
    return { name: sk.name, ab: ABIL[sk.ab].short, bonus: fmt(b), prof: p >= 1 };
  });
  const attacks = (c.attacks || []).map(a => {
    const { atk } = K.attackBonus(c, a); const dmg = K.damageFormula(c, a);
    return `<tr><td>${esc(a.name)}</td><td>${fmt(atk)}</td><td>${esc((dmg || '').replace(/d/g, 'к'))} ${esc(a.dtype || '')}</td><td>${esc(a.range || '')}</td></tr>`;
  }).join('');
  const spells = (c.magic.spells || []).map(s => findSpell(s.ref)).filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
  const spellsByLvl = {};
  for (const s of spells) (spellsByLvl[s.level] = spellsByLvl[s.level] || []).push(s.name);
  const spellsHtml = Object.keys(spellsByLvl).sort((a, b) => a - b)
    .map(l => `<div class="rowline"><b>${levelName(Number(l))}:</b> ${esc(spellsByLvl[l].join(', '))}</div>`).join('');
  const dc = K.spellDC(c), satk = K.spellAtk(c);
  const hd = hitDiceSummary(c).map(h => `к${h.die}×${h.count}`).join(' + ');
  const money = COIN_NAMES.map(([k, n]) => `${c.inv.money[k] || 0} ${n}`).join(' · ');
  const items = (c.inv.items || []).map(i => `<li>${esc(i.name)}${(Number(i.qty) || 0) > 1 ? ` ×${i.qty}` : ''}${i.equipped ? ' (надето)' : ''}</li>`).join('');
  const feats = (c.features || []).map(f => `<li><b>${esc(f.name)}.</b> ${esc((f.text || '').slice(0, 220))}</li>`).join('');
  const p = c.persona;
  const personaLine = [p.traits, p.ideals, p.bonds, p.flaws].filter(Boolean).map(esc).join(' · ');
  const nextXp = XP_TABLE[L];
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(c.name)} — лист персонажа</title><style>
@page { size: A4; margin: 12mm; }
body { font-family: 'PT Sans', system-ui, sans-serif; color: #1a1410; font-size: 11pt; line-height: 1.35; }
h1 { font-family: Georgia, serif; font-size: 22pt; margin: 0 0 2pt; }
h2 { font-family: Georgia, serif; font-size: 12pt; border-bottom: 1.5pt solid #8a6a2c; margin: 12pt 0 5pt; text-transform: uppercase; letter-spacing: 1px; }
.sub { color: #555; font-size: 10pt; }
.grid { display: grid; gap: 4pt; } .g6 { grid-template-columns: repeat(6, 1fr); } .g4 { grid-template-columns: repeat(4, 1fr); } .g2 { grid-template-columns: 1fr 1fr; }
.box { border: 1pt solid #999; border-radius: 4pt; text-align: center; padding: 3pt 2pt; }
.box b { display: block; font-size: 14pt; } .box span { font-size: 7.5pt; text-transform: uppercase; color: #555; }
table { width: 100%; border-collapse: collapse; } td, th { border: 0.5pt solid #bbb; padding: 2pt 5pt; text-align: left; font-size: 10pt; }
ul { margin: 3pt 0; padding-left: 16pt; } li { margin: 1.5pt 0; }
.rowline { margin: 2pt 0; } .muted { color: #666; font-size: 9pt; }
.avoid { break-inside: avoid; }
</style></head><body>
<h1>${esc(c.name)}</h1>
<div class="sub">${esc([c.race, classLineP(c)].filter(Boolean).join(' · '))} · ${esc(ed.name)}${c.player ? ` · игрок: ${esc(c.player)}` : ''}${c.background ? ' · ' + esc(c.background) : ''}${c.alignment ? ' · ' + esc(c.alignment) : ''}</div>
<div class="muted">Опыт: ${c.xp || 0}${nextXp != null ? ` (до ${L + 1} уровня: ${nextXp})` : ''}</div>

<h2>Характеристики</h2>
<div class="grid g6">${ABILITIES.map(a => `<div class="box"><span>${a.short}</span><b>${fmt(mod(c.abilities[a.key]))}</b><span>${c.abilities[a.key]}</span></div>`).join('')}</div>

<h2>Боевые параметры</h2>
<div class="grid g4">
  <div class="box"><span>КД</span><b>${K.armorClass(c)}</b></div>
  <div class="box"><span>Инициатива</span><b>${fmt(K.initiative(c))}</b></div>
  <div class="box"><span>Скорость</span><b>${c.speed}</b></div>
  ${prof != null ? `<div class="box"><span>Мастерство</span><b>${fmt(prof)}</b></div>` : ''}
  <div class="box"><span>Хиты</span><b>${c.hp.max}</b></div>
  <div class="box"><span>Кости хитов</span><b style="font-size:11pt">${hd || '—'}</b></div>
  <div class="box"><span>Пасс. Внимательность</span><b>${K.passive(c)}</b></div>
  ${dc != null ? `<div class="box"><span>Сл заклинаний</span><b>${dc}</b></div>` : ''}
</div>
${satk != null ? `<div class="muted">Атака заклинанием: ${fmt(satk)}</div>` : ''}

<h2>Спасброски</h2>
<div class="grid g6">${ABILITIES.map(a => `<div class="box"><span>${a.short}${md === '5e' && c.saveProf[a.key] ? ' ●' : ''}</span><b>${fmt(K.saveBonus(c, a.key))}</b></div>`).join('')}</div>

<h2>Навыки</h2>
<div class="grid g2">${skills.map(s => `<div class="rowline">${s.prof ? '●' : '○'} <b>${s.bonus}</b> ${esc(s.name)} <span class="muted">(${s.ab})</span></div>`).join('')}</div>

${attacks ? `<h2 class="avoid">Атаки</h2><table class="avoid"><tr><th>Название</th><th>Бросок</th><th>Урон</th><th>Дистанция</th></tr>${attacks}</table>` : ''}

${spellsHtml ? `<h2 class="avoid">Заклинания</h2>${spellsHtml}` : ''}

${feats ? `<h2 class="avoid">Умения и черты</h2><ul>${feats}</ul>` : ''}

<h2 class="avoid">Снаряжение</h2>
<div class="muted">${money}</div>
${items ? `<ul>${items}</ul>` : '<div class="muted">пусто</div>'}

${personaLine ? `<h2 class="avoid">Характер</h2><div class="rowline">${personaLine}</div>` : ''}
${p.backstory ? `<h2 class="avoid">Предыстория</h2><div class="rowline">${esc(p.backstory).replace(/\n/g, '<br>')}</div>` : ''}

<div class="muted" style="margin-top:14pt">Распечатано из приложения «Свиток героя». Справочные материалы — SRD 5.1/5.2 © Wizards of the Coast, CC-BY-4.0.</div>
</body></html>`;
}

const safe = (s) => String(s || 'hero').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);

// Печать: в браузере — диалог печати (можно сохранить как PDF), на Android — HTML-файл + «Поделиться»
export async function printSheet(c) {
  const html = sheetHtml(c);
  if (isNative()) {
    await saveTextFile(`${safe(c.name)}-list.html`, html);
    toast('HTML-лист сохранён: откройте файл и выберите «Печать» → «Сохранить как PDF»', 'good');
    return;
  }
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0';
  frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
  document.body.appendChild(frame);
  frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
  setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => frame.remove(), 1000); }, 300);
}
