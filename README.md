# masyavpn

Настольный VPN‑клиент для Windows на базе Electron/Vite.  
Приложение позволяет подключаться к заранее настроенному VPN‑серверу и управлять соединением через удобный GUI.

## Features

- Один клик для подключения/отключения VPN.
- Трей‑иконка и фоновый режим работы.
- Автостарт вместе с системой (опционально).
- Логи подключений для отладки.
- Сборка отдельных установщиков для Windows.

## Tech stack

- Electron
- Vite
- TypeScript
- Node.js

## Getting started (development)

### Prerequisites

- Node.js 18+
- npm или pnpm/yarn

### Installation

```bash
git clone https://github.com/someoneisfaraway/masyavpn.git
cd masyavpn
npm install
npm run dev
