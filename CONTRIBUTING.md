# CONTRIBUTING.md

Git workflow for all contributors and AI agents.
Coding rules → `CLAUDE.md ## Rules`.

---

## Git

Commit format: `<type>(<scope>): <description>` — lowercase, no period.

| Type       | When                |
| ---------- | ------------------- |
| `feat`     | new functionality   |
| `fix`      | bug fix             |
| `refactor` | no behaviour change |
| `perf`     | performance         |
| `docs`     | documentation only  |
| `style`    | CSS / formatting    |
| `build`    | deps, vite, docker  |
| `ci`       | CI/CD config        |
| `chore`    | cleanup             |
| `revert`   | revert a commit     |

**Examples:**

```
feat(chat): add markdown rendering for assistant messages
fix(auth): clear user state on logout network failure
perf(sidebar): debounce session save on message add
build(deps): add react-markdown and remark-gfm
```

### Rules

- **Ask before every commit/push** — never commit or push without an explicit go-ahead
- Git/commit operations (staging, commit message, push) run on Haiku — mechanical task, no frontier model needed
- One commit — one change
- No AI attribution in commit messages
- Multiline commit message → `git commit -F <file>`, never `-m` with backticks (backticks in a double-quoted `-m` trigger command substitution and mangle the message)
- Never push directly to `prod` — MR into `pre-prod` only
- Run `[format]`, `[lint]`, `[typecheck]`, `[build]` before committing frontend changes
- Run `[backend lint/typecheck command]` before committing backend changes
