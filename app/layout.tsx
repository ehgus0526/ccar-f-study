import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "노딧 nodit. · CCAR-F 스터디",
  description: "CCAR-F 학습 일정, 완료 기록, 자료 공유 및 영단어 퀴즈.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfaf5",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">
          본문 바로가기
        </a>
        {children}
      </body>
    </html>
  );
}
