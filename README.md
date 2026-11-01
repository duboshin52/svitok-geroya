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

## Запуск в браузере для разработки

```bash
npx serve www
# или: python -m http.server -d www 8080
```
