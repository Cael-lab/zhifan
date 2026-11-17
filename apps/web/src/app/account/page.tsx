"use client";
import { useState } from "react";
import { Copy, KeyRound, LogOut, Plus, ShieldCheck } from "lucide-react";
import { useApi, postJson } from "@/lib/use-api";
import { useI18n } from "@/components/language";
import { accountChanged } from "@/components/session-boundary";
import { Button } from "@/components/ui/button";
type User = { name: string; email: string; role: string };
type Invitation = {
  id: string;
  email: string | null;
  expires: number;
  used_by: string | null;
  revoked: number;
};
export default function AccountPage() {
  const { language, t: ui } = useI18n();
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const session = useApi<{ user: User | null }>("/api/auth");
  const owner = session.data?.user?.role === "owner";
  const invites = useApi<{ invitations: Invitation[] }>(owner ? "/api/invitations" : null);
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const control = "h-10 w-full rounded-md border bg-background px-3 text-sm";
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setCopied(false);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await postJson<{ code: string }>("/api/invitations", {
        email: values.email,
        days: Number(values.days),
      });
      setCode(result.code);
      invites.refresh();
    } catch (e) {
      setError(ui(e instanceof Error ? e.message : "Network error"));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth", undefined, "DELETE");
      accountChanged();
      window.location.replace("/login");
    } catch (e) {
      setError(ui(e instanceof Error ? e.message : "Network error"));
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8">
      <div>
        <p className="text-xs tracking-[.2em] text-muted-foreground">ACCOUNT / ACCESS</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("账号与邀请", "Account & invitations")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "管理你的账号，以及进入知返的邀请。",
            "Manage your account and invitations to Zhifan.",
          )}
        </p>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-card p-6">
        <div>
          <p className="font-medium">{session.data?.user?.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{session.data?.user?.email}</p>
          <p className="mt-2 text-xs text-brand">
            {owner ? t("站主", "Owner") : t("成员", "Member")}
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={logout}>
          <LogOut className="mr-2 size-4" />
          {t("退出登录", "Sign out")}
        </Button>
      </section>
      <div className="flex gap-3 rounded-xl border p-5 text-sm text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 text-brand" />
        <p>
          {t(
            "每个账号拥有独立的数据空间。交易、复盘、学习、日记、附件和导出备份都只包含当前账号的数据。",
            "Every account has its own workspace. Trades, reviews, learning, diaries, attachments and backups contain only the current account’s data.",
          )}
        </p>
      </div>
      {owner && (
        <>
          <section className="rounded-xl border bg-card p-6">
            <h2 className="flex items-center gap-2 font-medium">
              <KeyRound className="size-4" />
              {t("邀请新成员", "Invite a member")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "每个邀请码只能注册一次，可限定邮箱并设置有效期。",
                "Each invitation can be used once. Optionally bind an email and choose an expiry.",
              )}
            </p>
            <form onSubmit={create} className="mt-5 grid gap-4 sm:grid-cols-[1fr_130px_auto]">
              <label className="space-y-2 text-xs">
                {t("受邀邮箱（可选）", "Email (optional)")}
                <input
                  className={control}
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  maxLength={254}
                />
              </label>
              <label className="space-y-2 text-xs">
                {t("有效期", "Expires in")}
                <select className={control} name="days" defaultValue="7">
                  <option value="1">{t("1 天", "1 day")}</option>
                  <option value="7">{t("7 天", "7 days")}</option>
                  <option value="30">{t("30 天", "30 days")}</option>
                </select>
              </label>
              <Button type="submit" disabled={busy} className="self-end">
                <Plus className="mr-2 size-4" />
                {t("生成邀请码", "Create invitation")}
              </Button>
            </form>
            {code && (
              <div className="mt-5 space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-4">
                <p className="text-sm">
                  {t(
                    "邀请码仅在此显示，请复制后私下发给受邀人。",
                    "Copy this invitation now and share it privately. It is shown only here.",
                  )}
                </p>
                <div className="flex gap-2">
                  <input
                    aria-label={t("新邀请码", "New invitation code")}
                    className={control + " font-mono text-xs"}
                    readOnly
                    value={code}
                  />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                      } catch {
                        setError(
                          t(
                            "请选中邀请码手动复制",
                            "Select the invitation code and copy it manually",
                          ),
                        );
                      }
                    }}
                  >
                    <Copy className="mr-2 size-4" />
                    {copied ? t("已复制", "Copied") : t("复制", "Copy")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "对方需要能访问本网站地址。localhost 只能在你的电脑上打开。",
                    "Invitees need access to your website address. localhost is only available on your computer.",
                  )}
                </p>
              </div>
            )}
          </section>
          <section className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 font-medium">{t("邀请记录", "Invitation history")}</h2>
            {!invites.data?.invitations.length && (
              <p className="text-sm text-muted-foreground">
                {t("尚未生成邀请码", "No invitations yet")}
              </p>
            )}
            <div className="space-y-3">
              {invites.data?.invitations.map((invite) => {
                const status = invite.used_by
                  ? t("已使用", "Used")
                  : invite.revoked
                    ? t("已撤销", "Revoked")
                    : invite.expires < Date.now()
                      ? t("已过期", "Expired")
                      : t("待使用", "Available");
                return (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm"
                  >
                    <div>
                      <p>{invite.email || t("不限邮箱", "Any email")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {status} ·{" "}
                        {new Date(invite.expires).toLocaleString(
                          language === "en" ? "en-US" : "zh-CN",
                        )}
                      </p>
                    </div>
                    {!invite.used_by && !invite.revoked && invite.expires > Date.now() && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await postJson("/api/invitations", { id: invite.id }, "DELETE");
                            invites.refresh();
                          } catch (e) {
                            setError(ui(e instanceof Error ? e.message : "Network error"));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t("撤销", "Revoke")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
      {(error || session.error || invites.error) && (
        <p role="alert" className="text-sm text-loss">
          {error || session.error || invites.error}
        </p>
      )}
    </div>
  );
}
