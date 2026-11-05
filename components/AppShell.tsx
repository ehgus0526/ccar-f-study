"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { logoutAction } from "@/app/actions";
import { LMS_URL } from "@/lib/catalog";
import type { Member } from "@/lib/types";
import Icon from "./Icon";

const links = [
  { href: "/", label: "캘린더", icon: "calendar" },
  { href: "/curriculum", label: "학습 목록", icon: "book" },
  { href: "/quiz", label: "영단어 퀴즈", icon: "quiz" },
  { href: "/shared", label: "공유함", icon: "share" },
];
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="leaf" size={22} />
      </span>
      <span>
        틈틈<span className="brand-dot">.</span>
        <small>CCAR-F STUDY</small>
      </span>
    </span>
  );
}
export default function AppShell({
  member,
  children,
}: {
  member: Member;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" aria-label="틈틈 캘린더 홈">
          <Brand />
        </Link>
        <nav className="desktop-nav" aria-label="주 메뉴">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href ? "nav-link active" : "nav-link"
              }
              aria-current={pathname === link.href ? "page" : undefined}
            >
              <Icon name={link.icon} />
              {link.label}
              {pathname === link.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className={`avatar ${member.color}`}>{member.name[0]}</span>
            <div>
              <strong>{member.name}</strong>
            </div>
            <form action={logoutAction}>
              <button
                className="icon-button"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="desktop-breadcrumb">
            CCAR-F 스터디 <span>/</span>{" "}
            <strong>
              {links.find((link) => link.href === pathname)?.label}
            </strong>
          </span>
          <Link className="mobile-brand" href="/">
            <Brand />
          </Link>
          <div className="topbar-actions">
            <a
              href={LMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lms-link"
            >
              CCAR-F 학습 사이트
              <Icon name="external" size={14} />
            </a>
            <form className="mobile-logout" action={logoutAction}>
              <button className="icon-button" aria-label="로그아웃">
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {links.map((link) => (
          <Link
            href={link.href}
            key={link.href}
            className={pathname === link.href ? "active" : ""}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            <Icon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
