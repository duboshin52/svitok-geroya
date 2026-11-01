// Мост к нативным функциям Android через Capacitor (если приложение запущено как APK)
// window.CapPlugins создаётся бандлом js/capacitor-plugins.js при сборке APK
const Cap = () => (window.CapPlugins && window.CapPlugins.Capacitor) || window.Capacitor;
const AB = () => window.AndroidBridge || null; // нативная оболочка из папки android-studio
export const isNative = () => !!AB() || !!(Cap() && Cap().isNativePlatform && Cap().isNativePlatform());
const plugin = (name) => (window.CapPlugins && window.CapPlugins[name]) || (window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);

// Сохранить текст в файл: на Android — в Документы + меню «Поделиться», в браузере — скачивание
export async function saveTextFile(filename, text) {
  if (AB()) { AB().saveFile(filename, text); return 'native'; }
  if (isNative()) {
    const FS = plugin('Filesystem'); const Share = plugin('Share');
    if (FS) {
      const r = await FS.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
      try { await FS.writeFile({ path: filename, data: text, directory: 'DOCUMENTS', encoding: 'utf8' }); } catch (e) { /* нет доступа — не страшно */ }
      if (Share) { try { await Share.share({ title: filename, url: r.uri, dialogTitle: 'Сохранить резервную копию' }); } catch (e) { /* пользователь закрыл меню */ } }
      return 'native';
    }
  }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'web';
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}
export const readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });

// Сжать картинку до maxSize по большей стороне и вернуть dataURL (JPEG)
export function imageToDataUrl(file, maxSize = 640, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSize / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = r.result;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export function vibrate(ms = 15) { try { if (AB()) { AB().vibrate(ms); return; } const H = plugin('Haptics'); if (H) H.impact({ style: 'LIGHT' }); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }

// Кнопка «Назад» на Android
export function onBackButton(handler) {
  window.__onBack = () => !!handler(); // вызывается оболочкой Android при нажатии «Назад»
  const App = plugin('App');
  if (App && App.addListener) App.addListener('backButton', () => { if (!handler()) App.minimizeApp ? App.minimizeApp() : App.exitApp(); });
}

export async function setupStatusBar() {
  const SB = plugin('StatusBar');
  if (!SB) return;
  try { await SB.setBackgroundColor({ color: '#14110f' }); await SB.setStyle({ style: 'DARK' }); } catch (e) { /* ignore */ }
}
