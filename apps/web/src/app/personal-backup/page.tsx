"use client";
import { useRef, useState } from "react";
import { Download, Upload, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function BackupPage() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function restore(file: File) {
    if (file.size > 64 * 1024 * 1024) {
      setError("备份超过 64 MB，请使用数据库备份恢复。");
      return;
    }
    if (!confirm("导入学习、案例、日记和图片？已有记录不会被覆盖。")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/personal-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage(
        `恢复完成：新增 ${data.imported} 篇记录、${data.images} 个附件，跳过 ${data.skipped} 篇重复或无法匹配的复盘。${data.missingTrades ? ` ${data.missingTrades} 个交易关联未匹配；交易数据请通过完整数据库恢复。` : ""}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-7 p-5 sm:p-8">
      <div>
        <p className="text-xs tracking-widest text-muted-foreground">SETTINGS / DATA</p>
        <h1 className="mt-3 text-2xl font-semibold">数据备份与恢复</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          交易、学习和图片都保存在本机。定期把备份存到另一块磁盘。
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <Download className="text-brand" />
          <h2 className="text-lg">学习与日记备份</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            包含知识点、案例、日记、结构化复盘和原始图片/PDF。恢复时合并新增记录，已有 ID 不覆盖。
          </p>
          <a
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            href="/api/personal-backup"
          >
            导出图文备份
          </a>
          <div>
            <Button disabled={busy} variant="outline" onClick={() => input.current?.click()}>
              <Upload />
              {busy ? "正在恢复…" : "从 JSON 备份恢复"}
            </Button>
          </div>
          <input
            className="hidden"
            ref={input}
            type="file"
            accept=".json,application/json"
            aria-label="恢复备份文件"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            导入上限 64 MB。此备份不包含原始成交和账户配置。
          </p>
        </section>
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <Database className="text-brand" />
          <h2 className="text-lg">完整数据库快照</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            包含全部账户、成交流水、统计基础数据、学习记录及附件。使用 SQLite 在线备份生成一致快照。
          </p>
          <a
            className="inline-flex rounded-md border px-4 py-2 text-sm"
            href="/api/database-backup"
          >
            下载完整数据库
          </a>
          <p className="text-xs leading-6 text-muted-foreground">
            恢复方法：停止应用，先备份当前 data 目录，再用下载的数据库替换
            data/journal.db，并移走旧的 journal.db-wal 和 journal.db-shm，重新启动。
          </p>
          <p className="text-xs leading-6 text-muted-foreground">
            若使用券商或 AI 密钥，还需另行保管 data/.secret 或
            JOURNAL_SECRET。数据库快照包含设置，请私下保存。
          </p>
        </section>
      </div>
      {message && (
        <p role="status" className="rounded-lg border border-brand p-4 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
