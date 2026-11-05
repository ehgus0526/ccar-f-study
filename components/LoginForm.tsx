"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions";
import Icon from "./Icon";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="login-form"
      action={(form) => {
        setError("");
        startTransition(async () => {
          const result = await loginAction(form);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      <label htmlFor="name">이름</label>
      <input
        id="name"
        name="name"
        autoComplete="username"
        placeholder="이름을 입력해 주세요"
        required
        maxLength={30}
      />
      <label htmlFor="password">
        생년월일 <span>yymmdd</span>
      </label>
      <input
        id="password"
        name="password"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        pattern="[0-9]{6}"
        minLength={6}
        maxLength={6}
        placeholder="생년월일 여섯 자리"
        required
        aria-describedby="password-help"
      />
      <p id="password-help" className="field-help">
        생년월일을 연·월·일 두 자리씩 입력해 주세요.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary login-submit" disabled={pending}>
        {pending ? "로그인 중…" : "로그인"}
        <Icon name="arrow" size={18} />
      </button>
    </form>
  );
}
