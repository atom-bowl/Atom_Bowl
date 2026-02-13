import json
import re
import sys
import math


def count_syllables(word):
    """Estimate syllable count for an English word."""
    word = word.lower().strip()
    if not word:
        return 0
    if len(word) <= 3:
        return 1

    word = re.sub(r"(?:es|ed|e)$", "", word) or word
    vowel_groups = re.findall(r"[aeiouy]+", word)
    count = len(vowel_groups)
    return max(count, 1)


def flesch_kincaid_grade(words, sentences, syllables):
    """Compute Flesch-Kincaid grade level."""
    if not words or not sentences:
        return 0.0
    return (
        0.39 * (words / sentences)
        + 11.8 * (syllables / words)
        - 15.59
    )


def split_sentences(text):
    """Split text into sentences."""
    parts = re.split(r"[.!?]+", text)
    return [s.strip() for s in parts if s.strip()]


def get_words(text):
    """Extract words from text."""
    cleaned = re.sub(r"[^a-zA-Z\s]", " ", text)
    return [w for w in cleaned.split() if w]


CATEGORY_MULTIPLIERS = {
    "PHYSICS": 1.15,
    "MATH": 1.15,
    "CHEMISTRY": 1.10,
    "COMPUTER SCIENCE": 1.10,
    "BIOLOGY": 1.00,
    "EARTH AND SPACE": 1.00,
    "ENERGY": 0.95,
    "TECHNOLOGY": 0.95,
}

LEVEL_MULTIPLIERS = {
    "HS": 1.10,
    "MS": 0.90,
}


def score_readability(text):
    """Score based on Flesch-Kincaid readability (0-10)."""
    words = get_words(text)
    sentences = split_sentences(text)
    if not words:
        return 0.0

    total_syllables = sum(count_syllables(w) for w in words)
    grade = flesch_kincaid_grade(len(words), max(len(sentences), 1), total_syllables)
    # Clamp grade level to 0-10 scale
    return max(0.0, min(10.0, grade * 0.7))


def score_vocabulary(text):
    """Score based on vocabulary complexity (0-10)."""
    words = get_words(text)
    if not words:
        return 0.0

    avg_word_len = sum(len(w) for w in words) / len(words)
    long_words = sum(1 for w in words if len(w) >= 8)
    long_ratio = long_words / len(words)

    # Average word length score: typical range 3-8 chars
    len_score = max(0.0, min(10.0, (avg_word_len - 3.0) * 2.0))

    # Long word ratio score
    ratio_score = min(10.0, long_ratio * 25.0)

    return (len_score * 0.6) + (ratio_score * 0.4)


def score_answer_complexity(answer, question_type):
    """Score based on answer complexity (0-10)."""
    if not answer:
        return 2.0

    # MC answers are inherently simpler
    if question_type == "MC":
        return 2.0

    words = get_words(answer)
    word_count = len(words)
    avg_len = sum(len(w) for w in words) / max(len(words), 1)

    # Longer answers with complex words are harder
    length_score = min(10.0, word_count * 1.5)
    complexity_score = max(0.0, min(10.0, (avg_len - 3.0) * 2.5))

    return (length_score * 0.5) + (complexity_score * 0.5)


def score_sentence_complexity(text):
    """Score based on sentence structure complexity (0-10)."""
    words = get_words(text)
    sentences = split_sentences(text)
    if not words or not sentences:
        return 0.0

    avg_sentence_len = len(words) / len(sentences)

    # Count punctuation as indicator of complexity
    punctuation_count = len(re.findall(r"[,;:\-\(\)]", text))
    punct_density = punctuation_count / max(len(words), 1)

    sent_score = min(10.0, avg_sentence_len * 0.35)
    punct_score = min(10.0, punct_density * 20.0)

    return (sent_score * 0.6) + (punct_score * 0.4)


def compute_difficulty(question_text, parsed_answer, category, question_type, level):
    """Compute overall difficulty score (1-10)."""
    text = str(question_text or "")
    answer = str(parsed_answer or "")
    cat = str(category or "").upper()
    qtype = str(question_type or "").upper()
    lvl = str(level or "").upper()

    words = get_words(text)
    word_count = len(words)
    total_syllables = sum(count_syllables(w) for w in words)
    avg_word_length = sum(len(w) for w in words) / max(word_count, 1)

    readability = score_readability(text)
    vocabulary = score_vocabulary(text)
    answer_comp = score_answer_complexity(answer, qtype)
    sentence_comp = score_sentence_complexity(text)

    # Weighted combination
    raw_score = (
        readability * 0.30
        + vocabulary * 0.25
        + answer_comp * 0.25
        + sentence_comp * 0.20
    )

    # Apply category multiplier
    cat_mult = CATEGORY_MULTIPLIERS.get(cat, 1.0)
    raw_score *= cat_mult

    # Apply level multiplier
    lvl_mult = LEVEL_MULTIPLIERS.get(lvl, 1.0)
    raw_score *= lvl_mult

    # Clamp to 1-10
    difficulty = max(1.0, min(10.0, raw_score))
    difficulty = round(difficulty, 1)

    # Assign label
    if difficulty <= 3.0:
        label = "easy"
    elif difficulty <= 6.0:
        label = "medium"
    elif difficulty <= 8.0:
        label = "hard"
    else:
        label = "very hard"

    return {
        "difficulty": difficulty,
        "level": label,
        "components": {
            "readability": round(readability, 2),
            "vocabulary": round(vocabulary, 2),
            "answerComplexity": round(answer_comp, 2),
            "sentenceComplexity": round(sentence_comp, 2),
        },
        "wordCount": word_count,
        "avgWordLength": round(avg_word_length, 2),
        "syllableCount": total_syllables,
        "categoryMultiplier": cat_mult,
        "levelMultiplier": lvl_mult,
    }


def main():
    raw = sys.stdin.read()
    payload = json.loads(raw or "{}")

    result = compute_difficulty(
        payload.get("questionText"),
        payload.get("parsedAnswer"),
        payload.get("category"),
        payload.get("type"),
        payload.get("level"),
    )

    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
