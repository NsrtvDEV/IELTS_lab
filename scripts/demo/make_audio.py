"""Озвучивает записи Listening демо-теста в scripts/demo/listening_part{1..4}.mp3.

Нужен интернет (Google TTS). Готовые mp3 уже лежат в репозитории — запускать только после правки listening.py:

    uv run --no-project --with gTTS python scripts/demo/make_audio.py
"""

from pathlib import Path

from gtts import gTTS

from listening import PARTS

HERE = Path(__file__).parent
VOICES = {"uk": "co.uk", "au": "com.au"}

for number, part in enumerate(PARTS, start=1):
    path = HERE / f"listening_part{number}.mp3"
    # mp3 из кусков можно склеить подряд — браузеры играют такой файл целиком
    with path.open("wb") as out:
        for voice, text in part["lines"]:
            gTTS(text, lang="en", tld=VOICES[voice]).write_to_fp(out)
    print(f"{path.name}: {path.stat().st_size // 1024} KB")
