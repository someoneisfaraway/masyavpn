# masyavpn

Synthwave‑стилевой VPN‑клиент для Windows на базе Electron, React и Vite.  
Приложение работает с V2Ray и даёт удобный GUI для подключения к заранее настроенным VPN‑сервером/конфигам.

## Features

- Поддержка V2Ray‑подключений.
- Управление VPN‑соединением через простой интерфейс.
- Логи и базовая диагностика сети (через `default-gateway`, `ip` и т.п.).
- Сборка установщика для Windows одним скриптом.
- Современный стек: Electron 33, React 19, Vite 6, TypeScript.

## Tech stack

- Electron
- React + React DOM
- Vite
- TypeScript
- Axios, electron-store, socks и др.

## Scripts

Все команды запускаются из корня проекта.

```bash
# режим разработки (Vite dev server + Electron)
npm run dev

# сборка production-бандла
npm run build

# запуск приложения из собранной версии
npm start

# сборка дистрибутива (установщик)
npm run dist        # все платформы, если настроено
npm run dist:win    # сборка только под Windows

# локальный предпросмотр статического бандла
npm run preview
