import type { VocabularyWord } from "./vocabulary.ts";

export type QuizQuestion = { word: VocabularyWord; choices: string[] };
export type QuizRound = {
  questions: QuizQuestion[];
  answers: number[];
  index: number;
  isReview: boolean;
};

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function meaningParts(meaning: string) {
  return meaning
    .replace(/\([^)]*\)/g, "")
    .split(/[,;/·]/)
    .map((part) => part.replace(/\s+/g, ""))
    .filter(Boolean);
}

export function createQuizRound(
  pool: readonly VocabularyWord[],
  words: readonly VocabularyWord[] = pool,
  isReview = false,
  random: () => number = Math.random,
): QuizRound {
  if (
    !words.length ||
    new Set(words.map((word) => word.id)).size !== words.length
  ) {
    throw new Error("퀴즈에 사용할 단어를 선택해 주세요.");
  }
  const meanings = [...new Set(pool.map((word) => word.meaning))].map(
    (meaning) => ({
      meaning,
      parts: meaningParts(meaning),
    }),
  );
  const questions = shuffled(words, random).map((word) => {
    const correctParts = meaningParts(word.meaning);
    // Avoid duplicate choices and obvious synonyms such as accurate / exact.
    const alternatives = meanings.filter(
      (candidate) =>
        candidate.meaning !== word.meaning &&
        !candidate.parts.some((part) => correctParts.includes(part)),
    );
    if (alternatives.length < 3)
      throw new Error("보기를 만들 단어가 부족합니다.");
    return {
      word,
      choices: shuffled(
        [
          word.meaning,
          ...shuffled(alternatives, random)
            .slice(0, 3)
            .map((item) => item.meaning),
        ],
        random,
      ),
    };
  });
  return { questions, answers: [], index: 0, isReview };
}

export function answerQuiz(round: QuizRound, choice: number): QuizRound {
  const question = round.questions[round.index];
  if (
    !question ||
    round.answers.length !== round.index ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= question.choices.length
  )
    return round;
  return { ...round, answers: [...round.answers, choice] };
}

export function nextQuizQuestion(round: QuizRound): QuizRound {
  if (
    round.index >= round.questions.length ||
    round.answers.length !== round.index + 1
  )
    return round;
  return { ...round, index: round.index + 1 };
}

export function quizResult(round: QuizRound) {
  const wrong = round.questions.filter(
    (question, index) =>
      round.answers[index] !== undefined &&
      question.choices[round.answers[index]] !== question.word.meaning,
  );
  return {
    total: round.questions.length,
    answered: round.answers.length,
    correct: round.answers.length - wrong.length,
    wrong,
  };
}
