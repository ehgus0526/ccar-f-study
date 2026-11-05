import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="error-page">
      <h1>페이지를 찾을 수 없어요.</h1>
      <p>캘린더에서 다시 시작해 볼까요?</p>
      <Link href="/" className="button primary">
        캘린더로 돌아가기
      </Link>
    </main>
  );
}
