"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BookOpen, Plus, Search, ArrowLeft, Pencil, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor, Markdown } from "@/components/rich-editor";
import { PersonalMedia } from "@/components/personal-media";
import { useApi, postJson } from "@/lib/use-api";
import {
  emptyContent,
  todayLocal,
  type EntryKind,
  type PersonalContent,
  type PersonalEntry,
} from "@/lib/personal";
import { tradePath, type LinkableTrade } from "@/lib/trade-links";

const box = "rounded-xl border bg-card p-5 sm:p-6";
const control =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-brand";
const labels: Record<string, string> = {
  knowledge: "知识点",
  case: "案例",
  diary: "日记",
  review: "复盘",
};
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border bg-secondary px-2 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
export function PersonalWorkspace({ kind }: { kind: "knowledge" | "diary" }) {
  return (
    <Suspense>
      <Workspace kind={kind} />
    </Suspense>
  );
}
function Workspace({ kind }: { kind: "knowledge" | "diary" }) {
  const api = useApi<{ entries: PersonalEntry[] }>("/api/personal");
  const entries = api.data?.entries ?? [];
  const router = useRouter(),
    query = useSearchParams(),
    id = query.get("id");
  const selected = entries.find((e) => e.id === id);
  const [editing, setEditing] = useState(false),
    [creating, setCreating] = useState<EntryKind | null>(null),
    [parent, setParent] = useState<string | null>(null);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("全部"),
    [status, setStatus] = useState("全部"),
    [error, setError] = useState("");
  const base = kind === "knowledge" ? "/learning" : "/diary";
  useEffect(() => {
    setEditing(false);
    setCreating(null);
  }, [id, kind]);
  const rows = entries
    .filter((e) => e.kind === kind)
    .filter((e) => category === "全部" || e.category === category)
    .filter((e) => status === "全部" || e.status === status)
    .filter((e) =>
      `${e.title} ${e.content} ${e.tags.join(" ")} ${entries
        .filter((c) => c.parentId === e.id)
        .map((c) => c.title + " " + c.content)
        .join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      kind === "diary"
        ? b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const categories = [
    ...new Set(
      entries
        .filter((e) => e.kind === kind)
        .map((e) => e.category)
        .filter(Boolean),
    ),
  ];
  const go = (entryId?: string) => {
    setEditing(false);
    setCreating(null);
    router.push(entryId ? `${base}?id=${entryId}` : base);
  };
  const add = (next: EntryKind, parentId: string | null = null) => {
    setParent(parentId);
    setCreating(next);
    setEditing(false);
  };
  async function remove(entry: PersonalEntry) {
    if (
      !confirm(
        entry.kind === "knowledge"
          ? "删除这个知识点及其所有案例和图片？此操作不可撤销。"
          : "删除此记录及其图片？此操作不可撤销。",
      )
    )
      return;
    try {
      await postJson(`/api/personal/${entry.id}`, undefined, "DELETE");
      api.refresh();
      go(entry.parentId ?? undefined);
    } catch (e) {
      setError(String(e));
    }
  }
  if (api.loading && !api.data)
    return <div className="p-8 text-muted-foreground">正在读取记录…</div>;
  if (api.error)
    return (
      <div className="p-8">
        <p role="alert">{api.error}</p>
        <Button onClick={api.refresh}>重试</Button>
      </div>
    );
  if (creating || (selected && editing))
    return (
      <PersonalEditor
        key={creating ? `new-${creating}` : selected!.id}
        kind={creating ?? selected!.kind}
        entry={creating ? undefined : selected}
        parentId={parent}
        entries={entries}
        onCancel={() => {
          setCreating(null);
          setEditing(false);
        }}
        onSaved={(entry) => {
          api.refresh();
          setCreating(null);
          setEditing(false);
          router.push(`${base}?id=${entry.id}`);
        }}
      />
    );
  if (id && !selected)
    return (
      <div className="p-8">
        <p>记录不存在或已被删除。</p>
        <Button onClick={() => go()}>返回列表</Button>
      </div>
    );
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] tracking-[.18em] text-muted-foreground">
            {kind === "knowledge" ? "LEARNING / KNOWLEDGE" : "JOURNAL / DAILY NOTES"}
          </p>
          <h1 className="text-2xl font-semibold">
            {selected?.title ?? (kind === "knowledge" ? "交易学习" : "日记")}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {selected
              ? `${selected.date} · 最近更新 ${new Date(selected.updatedAt).toLocaleString("zh-CN")}`
              : kind === "knowledge"
                ? "把学到的知识、找到的案例和自己的交易放在一起。"
                : "记录今天的学习、观察，以及还没有想明白的事。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected ? (
            <>
              <Button variant="outline" onClick={() => go(selected.parentId ?? undefined)}>
                <ArrowLeft />
                返回
              </Button>
              <Button variant="outline" onClick={() => void remove(selected)} aria-label="删除记录">
                <Trash2 />
              </Button>
              <Button onClick={() => setEditing(true)}>
                <Pencil />
                编辑{labels[selected.kind]}
              </Button>
            </>
          ) : (
            <Button className="bg-brand text-white hover:bg-brand/90" onClick={() => add(kind)}>
              <Plus />
              {kind === "knowledge" ? "新建知识点" : "写日记"}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {selected ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <article className={`${box} space-y-6`}>
            <div className="flex flex-wrap gap-2">
              {selected.kind === "knowledge" && (
                <>
                  <Badge>{selected.category}</Badge>
                  <Badge>{selected.status}</Badge>
                </>
              )}
              {selected.kind === "case" && (
                <>
                  <Badge>
                    {selected.symbol || "未设标的"} · {selected.timeframe || "未设周期"}
                  </Badge>
                  <Badge>{selected.outcome}</Badge>
                </>
              )}
              {selected.kind === "diary" && <Badge>心情：{selected.mood}</Badge>}
              {selected.tags.map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
            </div>
            {selected.content ? (
              <Markdown>{selected.content}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">还没有正文，点击编辑开始记录。</p>
            )}
            {selected.kind === "knowledge" && (
              <>
                <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
                  <Section title="适用条件" text={selected.applies} />
                  <Section title="失效条件与误区" text={selected.invalidates} />
                </div>
                <Section title="待验证的问题" text={selected.questions} />
                <div className="border-t pt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-medium">
                      案例库 · {entries.filter((e) => e.parentId === selected.id).length}
                    </h2>
                    <Button variant="outline" onClick={() => add("case", selected.id)}>
                      <Plus />
                      添加案例
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {entries
                      .filter((e) => e.parentId === selected.id)
                      .map((c) => (
                        <EntryCard entry={c} key={c.id} onClick={() => go(c.id)} />
                      ))}
                  </div>
                  {!entries.some((e) => e.parentId === selected.id) && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      收集第一组案例：可以是成功、失败，或仍在观察的形态。
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="border-t pt-5">
              <PersonalMedia id={selected.id} />
            </div>
          </article>
          <aside className="space-y-5">
            <div className={box}>
              <h2 className="mb-4 font-medium">记录信息</h2>
              <dl className="space-y-4 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">日期</dt>
                  <dd>{selected.date}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">图片</dt>
                  <dd>{selected.attachmentCount ?? 0} 张</dd>
                </div>
              </dl>
              {selected.source && (
                <a
                  href={selected.source}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 block break-all text-xs text-brand underline"
                >
                  查看学习来源 ↗
                </a>
              )}
            </div>
            <Related entry={selected} entries={entries} />
            {selected.parentId && (
              <Link
                href={`/learning?id=${selected.parentId}`}
                className={`${box} block text-sm text-brand`}
              >
                ← 返回所属知识点
              </Link>
            )}
          </aside>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="搜索记录"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标题、正文、标签或案例…"
                className="pl-9"
              />
            </div>
            {kind === "knowledge" && (
              <>
                <select
                  aria-label="分类筛选"
                  className={`${control} !w-auto`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>全部</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  aria-label="状态筛选"
                  className={`${control} !w-auto`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["全部", "整理中", "观察验证中", "已整理"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
            <span className="text-xs text-muted-foreground">{rows.length} 篇记录</span>
          </div>
          {rows.length ? (
            <div
              className={
                kind === "knowledge"
                  ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
                  : "grid gap-4 md:grid-cols-2"
              }
            >
              {rows.map((entry) => (
                <EntryCard entry={entry} key={entry.id} onClick={() => go(entry.id)} />
              ))}
            </div>
          ) : (
            <div className={`${box} py-24 text-center`}>
              <BookOpen className="mx-auto mb-4 size-8 text-brand" />
              <h2>{search ? "没有找到匹配的记录" : "从第一篇记录开始"}</h2>
              <p className="my-3 text-sm text-muted-foreground">
                {kind === "knowledge"
                  ? "写下你的理解，再收集图片案例来验证它。"
                  : "学习、感悟和小想法，都可以写在这里。"}
              </p>
              <Button variant="outline" onClick={() => add(kind)}>
                新建{labels[kind]}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function Section({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {text || "尚未记录"}
      </div>
    </section>
  );
}
function EntryCard({ entry: e, onClick }: { entry: PersonalEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-xl border bg-card text-left transition hover:border-brand/60"
    >
      {e.coverId ? (
        <img
          src={`/api/attachments/${e.coverId}`}
          alt={e.title}
          className="h-44 w-full border-b bg-background object-cover"
        />
      ) : e.kind !== "diary" ? (
        <div className="flex h-32 items-center gap-4 border-b bg-secondary/30 px-6">
          <BookOpen className="size-8 text-brand/70" />
          <span className="text-sm text-muted-foreground">
            {e.kind === "case" ? "CASE STUDY" : "KNOWLEDGE / NOTES"}
          </span>
        </div>
      ) : null}
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <Badge>{e.kind === "diary" ? e.date : e.kind === "case" ? e.outcome : e.category}</Badge>
          <span className="text-xs text-muted-foreground">
            {e.kind === "knowledge" ? e.status : e.mood}
          </span>
        </div>
        <h2 className="text-base font-semibold group-hover:text-brand">{e.title}</h2>
        <p className="line-clamp-2 min-h-10 text-xs leading-6 text-muted-foreground">
          {e.content.replace(/[#*\[\]]/g, "").slice(0, 150) || "点击查看并继续记录"}
        </p>
        <div className="flex justify-between border-t pt-3 text-xs text-muted-foreground">
          <span>
            {e.kind === "knowledge" ? `${e.caseCount ?? 0} 个案例 · ` : ""}
            {e.attachmentCount ?? 0} 张图片 · {e.tradeKeys.length} 笔交易
          </span>
          <span>{e.date.slice(5)}</span>
        </div>
      </div>
    </button>
  );
}
function Related({ entry, entries }: { entry: PersonalEntry; entries: PersonalEntry[] }) {
  return (
    <div className={`${box} space-y-4`}>
      <h2 className="font-medium">关联内容</h2>
      {entry.knowledgeIds.map((id) => (
        <Link
          key={id}
          className="block rounded-md border bg-brand/5 p-3 text-xs hover:text-brand"
          href={`/learning?id=${id}`}
        >
          {entries.find((e) => e.id === id)?.title ?? "知识点已删除"}
        </Link>
      ))}
      {entry.tradeKeys.map((key) => (
        <Link
          key={key}
          className="block break-all rounded-md border bg-brand/5 p-3 text-xs hover:text-brand"
          href={tradePath(key)}
        >
          {key.split("|")[1] || "交易"} · 查看交易详情 →
        </Link>
      ))}
      {!entry.tradeKeys.length && !entry.knowledgeIds.length && (
        <p className="text-xs leading-6 text-muted-foreground">
          编辑记录后，可关联知识点或实际交易。
        </p>
      )}
    </div>
  );
}

export function PersonalEditor({
  kind,
  entry,
  parentId,
  entries,
  onCancel,
  onSaved,
  tradeKey,
}: {
  kind: EntryKind;
  entry?: PersonalEntry;
  parentId?: string | null;
  entries: PersonalEntry[];
  onCancel: () => void;
  onSaved: (entry: PersonalEntry) => void;
  tradeKey?: string;
}) {
  const initial: PersonalContent = entry ?? {
    ...emptyContent(),
    title: kind === "review" ? "交易复盘" : "",
    tradeKeys: tradeKey ? [tradeKey] : [],
  };
  const [draft, setDraft] = useState<PersonalContent>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tradeQuery, setTradeQuery] = useState("");
  const lookup = useApi<{ trades: LinkableTrade[] }>(
    `/api/trades/lookup?q=${encodeURIComponent(tradeQuery)}`,
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: MouseEvent) => {
      if ((e.target as Element).closest("a[href]") && !confirm("有未保存的内容，确定离开吗？")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [dirty]);
  const change = (key: keyof PersonalContent, value: string | string[]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const field = (key: keyof PersonalContent, label: string, multiline = false) => (
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span>{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          className={`${control} min-h-24 leading-7 text-foreground`}
          value={String(draft[key])}
          onChange={(e) => change(key, e.target.value)}
        />
      ) : (
        <Input
          aria-label={label}
          className="text-foreground"
          value={String(draft[key])}
          onChange={(e) => change(key, e.target.value)}
          type={key === "date" ? "date" : "text"}
          maxLength={key === "title" ? 200 : 10000}
        />
      )}
    </label>
  );
  const select = (key: keyof PersonalContent, label: string, options: string[]) => (
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        className={control}
        aria-label={label}
        value={String(draft[key])}
        onChange={(e) => change(key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await postJson<{ entry: PersonalEntry }>(
        entry ? `/api/personal/${entry.id}` : "/api/personal",
        {
          ...draft,
          kind,
          parentId: entry?.parentId ?? parentId ?? null,
          revision: entry?.revision,
        },
        entry ? "PATCH" : "POST",
      );
      onSaved(r.entry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] tracking-widest text-muted-foreground">
            PERSONAL / EDITOR
          </p>
          <h1 className="text-2xl font-semibold">
            {entry ? "编辑" : "新建"}
            {labels[kind]}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!dirty || confirm("放弃未保存的修改？")) onCancel();
            }}
          >
            取消
          </Button>
          <Button
            disabled={busy || !draft.title.trim()}
            onClick={() => void save()}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {busy ? "正在保存…" : "保存" + labels[kind]}
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className={`${box} space-y-6`}>
          {field("title", "标题 *")}
          {kind === "review" ? (
            <>
              {field("entryReason", "进场理由 / 当时的判断", true)}
              {field("exitReason", "出场理由", true)}
              {field("improvement", "做得好 / 下次改进", true)}
            </>
          ) : null}
          <div>
            <h2 className="mb-3 text-sm">
              {kind === "case" ? "案例说明 · 可按出现前、发展中、结果分别记录" : "正文"}
            </h2>
            <RichEditor
              value={draft.content}
              onChange={(v) => change("content", v)}
              defaultMode="edit"
              placeholder="写下你的理解、观察与想法…"
            />
          </div>
          {kind === "knowledge" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("applies", "适用条件", true)}
                {field("invalidates", "失效条件与误区", true)}
              </div>
              {field("questions", "待验证的问题 / 下一步", true)}
            </>
          )}
          {entry ? (
            <PersonalMedia
              id={entry.id}
              onInsert={(text) => change("content", draft.content + text)}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <ImageIcon className="mx-auto mb-3 size-6" />
              先保存记录，即可上传、拖拽或粘贴图片。
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {dirty ? "有尚未保存的修改" : "所有内容已与当前记录一致"} · {draft.content.length} 字
          </p>
        </div>
        <aside className="space-y-5">
          <div className={`${box} space-y-4`}>
            <h2 className="font-medium">记录信息</h2>
            {field("date", "日期")}
            {kind === "knowledge" && (
              <>
                {field("category", "分类")}
                {select("status", "学习状态", ["整理中", "观察验证中", "已整理"])}
              </>
            )}
            {kind === "case" && (
              <>
                {field("symbol", "交易标的")}
                {field("timeframe", "图表周期")}
                {select("outcome", "案例类型", ["待观察", "成功案例", "失败案例"])}
              </>
            )}
            {(kind === "diary" || kind === "review") &&
              select("mood", "心情", ["平静", "专注", "兴奋", "焦虑", "疲惫", "沮丧"])}
            {kind === "review" &&
              select("followedPlan", "是否按计划执行", [
                "待评价",
                "按计划执行",
                "部分偏离",
                "未按计划",
              ])}
            {field("source", "来源链接")}
            <label className="block space-y-2 text-xs text-muted-foreground">
              <span>标签（逗号分隔）</span>
              <Input
                aria-label="标签"
                value={draft.tags.join(",")}
                onChange={(e) => change("tags", e.target.value.split(/[,，]/))}
              />
            </label>
          </div>
          <div className={`${box} space-y-4`}>
            <h2 className="font-medium">关联内容</h2>
            <label className="block text-xs text-muted-foreground">
              关联知识点
              <select
                aria-label="关联知识点"
                className={`${control} mt-2`}
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    change("knowledgeIds", [...new Set([...draft.knowledgeIds, e.target.value])]);
                }}
              >
                <option value="">选择知识点…</option>
                {entries
                  .filter((e) => e.kind === "knowledge" && e.id !== entry?.id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
            {draft.knowledgeIds.map((id) => (
              <button
                type="button"
                key={id}
                className="block text-left text-xs text-brand"
                onClick={() =>
                  change(
                    "knowledgeIds",
                    draft.knowledgeIds.filter((k) => k !== id),
                  )
                }
              >
                {entries.find((e) => e.id === id)?.title ?? id} ×
              </button>
            ))}
            {kind !== "review" && (
              <>
                <Input
                  aria-label="搜索关联交易"
                  placeholder="搜索标的 / 日期"
                  value={tradeQuery}
                  onChange={(e) => setTradeQuery(e.target.value)}
                />
                <select
                  aria-label="关联交易"
                  className={control}
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      change("tradeKeys", [...new Set([...draft.tradeKeys, e.target.value])]);
                  }}
                >
                  <option value="">选择交易…</option>
                  {lookup.data?.trades.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.symbol} · {t.openedAt.slice(0, 10)} · {t.accountName}
                    </option>
                  ))}
                </select>
              </>
            )}
            {lookup.error && <p className="text-xs text-destructive">交易列表读取失败</p>}
            {draft.tradeKeys.map((key) => (
              <button
                type="button"
                key={key}
                className="block max-w-full break-all text-left text-xs text-brand"
                disabled={kind === "review"}
                onClick={() =>
                  change(
                    "tradeKeys",
                    draft.tradeKeys.filter((k) => k !== key),
                  )
                }
              >
                {lookup.data?.trades.find((t) => t.key === key)?.symbol ?? key}{" "}
                {kind !== "review" ? "×" : ""}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
