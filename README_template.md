# [Project Name]

[One sentence: what it is and for whom.]

## Stack

| Layer         | Tool |
| ------------- | ---- |
| Frontend      |      |
| Build         |      |
| Styling       |      |
| Backend       |      |
| Database      |      |
| Cache / Queue |      |
| External APIs |      |

**Architecture:** [MPA / SPA / MPA+Islands / SSR] — [one line rationale]

---

## Quick Start

### Prerequisites

- Node.js [version]+
- [PHP/Python/etc. version]+ _(if applicable)_
- Redis _(if applicable)_

### Install & Run

```bash
npm install
npm run dev      # dev server → http://localhost:[PORT]
npm run build    # production build
```

```bash
# Backend (if applicable)
[install command]
[run command]
```

### First-time setup _(if applicable)_

```bash
[migrate command]
[seed command]
[storage link or similar]
```

---

## Project Structure

```
[root]/
├── [dir]/    # [one-line purpose]
├── [dir]/    # [one-line purpose]
└── CONTRIBUTING.md   # git workflow, conventions
```

---

## Environments

| Env        | Branch     | URL                  | Deploy        |
| ---------- | ---------- | -------------------- | ------------- |
| Dev        | any        | localhost:[PORT]     | `npm run dev` |
| Pre-prod   | `pre-prod` | http://[host]:[port] | Auto on push  |
| Production | `main`     | https://[domain]     | Manual        |

**Branch rule:** never push directly to `main`. MR into `pre-prod` only.

### CI/CD Variables

| Variable | Purpose   |
| -------- | --------- |
| `[VAR]`  | [purpose] |

---

## API Endpoints _(if applicable)_

| Method | Path         | Auth | Description |
| ------ | ------------ | ---- | ----------- |
| `GET`  | `/api/[...]` | —    |             |

---

## Known Issues

<!-- Format: [ ] [scope] description — workaround or plan -->
