# EZPill

A full-stack application for dose management, consisting of a TypeScript frontend (with Vite), a Python backend, and embedded device firmware.

## Language Composition

- **TypeScript:** 93.1%
- **Python:** 2.9%
- **CSS:** 2.7%
- **Other:** 1.3%

---

## Installation Guide

### Prerequisites

- Node.js (v18+)
- Bun (if your workflow uses it, otherwise npm/yarn/pnpm)
- Python 3.8+ (for backend)
- [Vite](https://vitejs.dev/docs/) (for frontend)
- Optional: PlatformIO or Arduino IDE for firmware development

### Clone the Repository

```bash
git clone https://github.com/jinyi0903-cjy/dose-buddy-ui.git
cd dose-buddy-ui
```

---

## Frontend

This project uses Vite as the build system and is primarily written in TypeScript.

### Install Dependencies

```bash
bun install
# or
npm install
# or
yarn install
```

### Run the App

```bash
bun run dev
# or
npm run dev
# or
yarn dev
```

The app should now be running at http://localhost:5173 or the port specified in `vite.config.ts`.

---

## Backend

See [backend/README.md](backend/README.md) for full backend instructions.

### Quickstart

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Default backend will launch on its configured host/port (adjust in `main.py` if needed).

---

## Firmware

See [firmwork/README.md](firmwork/README.md) for instructions to build and flash device firmware.

---

## Project Structure

- `src/`: Frontend application source code.
- `backend/`: Python backend (API server).
- `firmwork/`: Embedded device firmware (Arduino/PlatformIO sketch).
- `package.json`, `bun.lock`, `vite.config.ts`: Frontend configuration.
- `requirements.txt` (in `backend/`): Backend dependencies.

---

## Development Commands

- **Install all deps:** `bun install && (cd backend && pip install -r requirements.txt)`
- **Run frontend:** `bun run dev` (from root)
- **Run backend:** `cd backend && python main.py`
- **Build frontend:** `bun run build`
- **Flash firmware:** See `firmwork/README.md`

---

## How to invoke frontend/backends/firmware

- **Frontend:** Open the browser at the displayed Vite address.
- **Backend:** Make requests to the backend API (see endpoints in `main.py`).
- **Firmware:** Build and upload with Arduino IDE or PlatformIO; device-specific instructions in `firmwork/README.md`.

---

## Other Details

- Code formatting: See `.prettierrc`, `.prettierignore`, and `eslint.config.js`.
- Database: SQLite (`dosebuddy.db`/`dosebuddy_v2.db` in backend).

## Contribution

PRs are welcome. Please use Prettier and ESLint before proposing changes.

---
