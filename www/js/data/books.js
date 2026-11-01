// Книги-источники и фильтрация по ним
import { getState } from '../store.js';

export const BOOKS = [
  ['SRD', 'Базовые правила (SRD)'],
  ['PHB', 'Книга игрока (2014)'],
  ['PHB24', 'Книга игрока (2024)'],
  ['DMG', 'Руководство Мастера'],
  ['XGE', 'Руководство Ксанатара обо всём'],
  ['TCE', 'Котёл Таши со всякой всячиной'],
  ['MPMM', 'Монстры Мультивселенной (Морденкайнен)'],
  ['SCAG', 'Путеводитель по Побережью Мечей'],
  ['Fizban', 'Сокровищница драконов Физбана'],
  ['EGtW', 'Путеводитель по Вилдмаунту'],
  ['VRGR', 'Равенлофт Ван Рихтена'],
  ['BGG', 'Слава великанов Бигби'],
  ['Эберрон', 'Эберрон: Восстание после Последней войны'],
  ['Равника', 'Путеводитель гильдмейстера по Равнике'],
  ['GGtR', 'Равника (доп.)'],
  ['Теорос', 'Мифические одиссеи Теороса'],
  ['Стриксхейвен', 'Стриксхейвен: учебная программа хаоса'],
  ['Spelljammer', 'Spelljammer: Приключения в космосе'],
  ['Dragonlance', 'Dragonlance: Тень Королевы драконов'],
  ['Acq Inc', 'Acquisitions Incorporated'],
  ['IDRotF', 'Долина Ледяного Ветра'],
  ['BoMT', 'Книга многих вещей'],
  ['Book of Many Things', 'Книга многих вещей'],
  ['CR', 'Critical Role (Охотник на кровь)'],
  ['Своё', 'Свои записи'],
];
export const bookName = (k) => (BOOKS.find(b => b[0] === k) || [k, k])[1];

// Источник записи справочника
export function srcOf(x) {
  if (!x) return 'SRD';
  if (x.custom) return 'Своё';
  if (x.src) return x.src;
  if (x.kind === 'race') return x.ed === '2024' ? 'PHB24' : 'PHB';
  return 'SRD';
}

// SRD — часть обеих «Книг игрока», поэтому фильтр PHB/PHB24 показывает и SRD
export function matchBook(src, b) {
  if (!b) return true;
  if (b === 'PHB' || b === 'PHB24') return src === b || src === 'SRD';
  if (b === 'BoMT') return src === 'BoMT' || src === 'Book of Many Things';
  return src === b;
}

// Глобально отключённые книги (Меню → Мои книги)
export function bookAllowed(src) {
  const off = (getState().settings || {}).offBooks || [];
  if (!off.length || src === 'Своё' || src === 'SRD') return true;
  return !off.includes(src);
}

export function booksIn(list) {
  const set = new Set(list.map(srcOf));
  return BOOKS.filter(([k]) => set.has(k));
}
