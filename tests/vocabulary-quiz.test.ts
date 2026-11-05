import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VOCABULARY,
  VOCABULARY_GROUPS,
  VOCABULARY_GROUP_IDS,
  selectedVocabulary,
} from "../lib/vocabulary.ts";
import {
  answerQuiz,
  createQuizRound,
  nextQuizQuestion,
  quizResult,
  type QuizRound,
} from "../lib/vocabulary-quiz.ts";

function randomSequence(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function finish(
  round: QuizRound,
  wrongIds: Set<string> = new Set(),
): QuizRound {
  while (round.index < round.questions.length) {
    const question = round.questions[round.index];
    const correct = question.choices.indexOf(question.word.meaning);
    const choice = wrongIds.has(question.word.id) ? (correct + 1) % 4 : correct;
    round = nextQuizQuestion(answerQuiz(round, choice));
  }
  return round;
}

test("the original glossary contains 200 unique entries in the supplied groups", () => {
  assert.deepEqual(
    VOCABULARY_GROUPS.map((group) => group.words.length),
    [55, 48, 52, 45],
  );
  assert.equal(VOCABULARY.length, 200);
  assert.equal(new Set(VOCABULARY.map((word) => word.id)).size, 200);
  assert.equal(new Set(VOCABULARY.map((word) => word.term)).size, 200);
  for (const group of VOCABULARY_GROUPS) {
    assert.equal(
      group.words.every(
        (word) =>
          word.group === group.id && word.term.trim() && word.meaning.trim(),
      ),
      true,
    );
  }
  assert.equal(
    VOCABULARY.find((word) => word.term === "without ~ing")!.meaning,
    "~하지 않고",
  );
  assert.equal(
    VOCABULARY.find((word) => word.term === "How should ~ be (re)designed?")!
      .meaning,
    "어떻게 (재)설계할까?",
  );
  assert.equal(VOCABULARY.at(-1)!.term, "validator");
});

test("A-1 and A-2 include all 103 words exactly once and do not mutate the glossary", () => {
  const words = selectedVocabulary(["A-1", "A-2", "A-1"]);
  const original = words.map((word) => word.id);
  const round = createQuizRound(words, words, false, randomSequence(1));
  assert.equal(round.questions.length, 103);
  assert.deepEqual(
    round.questions.map((question) => question.word.id).sort(),
    original.slice().sort(),
  );
  assert.notDeepEqual(
    round.questions.map((question) => question.word.id),
    original,
  );
  assert.deepEqual(
    words.map((word) => word.id),
    original,
  );
  assert.equal(
    round.questions.every((question) =>
      ["A-1", "A-2"].includes(question.word.group),
    ),
    true,
  );
});

test("every nonempty combination produces four distinct choices and exactly one correct answer", () => {
  for (let mask = 1; mask < 16; mask++) {
    const groups = VOCABULARY_GROUP_IDS.filter(
      (_, index) => mask & (1 << index),
    );
    const words = selectedVocabulary(groups);
    const round = createQuizRound(words, words, false, randomSequence(mask));
    assert.equal(
      new Set(round.questions.map((question) => question.word.id)).size,
      words.length,
    );
    const allowedMeanings = new Set(words.map((word) => word.meaning));
    for (const question of round.questions) {
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      assert.equal(
        question.choices.filter((meaning) => meaning === question.word.meaning)
          .length,
        1,
      );
      assert.equal(
        question.choices.every((meaning) => allowedMeanings.has(meaning)),
        true,
      );
    }
    assert.ok(
      new Set(
        round.questions.map((question) =>
          question.choices.indexOf(question.word.meaning),
        ),
      ).size > 1,
    );
  }
  assert.throws(() => createQuizRound([]));
});

test("restarting reshuffles questions and their choices", () => {
  const first = createQuizRound(
    VOCABULARY,
    VOCABULARY,
    false,
    randomSequence(21),
  );
  const second = createQuizRound(
    VOCABULARY,
    VOCABULARY,
    false,
    randomSequence(42),
  );
  assert.notDeepEqual(first.questions, second.questions);
  assert.deepEqual(
    first.questions.map((q) => q.word.id).sort(),
    second.questions.map((q) => q.word.id).sort(),
  );
});

test("questions cannot be skipped, submitted twice, or answered outside the four choices", () => {
  const round = createQuizRound(selectedVocabulary(["A-1"]));
  assert.equal(nextQuizQuestion(round), round);
  assert.equal(answerQuiz(round, -1), round);
  assert.equal(answerQuiz(round, 4), round);
  assert.equal(answerQuiz(round, 1.5), round);
  const answered = answerQuiz(round, 0);
  assert.equal(answerQuiz(answered, 1), answered);
  assert.equal(round.answers.length, 0);
  const next = nextQuizQuestion(answered);
  assert.equal(next.index, 1);
  assert.equal(next.answers.length, 1);
});

test("a complete 200-question round tracks only incorrect words and review can repeat until all correct", () => {
  const wrongIds = new Set(["a-1-1", "a-3-10", "a-4-45"]);
  const completed = finish(createQuizRound(VOCABULARY), wrongIds);
  const result = quizResult(completed);
  assert.equal(completed.index, 200);
  assert.equal(result.total, 200);
  assert.equal(result.answered, 200);
  assert.equal(result.correct, 197);
  assert.deepEqual(
    new Set(result.wrong.map((question) => question.word.id)),
    wrongIds,
  );
  const review = createQuizRound(
    VOCABULARY,
    result.wrong.map((question) => question.word),
    true,
  );
  assert.equal(review.questions.length, 3);
  assert.equal(review.isReview, true);
  const again = quizResult(finish(review, new Set(["a-4-45"])));
  assert.equal(again.correct, 2);
  assert.equal(again.wrong.length, 1);
  const finalReview = createQuizRound(
    VOCABULARY,
    again.wrong.map((question) => question.word),
    true,
  );
  assert.equal(finalReview.questions.length, 1);
  assert.equal(finalReview.questions[0].choices.length, 4);
  const final = quizResult(finish(finalReview));
  assert.equal(final.correct, 1);
  assert.equal(final.wrong.length, 0);
});

test("an all-correct result has no review words", () => {
  const result = quizResult(
    finish(createQuizRound(selectedVocabulary(["A-4"]))),
  );
  assert.equal(result.correct, 45);
  assert.equal(result.wrong.length, 0);
});

test("obvious overlapping translations are not offered as alternative answers", () => {
  for (let seed = 0; seed < 10; seed++) {
    const round = createQuizRound(
      VOCABULARY,
      VOCABULARY,
      false,
      randomSequence(seed),
    );
    assert.equal(
      round.questions
        .find((q) => q.word.term === "accurate")!
        .choices.includes("정확한, 그대로의"),
      false,
    );
    assert.equal(
      round.questions
        .find((q) => q.word.term === "approximately")!
        .choices.includes("대략, 약"),
      false,
    );
    assert.equal(
      round.questions
        .find((q) => q.word.term === "load")!
        .choices.includes("가져오다, 불러오다"),
      false,
    );
  }
});
