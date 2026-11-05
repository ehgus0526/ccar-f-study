"use client";

import { useEffect, useRef, useState } from "react";
import {
  VOCABULARY_GROUPS,
  selectedVocabulary,
  type VocabularyGroupId,
} from "@/lib/vocabulary";
import {
  answerQuiz,
  createQuizRound,
  nextQuizQuestion,
  quizResult,
  type QuizRound,
} from "@/lib/vocabulary-quiz";
import Dialog from "./Dialog";
import Icon from "./Icon";
import styles from "./VocabularyQuiz.module.css";

export default function VocabularyQuiz() {
  const [selected, setSelected] = useState<VocabularyGroupId[]>([]);
  const [round, setRound] = useState<QuizRound | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const pool = selectedVocabulary(selected);
  const result = round ? quizResult(round) : null;
  const question = round?.questions[round.index];
  const selectedChoice = round?.answers[round.index];
  const answered = selectedChoice !== undefined;
  const finished = round !== null && !question;
  const roundIndex = round?.index;
  const isReview = round?.isReview;

  // Keep keyboard and screen-reader focus on the new question or result.
  useEffect(() => {
    if (roundIndex !== undefined) heading.current?.focus();
  }, [roundIndex, isReview]);

  function toggleGroup(id: VocabularyGroupId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            영단어 퀴즈<span className="heading-dot">.</span>
          </h1>
          <p className="page-description">
            단어 묶음을 선택해 뜻을 맞히고 오답을 복습하세요.
          </p>
        </div>
        {round && (
          <button
            className={`button secondary ${styles.exitButton}`}
            onClick={() => (finished ? setRound(null) : setConfirmExit(true))}
          >
            묶음 다시 선택
          </button>
        )}
      </div>

      {!round && (
        <section className={styles.setup} aria-labelledby="quiz-setup-heading">
          <div className={styles.setupHeading}>
            <span className={styles.setupIcon}>
              <Icon name="quiz" size={25} />
            </span>
            <h2 id="quiz-setup-heading">단어 묶음 선택</h2>
            <p>A-1~A-4 중 하나 이상 선택하세요.</p>
          </div>
          <div className={styles.selectionHeading}>
            <span>학습할 단어 묶음</span>
            <button
              className="text-button"
              onClick={() =>
                setSelected(
                  selected.length === VOCABULARY_GROUPS.length
                    ? []
                    : VOCABULARY_GROUPS.map((group) => group.id),
                )
              }
            >
              {selected.length === VOCABULARY_GROUPS.length
                ? "선택 해제"
                : "전체 선택"}
            </button>
          </div>
          <fieldset className={styles.groups} aria-label="단어 묶음 선택">
            {VOCABULARY_GROUPS.map((group, index) => (
              <label
                key={group.id}
                className={`${styles.group} ${selected.includes(group.id) ? styles.groupSelected : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                  aria-label={`${group.id} ${group.words.length}개 단어`}
                />
                <span className={styles.groupNumber}>0{index + 1}</span>
                <strong>{group.id}</strong>
                <span className={styles.wordCount}>
                  {group.words.length}개 단어
                </span>
                <span className={styles.groupPreview} lang="en">
                  {group.words
                    .slice(0, 3)
                    .map((word) => word.term)
                    .join(" · ")}
                </span>
              </label>
            ))}
          </fieldset>
          <div className={styles.startArea}>
            <p aria-live="polite">
              {selected.length ? (
                <>
                  <strong>
                    {selected.length}개 묶음 · 총 {pool.length}문항
                  </strong>
                  <span>선택한 모든 단어를 한 번씩 무작위로 출제해요.</span>
                </>
              ) : (
                <span>단어 묶음을 하나 이상 선택해 주세요.</span>
              )}
            </p>
            <button
              className="button primary"
              disabled={!pool.length}
              onClick={() => setRound(createQuizRound(pool))}
            >
              <Icon name="arrow" size={17} />
              {pool.length ? `${pool.length}문항 시작하기` : "퀴즈 시작하기"}
            </button>
          </div>
          <div className={styles.howItWorks}>
            <span>
              <Icon name="vocab" size={16} />
              영어 → 한국어 뜻
            </span>
            <span>
              <Icon name="quiz" size={16} />
              4지선다
            </span>
            <span>
              <Icon name="repeat" size={16} />
              틀린 단어 다시 풀기
            </span>
          </div>
        </section>
      )}

      {round && question && (
        <section
          className={styles.play}
          aria-labelledby="quiz-question-heading"
        >
          <div className={styles.roundHeading}>
            <span className={styles.roundLabel}>
              {round.isReview ? "오답 복습" : "단어 퀴즈"}
            </span>
            <span>{selected.slice().sort().join(" · ")}</span>
          </div>
          <div className={styles.progressHeading}>
            <strong>
              {round.index + 1}
              <span> / {round.questions.length}</span>
            </strong>
            <span>{round.answers.length}문항 풀이 완료</span>
          </div>
          <progress
            className={styles.progress}
            max={round.questions.length}
            value={round.answers.length}
            aria-label="퀴즈 진행률"
          />
          <div className={styles.questionArea}>
            <span className={styles.groupBadge}>{question.word.group}</span>
            <p className={styles.questionInstruction}>
              이 단어의 뜻은 무엇일까요?
            </p>
            <h2
              id="quiz-question-heading"
              ref={heading}
              tabIndex={-1}
              lang="en"
            >
              {question.word.term}
            </h2>
          </div>
          <div
            className={styles.choices}
            role="group"
            aria-label="한국어 뜻 보기 네 개"
          >
            {question.choices.map((meaning, index) => {
              const correct = answered && meaning === question.word.meaning;
              const wrong = answered && selectedChoice === index && !correct;
              return (
                <button
                  key={`${question.word.id}-${index}`}
                  className={`${styles.choice} ${correct ? styles.correct : ""} ${wrong ? styles.wrong : ""}`}
                  disabled={answered}
                  aria-pressed={selectedChoice === index}
                  onClick={() =>
                    setRound((current) =>
                      current ? answerQuiz(current, index) : current,
                    )
                  }
                >
                  <span className={styles.choiceNumber}>{index + 1}</span>
                  <span>{meaning}</span>
                  {correct && (
                    <span className={styles.answerLabel}>
                      <Icon name="check" size={15} />
                      정답
                    </span>
                  )}
                  {wrong && (
                    <span className={styles.answerLabel}>
                      <Icon name="close" size={15} />내 선택
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className={styles.answerArea}>
            <div
              className={`${styles.feedback} ${answered && question.choices[selectedChoice] !== question.word.meaning ? styles.wrongFeedback : ""}`}
              role="status"
              aria-live="polite"
            >
              {answered ? (
                <>
                  <strong>
                    {question.choices[selectedChoice] === question.word.meaning
                      ? "정답입니다."
                      : "오답입니다."}
                  </strong>
                  <span>
                    <span lang="en">{question.word.term}</span> ·{" "}
                    {question.word.meaning}
                  </span>
                </>
              ) : (
                <span>가장 알맞은 뜻을 골라 주세요.</span>
              )}
            </div>
            <button
              className="button primary"
              disabled={!answered}
              onClick={() =>
                setRound((current) =>
                  current ? nextQuizQuestion(current) : current,
                )
              }
            >
              {round.index === round.questions.length - 1
                ? "결과 보기"
                : "다음 문항"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </section>
      )}

      {round && finished && result && (
        <section
          className={styles.results}
          aria-labelledby="quiz-results-heading"
        >
          <div className={styles.resultsIntro}>
            <span className={styles.resultIcon}>
              <Icon name={result.wrong.length ? "leaf" : "check"} size={29} />
            </span>
            <h2 id="quiz-results-heading" ref={heading} tabIndex={-1}>
              {round.isReview ? "오답 복습 결과" : "퀴즈 결과"}
            </h2>
            <p>
              {round.isReview
                ? "오답 복습"
                : selected.slice().sort().join(" · ")}{" "}
              {result.total}문항 완료
            </p>
          </div>
          <dl className={styles.scoreGrid}>
            <div>
              <dt>맞힌 문항</dt>
              <dd>
                {result.correct}
                <small>개</small>
              </dd>
            </div>
            <div>
              <dt>다시 볼 문항</dt>
              <dd>
                {result.wrong.length}
                <small>개</small>
              </dd>
            </div>
            <div>
              <dt>정답률</dt>
              <dd>
                {Math.round((result.correct / result.total) * 100)}
                <small>%</small>
              </dd>
            </div>
          </dl>
          <div className={styles.resultActions}>
            {result.wrong.length > 0 && (
              <button
                className="button primary"
                onClick={() =>
                  setRound(
                    createQuizRound(
                      pool,
                      result.wrong.map((question) => question.word),
                      true,
                    ),
                  )
                }
              >
                <Icon name="repeat" size={17} />
                틀린 단어 {result.wrong.length}개 다시 풀기
              </button>
            )}
            <button
              className={`button ${result.wrong.length ? "secondary" : "primary"}`}
              onClick={() => setRound(createQuizRound(pool))}
            >
              같은 묶음 다시 풀기
            </button>
            <button className="text-button" onClick={() => setRound(null)}>
              다른 묶음 선택하기
            </button>
          </div>
          {result.wrong.length > 0 && (
            <details className={styles.wrongList}>
              <summary>틀린 단어 {result.wrong.length}개 확인하기</summary>
              <ul>
                {result.wrong.map((question) => (
                  <li key={question.word.id}>
                    <span className={styles.groupBadge}>
                      {question.word.group}
                    </span>
                    <div>
                      <strong lang="en">{question.word.term}</strong>
                      <span>{question.word.meaning}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {confirmExit && (
        <Dialog
          title="퀴즈를 그만두고 다시 선택할까요?"
          onClose={() => setConfirmExit(false)}
        >
          <div className="editor-form">
            <p className="muted">
              지금까지 푼 내용은 초기화돼요. 계속 풀거나 단어 묶음을 다시 고를
              수 있어요.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setConfirmExit(false)}
              >
                계속 풀기
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setRound(null);
                  setConfirmExit(false);
                }}
              >
                다시 선택하기
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
