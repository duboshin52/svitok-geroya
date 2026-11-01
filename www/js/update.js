// Проверка обновлений: сравнивает версию приложения с version.json в репозитории GitHub.
// Если вышла новая версия — предлагает скачать свежий APK со страницы релизов.
import { html, Icon, openModal } from './ui.js';
import { toast } from './store.js';

export const APP_VERSION = '1.1.0';
export const REPO = 'duboshin52/svitok-geroya';
const VERSION_URL = `https://raw.githubusercontent.com/${REPO}/main/version.json`;
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

// Сравнение semver-подобных версий: -1 (a<b), 0 (равны), 1 (a>b)
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function openRelease() {
  // В APK window.open для http(s) перехватывается Capacitor и открывает системный браузер
  window.open(RELEASES_URL, '_blank');
}

let checkedThisSession = false;
export async function checkForUpdate({ manual = false } = {}) {
  if (!manual && checkedThisSession) return;
  let info;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(VERSION_URL + '?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    info = await res.json();
  } catch (e) {
    if (manual) toast('Не удалось проверить обновления — нужен интернет', 'bad');
    return;
  }
  checkedThisSession = true;
  if (info && info.version && cmpVersion(info.version, APP_VERSION) > 0) showUpdateModal(info);
  else if (manual) toast(`У вас последняя версия — ${APP_VERSION}`, 'good');
}

function showUpdateModal(info) {
  openModal(close => html`<div>
    <div class="row" style="align-items:center;gap:10px">
      <span class="gold-t"><${Icon} n="download" cls="l" /></span>
      <div><div style="font-size:18px">Вышла версия <b>${info.version}</b></div>
        <div class="muted small">У вас установлена ${APP_VERSION}</div></div>
    </div>
    ${info.notes && html`<p class="mt" style="white-space:pre-line">${info.notes}</p>`}
    <p class="hint">Откроется страница релизов на GitHub — скачайте файл APK и установите поверх текущей версии. Персонажи и записи сохранятся.</p>
    <div class="row mt">
      <button class="btn grow" onClick=${close}>Позже</button>
      <button class="btn gold grow" onClick=${() => { openRelease(); close(); }}><${Icon} n="download" cls="s" /> Скачать APK</button>
    </div>
  </div>`, { title: 'Доступно обновление' });
}
