# BACKLOG

Находки от review / skeptic / audit. Короткий формат — индекс для триажа.
Развёрнутые задачи с кодом и чекбоксами → [`TODO.md`](TODO.md)
Закрытые задачи → [`DONE.md`](DONE.md)

Формат: `- [SEVERITY] домен · описание · file:line`

Маркеры severity:

- `[CRITICAL]` / `[MAJOR]` / `[MINOR]` — активные находки
- `[INVALID] причина` — находка отклонена: ложное срабатывание, решено иначе, противоречит skill-файлу. Не удалять — предотвращает повторный репорт теми же агентами.

Пример: `- [INVALID] решено через SameSite + signed double-submit (Accept не CSRF-защита), см. security skill · security · CSRF · src/services/api.ts:34`

---

## Frontend

<!-- review / skeptic / frontend-audit пишут сюда -->

---

## Backend

<!-- review / skeptic / backend-audit пишут сюда -->
