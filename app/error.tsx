"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="error-page">
      <h1>잠시 연결이 끊겼어요.</h1>
      <p>기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <button className="button primary" onClick={reset}>
        다시 불러오기
      </button>
    </main>
  );
}
