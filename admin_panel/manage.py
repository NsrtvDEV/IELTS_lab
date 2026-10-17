#!/usr/bin/env python
"""Django-админка IELTS Lab. Запуск из корня проекта: uv run admin_panel/manage.py runserver"""

import os
import sys
from pathlib import Path

# корень проекта — чтобы импортировать app.config и app.models
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
