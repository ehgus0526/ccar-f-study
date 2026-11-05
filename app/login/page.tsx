import { redirect } from "next/navigation";
import { Brand } from "@/components/AppShell";
import LoginForm from "@/components/LoginForm";
import Icon from "@/components/Icon";
import { currentMember } from "@/lib/auth";
import { LMS_URL } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await currentMember()) redirect("/");
  return (
    <main id="main-content" className="login-page">
      <div className="login-brand">
        <Brand />
      </div>
      <div className="login-container">
        <section className="login-card">
          <h1>노딧에서 오늘의 공부를 시작해요.</h1>
          <p className="login-card-description">
            이름과 생년월일(yymmdd)을 입력하세요.
          </p>
          <LoginForm />
        </section>
      </div>
      <footer className="login-footer">
        <span>nodit. · CCAR-F STUDY</span>
        <a href={LMS_URL} target="_blank" rel="noopener noreferrer">
          CCAR-F 학습 사이트
          <Icon name="external" size={13} />
        </a>
      </footer>
    </main>
  );
}
