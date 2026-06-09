# CLAUDE.md — AI Assistant Context

**Git workflow → [`CONTRIBUTING.md`](CONTRIBUTING.md)**
**Working language:** Russian (responses) · English (code, comments, commit messages)
**Response style:** No preamble · No hedging · No filler («таким образом», «следует отметить», «необходимо учитывать») · No question restatement before answer

---

## Project

**timamih.com** — лендинг медиа/рекламного агентства (Финляндия). Миграция с Next.js + DatoCMS на vanilla/Vite MPA, контент в git, деплой на GitHub Pages.

| Layer        | Stack                                              |
| ------------ | -------------------------------------------------- |
| Frontend     | Vanilla TS + HTML                                  |
| Build tool   | Vite 8 (MPA, `root: pages/`)                       |
| Styling      | CSS · design-system tokens · M3 runtime themes     |
| Animation    | CSS-first · IntersectionObserver islands           |
| Routing      | Static MPA · locale folders (`/`, `/ru/`, `/fi/`)  |
| Content      | Git-backed JSON → prebuild → HTML                  |
| External API | Web3Forms (форма) · Telegram/Instagram (future)    |
| Admin panel  | Pages CMS (git-backed, hosted GitHub App)          |

**Architecture:** MPA + vanilla islands — статика, prebuild JSON→HTML (3 локали), GitHub Pages. Нет сервера/рантайм-CMS/БД.
**Environments:** Production `https://timamih.com` (custom domain → `base: "/"`)
**Branch:** один `main` → деплой через GitHub Actions (build → artifact → `deploy-pages`)

### Decisions (locked)
- **i18n:** корень `/` = **en** напрямую, `/ru/` и `/fi/` — переводы. hreflang + `x-default`→en. Без серверного/JS-редиректа. Переключатель языка = `<a>`-ссылки + `aria-current`.
- **Темизация:** 3 режима — **light / dark / system** (default = `prefers-color-scheme`). Inline anti-flash script, `html[data-theme]`, переключение `color-scheme` (M3).
- **PWA/Service Worker НЕ используем** (editorial-статика; SW — escalation по `content-site`).
- **Teammates:** split — `content/team.json` (person-инвариант) + per-service `{ref, proff, description}` (контекстно). НЕ дедуплицировать наивно.

---

## Design System

Tokens: `pages/assets/css/base/tokens.css`. Read it before writing CSS — **не предполагать имена** (brand-палитра timamih: тёплый кремовый/оранжевый light, тёмно-серый dark; semantic-цвета; модель темизации M3). Шаблонные шкалы (spacing, font-size, radius, shadow, letter-spacing, line-height, transitions) стабильны — переиспользовать.
**Темизация M3:** semantic-токены через `light-dark()`; `[data-theme="light"|"dark"]` переключает `color-scheme` → токены перещёлкиваются без дублирования таблиц. `system` = снять `[data-theme]`.
**Token vs primitive:** новый токен — если роль именуется без натяжки И маппинг роль→значение может меняться независимо от примитива; иначе primitive value. Token-механика → `css-patterns`.
**Шрифт:** Rubik (woff2, local в `public/assets/fonts/`). `--font-sans`/`--font-heading` → `"Rubik"`.

---

## Conventions

**Naming:** feature-based files/folders, CSS `.component-name` + `.is-state`, no BEM. DOM-адресация (`data-island` / `data-js`) → Rules:DOM + `dom-contract`. Named exports · one responsibility per file · Never style by `data-js`.
**Content:** структурированный JSON в `content/<locale>/*.json` (не markdown-посты). Единый тип в `plugins/content/schema.ts`, валидация на prebuild — build падает при расхождении ключей между локалями.
**API:** внешних рантайм-API нет (статика). Форма → Web3Forms native `<form action>` (island = progressive enhancement). Future social-feed → island потребляет `content/feed.json`, источник абстрактный (build-time или runtime-прокси).
**State:** URL → prebuild data → `data-*` → JS variable · NEVER DOM as source of truth · local by default.

---

## Rules

Apply unconditionally. Details → Skills Index below.

| Domain        | Anchors |
| ------------- | ------- |
| HTML          | Semantic elements · platform primitives (`details`, `dialog`, `popover`) · `aria-*` only without native equivalent · structure in markup not JS · элемент по семантике — что объявит скринридер? |
| CSS           | `.component-name` + `.is-state` · Tokens from `tokens.css` (semantic only, no primitives/hardcoded color — enforced stylelint) · cascade via source order + low specificity · `!important` only for a11y override · CSS-first state/animation/layout · `:has()` / `@container` / `@starting-style` · `inline style=` only for runtime-calculated · `display: grid` вместо `flex-direction: column` · `background-color` NEVER `background` shorthand · logical properties over physical longhand · Base Contract: не повторять стили из `assets/css/base/` |
| Motion        | prefer `transform`/`opacity` per-frame · CSS-first; JS-анимация только обоснованно · `prefers-reduced-motion`: global reset (`reset.css`) backstop для CSS; JS/WAAPI требует явного guard |
| DOM           | `data-island="name"` — точка монтирования island, единственный селектор корня · `data-js="[component]-[role]"` — внутренняя адресация · NEVER `getElementById`/`querySelector('#id')` for behavior · `id` only for `<label for>`, `aria-*`, anchor nav · `is-*` boolean state · `data-state` enum · init returns cleanup (AbortController) · `replaceChildren()` not `innerHTML = ''` |
| TypeScript    | Type all content shapes · `unknown` + guard over `any` · discriminated unions for state · `const` by default |
| Security      | `textContent`/`esc()` over `innerHTML` · prebuild template literals НЕ авто-экранируют — `esc()` на ВСЁ интерполируемое (контент = недоверенный после доступа клиента к CMS) · JSON-LD через `JSON.stringify` + защита `</script>` · markdown/rich-text → sanitize |
| Performance   | Observer priority: Intersection → Resize → Mutation · event delegation · batch DOM reads/writes · explicit image dimensions · lazy islands (modals, carousel, social-feed) |
| Accessibility | Keyboard for every interactive element · `:focus-visible` · `aria-label` on icon buttons (theme-toggle, copy) · `<output>`/`aria-live` для статусов · focus-trap в `<dialog>` · WCAG AA contrast |
| Dependencies  | Platform API before npm · check bundle size · reuse existing scaffold (island/bootstrap/scrollReveal/toast/navDrawer) · Baseline Newly/Widely · limited/experimental = progressive enhancement gate |

---

## Project-Specific Rules

**Assets:** NEVER external image/font URLs (никаких datocms-assets/CDN) · download to `public/assets/` · абсолютные пути `/assets/images/...`, `/assets/fonts/...` · иконки — SVG-спрайт (`<symbol id="icon-*">`, `<use href>`, `fill: currentColor`).

**i18n инвариант:** prebuild генерит `pages/index.html` (en), `pages/ru/index.html`, `pages/fi/index.html` — это **артефакты**, в `.gitignore`. Не редактировать руками. Источник — `content/<locale>/*.json`.

**Tooling:** oxfmt владеет whitespace/импортами — НЕ форматировать вручную. Строгие stylelint-плагины (logical-properties, no-hardcoded-color, no-primitive-token, flex-column…) — `lint:css` обязателен. `npm run check` (lint + lint:css + lint:html) — gate перед коммитом. Pre-commit → `CONTRIBUTING.md`.

**Build:** `npm run build` = `prebuild` (JSON→HTML) затем `vite build`. Сгенерённые HTML обязаны попасть в `rollupOptions.input` (locale auto-discovery в `vite.config.ts`).

**Git:** No AI attribution (`Co-Authored-By: Claude`) · `npm run check` before committing.

**Off-limits:** NEVER modify `timamih/` (старый Next.js — только read для портирования).

---

## Agents

Команда `.claude/agents/`. Lead (architect) делегирует через owner в DECOMPOSE и shared task list.
**Имена для owner-routing:** реальные имена — `frontend-<role>` (`frontend-engineer`, `frontend-skeptic`, `frontend-ux`…). Owner указывать полным именем.

| Агент          | Роль / когда                                                                  |
| -------------- | ----------------------------------------------------------------------------- |
| architect      | Анализ, декомпозиция, owner-routing. Team lead — делегирует, не реализует     |
| engineer       | Реализация vanilla / MPA (HTML/CSS/TS)                                        |
| ux             | Design critique: цель, иерархия, flow, friction, восприятие                   |
| redesign       | Design synthesis: скриншот / макет → improved design-spec, не код             |
| seo            | Разметка для поиска / AI: crawlability, structured data, meta, semantic       |
| review         | Code review изменений: security, correctness, performance, WCAG-статика       |
| skeptic        | Adversarial: edge cases, race conditions, failure modes, security             |
| audit          | Полный аудит кодовой базы (не diff)                                           |
| simplify       | Review + fix: reuse · quality/docs · over-engineering                         |
| tester         | Vitest unit/integration + Playwright E2E/a11y-прогоны (axe, keyboard)         |

Сквозной: **performance-audit** (CWV/bundle регрессии, диагностирует не чинит). Финал проекта: **post-mortem**. Кросс-проектный: **comparator** (паритет нового сайта со старым `timamih/`, read-only).

**Review-проход** (после engineer done): review + skeptic; ux / seo — если в DECOMPOSE отмечен UX/IA- или SEO-impact; tester — Vitest по gate, E2E и a11y.
**a11y:** WCAG-статика → review, прогоны (axe/keyboard) → tester.
**Owner — только агент из ростера.** Skill не может быть owner.

---

## Skills Index

| Task                                                                          | Skill                |
| ----------------------------------------------------------------------------- | -------------------- |
| Client-editable static site (git-CMS, prebuild→HTML, GitHub Pages, формы)     | `content-site`       |
| Тон, типографика, цвет, атмосфера, differentiator — до кода                   | `design`             |
| Нативные элементы, формы, SVG, изображения                                    | `html`               |
| data-js, component state, island lifecycle                                    | `dom-contract`       |
| TypeScript types, unions, guards, code-style                                  | `typescript`         |
| Даты, числа, locale-форматирование, Temporal                                  | `formatting`         |
| MPA / Islands / SPA boundary, complexity                                      | `architecture`       |
| Framework adoption boundary: vanilla vs Preact/React/Vue                      | `framework-boundary` |
| Observers, batch DOM, animations, vitals                                      | `performance`        |
| Motion, transitions, keyframes, easing, reduced motion                       | `animation`          |
| Fetch, cleanup, URL state (social-feed island)                                | `async`              |
| XSS, CSP, sanitization (prebuild esc, JSON-LD)                                | `security`           |
| Focus trap, ARIA live, keyboard, SR-only                                      | `accessibility`      |
| Layouts, формы, dialogs, animations, CSS selectors, темизация                | `css-patterns`       |
| Vitest unit/integration, coverage                                             | `testing`            |
| Playwright E2E, axe, keyboard, cross-browser, viewport                       | `playwright`         |
| SEO/AEO/GEO, hreflang, structured data, crawlability                         | `llm-visibility`     |
| Logging, error tracking, web vitals                                          | `observability`      |

---

## Gotchas

- `[svg-assets]` старые SVG-иллюстрации сервисов имеют пробелы в именах (`ads light.svg`) — переименовать в kebab (`ads-light.svg`) при переносе.
- `[pages-cms-i18n]` Pages CMS без нативного i18n — ~21 запись (7 секций × 3 локали) через per-locale файлы с label-префиксами `EN ·/RU ·/FI ·`; рассинхрон ключей ловит prebuild-валидация.
- `[team-avatars]` аватары команды были на datocms CDN, в репо НЕТ — скачать с прода timamih.com, прогнать `plugins/optimize-images.ts`.
- `[gh-pages]` `.htaccess`/CSP-заголовки на GitHub Pages не работают (Apache-only) — security-заголовки файлом не настроить.
