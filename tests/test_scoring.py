"""Проверка ответов и подсчёт band — без БД (разделы 2.6–2.8 TZ.md)."""

from decimal import Decimal

import pytest

from app.models import CorrectAnswer, Question, QuestionGroup, QuestionType, UserAnswer, UserAnswerOption
from app.scoring import accepted_variants, grade_answer, normalize, round_band, within_word_limit


@pytest.mark.parametrize(
    "value, expected",
    [("6.25", "6.5"), ("6.75", "7.0"), ("6.1", "6.0"), ("6.5", "6.5"), ("7", "7.0"), ("8.875", "9.0"), ("0", "0.0")],
)
def test_round_band_ielts_rules(value, expected):
    assert str(round_band(Decimal(value))) == expected


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("  Ancient   EGYPT ", "ancient egypt"),
        ("The Romans.", "romans"),
        ("a cat", "cat"),
        ("3,500", "3500"),
        ("1,000,000", "1000000"),
        ("well-known", "well known"),
        ("“colour”", "colour"),
        ("'colour'", "colour"),
        ("the", "the"),  # артикль удаляется только перед словом
    ],
)
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_optional_words_in_correct_answer():
    assert accepted_variants("(the) Roman (glass) empire") == {"roman glass empire", "roman empire"}
    assert accepted_variants("food source") == {"food source"}


def group(type_=QuestionType.SENTENCE_COMPLETION, word_limit=None, allow_number=False):
    return QuestionGroup(type=type_, instruction="x", word_limit=word_limit, allow_number=allow_number)


def text_question(*answers, **group_kwargs):
    return Question(
        number=1,
        points=1,
        answers_required=1,
        group=group(**group_kwargs),
        correct_answers=[CorrectAnswer(answer_text=a) for a in answers],
    )


def text_answer(text):
    return UserAnswer(answer_text=text, selected_options=[])


@pytest.mark.parametrize(
    "answer, earned",
    [
        ("Mesopotamia", 1),
        ("  mesopotamia. ", 1),
        ("ancient Mesopotamia", 0),
        ("", 0),
        (None, 0),
    ],
)
def test_text_answer(answer, earned):
    q = text_question("Mesopotamia")
    assert grade_answer(q, text_answer(answer) if answer is not None else None) == earned


def test_alternative_spellings_and_optional_words():
    q = text_question("colour", "color", "(the) 18th century")
    assert grade_answer(q, text_answer("Color")) == 1
    assert grade_answer(q, text_answer("18th century")) == 1
    assert grade_answer(q, text_answer("The 18th Century")) == 1


def test_number_formats():
    q = text_question("3500")
    assert grade_answer(q, text_answer("3,500")) == 1


def test_word_limit_counts_what_student_wrote():
    q = text_question("source of food", word_limit=2)
    # правильные слова, но три — по правилам IELTS не засчитывается
    assert grade_answer(q, text_answer("source of food")) == 0
    q = text_question("well-known", word_limit=1)
    assert grade_answer(q, text_answer("well-known")) == 1  # слово через дефис — одно


def test_word_limit_and_or_a_number():
    g = group(word_limit=2, allow_number=True)
    assert within_word_limit("about 3,500 bees", g)
    assert not within_word_limit("about 3500 honey bees", g)
    assert not within_word_limit("3500 4000", g)  # число разрешено только одно
    assert within_word_limit("anything at all here", group())  # без лимита


def option_question(type_, correct_ids, answers_required=1, points=1):
    return Question(
        number=1,
        points=points,
        answers_required=answers_required,
        group=group(type_),
        correct_answers=[CorrectAnswer(option_id=i) for i in correct_ids],
    )


def chosen(*option_ids):
    return UserAnswer(answer_text=None, selected_options=[UserAnswerOption(option_id=i) for i in option_ids])


def test_single_choice():
    q = option_question(QuestionType.TFNG, [1])
    assert grade_answer(q, chosen(1)) == 1
    assert grade_answer(q, chosen(2)) == 0
    assert grade_answer(q, chosen()) == 0


@pytest.mark.parametrize(
    "selected, earned",
    [((1, 3), 2), ((3, 1), 2), ((1, 2), 1), ((1,), 1), ((2, 4), 0), ((1, 2, 3), 0)],
)
def test_choose_two_partial_credit(selected, earned):
    q = option_question(QuestionType.MCQ_MULTI, [1, 3], answers_required=2, points=2)
    assert grade_answer(q, chosen(*selected)) == earned
