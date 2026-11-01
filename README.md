# Свиток героя

Офлайн-компаньон игрока и мастера D&D на русском языке: лист персонажа, заклинания,
инвентарь, спутники, справочник (SRD 5.1/5.2, CC-BY-4.0), инструменты мастера.

## Стек

- Preact + htm (без сборщика, ES-модули через import map)
- Capacitor 7 (Android)
- Данные в `www/js/data/` — пересказ SRD на русском, лицензия CC-BY-4.0 (Wizards of the Coast)
- Состояние — localStorage, экспорт/импорт резервных копий JSON

## Структура

- `www/` — веб-приложение (открывается и в браузере: любой статический сервер)
- `www/js/views/` — экраны: лист, магия, сумка, спутники, справочник, инструменты мастера
- `www/js/data/` — заклинания, бестиарий, предметы, расы, классы, предыстории
- `android/` — нативная оболочка Capacitor (генерируется `npx cap add android`)

## Сборка

```bash
npm install
npx cap add android   # один раз
npm run build:apk     # debug APK в android/app/build/outputs/apk/debug/
```

Требования: Node 18+, JDK 17, Android SDK.

## Обновления

Приложение при запуске (и по кнопке «Проверить обновление» в меню) сверяет свою версию
с `version.json` в ветке `main` этого репозитория. Если версия в репозитории новее —
показывается окно со ссылкой на свежий APK со страницы
[Releases](https://github.com/duboshin52/svitok-geroya/releases).

Порядок выпуска новой версии:

1. Поднять версию в трёх местах: `www/js/update.js` (`APP_VERSION`), `package.json`,
   `android/app/build.gradle` (`versionCode` +1, `versionName`).
2. Обновить `version.json` в корне (`version`, `notes`).
3. Собрать APK, выложить его в GitHub Release с тегом `vX.Y.Z`.

## Запуск в браузере для разработки

```bash
npx serve www
# или: python -m http.server -d www 8080
```
