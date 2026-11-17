"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { MagicCard } from "./magicui/magic-card";
import { BorderBeam } from "./magicui/border-beam";
import { useI18n } from "./language";
import { ZhifanMark } from "./zhifan-mark";
import { accountChanged } from "./session-boundary";
import { postJson } from "@/lib/use-api";
import "./auth-screen.css";

export function AuthScreen({ register = false }: { register?: boolean }) {
  const { language, t: ui } = useI18n();
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const [error, setError] = useState(""),
    [setup, setSetup] = useState(false);
  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSetup(d.setup))
      .catch(() => {});
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (register && data.password !== data.confirm) {
      setError(t("两次输入的密码不一致", "Passwords do not match"));
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/auth", { ...data, action: register ? "register" : "login" });
      setSuccess(true);
      accountChanged();
      window.location.replace("/");
    } catch (e) {
      setError(ui(e instanceof Error ? e.message : "Network error"));
      setBusy(false);
    }
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="zhifan-auth">
        <div className="auth-grid" aria-hidden="true" />
        <header className="auth-brand">
          <ZhifanMark className="size-7 text-sky-400" />
          <span>{t("知返", "Zhifan")}</span>
          <span className="auth-brand-separator" />
          <span className="auth-brand-note">TRADING · LEARNING · REFLECTION</span>
        </header>
        <main className="auth-layout">
          <section className="auth-story">
            <div className="auth-eyebrow">
              <span />
              {t("你的成长，从每一次回看开始", "YOUR NEXT EDGE STARTS HERE")}
            </div>
            <h1>
              {t("看见过去。", "Reflect on the past.")}
              <br />
              <span>{t("走得更远。", "Move forward.")}</span>
            </h1>
            <p className="auth-description">
              {t(
                "让每一次交易、每一点学习，都成为下一次进步的起点。",
                "Turn every trade, every lesson and every reflection into your next step forward.",
              )}
            </p>
            <div className="auth-signal" aria-hidden="true">
              <div className="auth-orbit orbit-one" />
              <div className="auth-orbit orbit-two" />
              <div className="auth-orbit orbit-three" />
              <div className="auth-core">
                <ZhifanMark className="size-12" />
              </div>
              <div className="auth-signal-label label-one">
                <span /> REFLECT
              </div>
              <div className="auth-signal-label label-two">
                <span /> LEARN
              </div>
              <div className="auth-signal-label label-three">
                <span /> EVOLVE
              </div>
              <svg viewBox="0 0 480 240">
                <defs>
                  <linearGradient id="signal-line">
                    <stop stopColor="#38bdf8" stopOpacity="0" />
                    <stop offset=".5" stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 174 L56 174 L94 144 L130 161 L173 107 L200 124 L245 77 L284 110 L321 64 L354 82 L404 36 L480 36"
                  fill="none"
                  stroke="url(#signal-line)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="auth-principles">
              <span>01 / {t("记录", "RECORD")}</span>
              <span>02 / {t("复盘", "REFLECT")}</span>
              <span>03 / {t("成长", "GROW")}</span>
            </div>
          </section>
          <section className="auth-form-area" aria-label={t("账号访问", "Account access")}>
            <div className="auth-card-wrap">
              <MagicCard
                gradientSize={280}
                gradientColor="#123048"
                gradientOpacity={0.3}
                gradientFrom="#38bdf8"
                gradientTo="#6366f1"
                className="auth-magic-card"
              >
                <div className="auth-card-content">
                  <div className="auth-access">
                    <ShieldCheck size={14} />
                    {t("仅限邀请 · 独立空间", "INVITE ONLY · YOUR OWN SPACE")}
                  </div>
                  <h2>
                    {register
                      ? t("开启你的知返之旅", "Your next chapter")
                      : t("欢迎回来", "Welcome back")}
                  </h2>
                  <p className="auth-form-description">
                    {register
                      ? t(
                          "凭邀请码，创建专属于你的交易与学习空间。",
                          "Use your invitation to create a private trading and learning space.",
                        )
                      : t("登录，继续记录与成长。", "Sign in to continue your journey.")}
                  </p>
                  {setup && (
                    <div className="auth-setup">
                      <KeyRound size={16} />
                      <p>
                        {t(
                          "首次使用：请使用本机 owner-invite.txt 中的站主邀请码创建账号。",
                          "First use: create your owner account with the invitation in the local owner-invite.txt file.",
                        )}
                      </p>
                    </div>
                  )}
                  <form onSubmit={submit} className="auth-form">
                    {register && (
                      <>
                        <label>
                          {t("邀请码", "Invitation code")}
                          <div className="auth-input-icon">
                            <KeyRound size={16} />
                            <input
                              name="invite"
                              required
                              maxLength={200}
                              autoComplete="off"
                              spellCheck={false}
                              placeholder={t(
                                "输入邀请人提供的邀请码",
                                "Enter your invitation code",
                              )}
                            />
                          </div>
                        </label>
                        <label>
                          {t("昵称", "Name")}
                          <input
                            name="name"
                            required
                            maxLength={80}
                            autoComplete="nickname"
                            placeholder={t("我们如何称呼你", "What should we call you?")}
                          />
                        </label>
                      </>
                    )}
                    <label>
                      {t("邮箱", "Email")}
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="username"
                        placeholder="you@example.com"
                      />
                    </label>
                    <label>
                      {t("密码", "Password")}
                      <div className="auth-password">
                        <input
                          name="password"
                          type={show ? "text" : "password"}
                          required
                          minLength={register ? 12 : undefined}
                          maxLength={128}
                          autoComplete={register ? "new-password" : "current-password"}
                          placeholder={
                            register
                              ? t("至少 12 个字符", "At least 12 characters")
                              : t("输入你的密码", "Enter your password")
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          aria-label={
                            show ? t("隐藏密码", "Hide password") : t("显示密码", "Show password")
                          }
                        >
                          {show ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </label>
                    {register && (
                      <label>
                        {t("确认密码", "Confirm password")}
                        <input
                          name="confirm"
                          type={show ? "text" : "password"}
                          required
                          maxLength={128}
                          autoComplete="new-password"
                          placeholder={t("再次输入密码", "Enter your password again")}
                        />
                      </label>
                    )}
                    {error && (
                      <p className="auth-error" role="alert">
                        {error}
                      </p>
                    )}
                    <button className="auth-submit" disabled={busy} type="submit">
                      {success ? (
                        <Check size={18} />
                      ) : busy ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : null}
                      <span>
                        {success
                          ? t("即将进入你的空间", "Opening your workspace")
                          : busy
                            ? t("正在验证…", "Verifying…")
                            : register
                              ? t("接受邀请并创建账号", "Accept invitation")
                              : t("进入我的空间", "Enter my workspace")}
                      </span>
                      {!busy && <ArrowRight size={17} />}
                    </button>
                  </form>
                  <p className="auth-switch">
                    {register
                      ? t("已经有账号？", "Already have an account?")
                      : t("持有邀请码？", "Have an invitation?")}{" "}
                    <Link href={register ? "/login" : "/register"}>
                      {register ? t("立即登录", "Sign in") : t("创建账号", "Create an account")}
                    </Link>
                  </p>
                  <div className="auth-private">
                    <ShieldCheck size={14} />
                    <span>
                      {t(
                        "你的交易、日记与图片，仅属于你的账号。",
                        "Your trades, diary and images stay in your account.",
                      )}
                    </span>
                  </div>
                </div>
              </MagicCard>
              {!reduced && (
                <BorderBeam
                  size={140}
                  duration={10}
                  colorFrom="#38bdf8"
                  colorTo="#818cf8"
                  className="auth-beam"
                />
              )}
            </div>
            <p className="auth-footnote">
              {t("保持好奇，保持记录。", "Stay curious. Keep reflecting.")}
            </p>
          </section>
        </main>
        <footer className="auth-footer">
          <span>ZHIFAN / {t("个人交易与学习空间", "PERSONAL TRADING & LEARNING")}</span>
          <span>{t("每一天，都比昨天更清晰。", "A little more clarity, every day.")}</span>
        </footer>
      </div>
    </MotionConfig>
  );
}
