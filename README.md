IELTS Learning Platform 🎓

A modern platform for IELTS preparation, practice, and progress tracking.

This project built in fastapi+Django

## Code checks

Python code is linted and formatted with [ruff](https://docs.astral.sh/ruff/) (settings in `pyproject.toml`).
The frontend is checked with oxlint and `tsc`.

Install the git hook once — after that the checks run before every commit:

```bash
uv sync
uv run pre-commit install
```

Run them by hand:

```bash
uv run pre-commit run --all-files   # everything
uv run ruff check --fix . && uv run ruff format .   # Python only
```

## Show the site on the internet (temporary)

Opens the site from your computer at a public `https://….trycloudflare.com` link
(Cloudflare Tunnel, free, no account) — works on phones too, microphone included:

```bash
./scripts/share.sh   # stop with Ctrl+C
```

The link works while the terminal is open and changes on every start.
It runs its own API (port 8011) with the same database; the Django admin stays local.
