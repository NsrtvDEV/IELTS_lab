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
