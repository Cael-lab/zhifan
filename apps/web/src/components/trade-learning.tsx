"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonalEditor } from "@/components/personal-workspace";
import { PersonalMedia } from "@/components/personal-media";
import { Markdown } from "@/components/rich-editor";
import { useApi, postJson } from "@/lib/use-api";
import { emptyContent, type PersonalEntry } from "@/lib/personal";

export function TradeLearning({ tradeKey, symbol }: { tradeKey: string; symbol: string }) {
  const api = useApi<{ entries: PersonalEntry[] }>("/api/personal");
  const entries = api.data?.entries ?? [];
  const review = entries.find((e) => e.kind === "review" && e.tradeKeys.includes(tradeKey));
  const [editing, setEditing] = useState(false),
    [knowledge, setKnowledge] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const linked = entries.filter(
    (e) =>
      e.kind !== "review" &&
      (e.tradeKeys.includes(tradeKey) || review?.knowledgeIds.includes(e.id)),
  );
  async function addCase() {
    if (!knowledge) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/personal", {
        ...emptyContent(),
        kind: "case",
        parentId: knowledge,
        title: `${symbol} · 交易案例`,
        symbol,
        content: review
          ? `## 进场理由\n${review.entryReason}\n\n## 出场理由\n${review.exitReason}\n\n## 复盘与改进\n${review.improvement}\n\n${review.content}`
          : "记录此交易的案例说明。",
        tradeKeys: [tradeKey],
        copyTrade: tradeKey,
      });
      api.refresh();
      setKnowledge("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <section className="rounded-xl border bg-card">
        <PersonalEditor
          kind="review"
          entry={review}
          tradeKey={tradeKey}
          entries={entries}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            api.refresh();
            setEditing(false);
          }}
        />
      </section>
    );
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">交易复盘与学习</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={api.loading || !!api.error}
          onClick={() => setEditing(true)}
        >
          <Pencil />
          {review ? "编辑复盘" : "写复盘"}
        </Button>
      </div>
      {(error || api.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || api.error}
        </p>
      )}
      {review ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["进场理由", review.entryReason],
            ["出场理由", review.exitReason],
            ["做得好 / 下次改进", review.improvement],
          ].map(([label, text]) => (
            <div key={label}>
              <h3 className="mb-2 text-xs text-brand">{label}</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {text || "尚未记录"}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground md:col-span-3">
            执行：{review.followedPlan}　·　情绪：{review.mood}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          把进出场的理由和执行结果分开记录，让复盘回到当时的判断。
        </p>
      )}
      {review && (
        <div className="space-y-4 border-t pt-4">
          {review.content && <Markdown>{review.content}</Markdown>}
          <PersonalMedia id={review.id} />
        </div>
      )}
      <div className="space-y-3 border-t pt-4">
        <h3 className="flex items-center gap-2 text-sm">
          <BookOpen className="size-4 text-brand" />
          关联知识与案例
        </h3>
        <div className="flex flex-wrap gap-2">
          {linked.map((e) => (
            <Link
              className="rounded-md border bg-brand/5 px-3 py-2 text-xs text-brand"
              key={e.id}
              href={`${e.kind === "diary" ? "/diary" : "/learning"}?id=${e.id}`}
            >
              {e.title} →
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="案例所属知识点"
            className="min-w-48 rounded-md border bg-background px-3 py-2 text-sm"
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
          >
            <option value="">选择一个知识点…</option>
            {entries
              .filter((e) => e.kind === "knowledge")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
          <Button variant="outline" disabled={!knowledge || busy} onClick={() => void addCase()}>
            <Plus />
            {busy ? "保存中…" : "收入案例库（含交易截图）"}
          </Button>
          <Link href="/learning" className="self-center text-xs text-muted-foreground underline">
            管理知识点
          </Link>
        </div>
      </div>
    </section>
  );
}
