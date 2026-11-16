"use client";
import { useI18n } from "@/components/language";

import Link from "next/link";
import { BookOpen, NotebookPen, ArrowUpRight } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { PersonalEntry } from "@/lib/personal";
export function PersonalOverview() {
  const { t: ui, language } = useI18n();

  const { data, error } = useApi<{ entries: PersonalEntry[] }>("/api/personal");
  if (error)
    return (
      <p className="px-5 text-sm text-destructive">
        {ui("学习记录加载失败：")}
        {error}
      </p>
    );
  const entries = data?.entries ?? [];
  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2">
      {(["knowledge", "diary"] as const).map((kind) => {
        const rows = entries.filter((e) => e.kind === kind);
        const href = kind === "knowledge" ? "/learning" : "/diary";
        return (
          <section className="rounded-xl border bg-card p-5" key={kind}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                {kind === "knowledge" ? (
                  <BookOpen className="size-4 text-brand" />
                ) : (
                  <NotebookPen className="size-4 text-brand" />
                )}
                {kind === "knowledge" ? ui("继续学习") : ui("最近日记")}
                <span className="text-xs text-muted-foreground">{rows.length}</span>
              </h2>
              <Link className="text-xs text-brand" href={href}>
                {ui("查看全部 →")}
              </Link>
            </div>
            {rows.slice(0, 3).map((e) => (
              <Link
                href={`${href}?id=${e.id}`}
                key={e.id}
                className="flex items-center justify-between gap-4 border-t py-3 text-sm hover:text-brand"
              >
                <span className="truncate">{e.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{e.date}</span>
              </Link>
            ))}
            {!rows.length && (
              <Link
                href={href}
                className="flex items-center justify-between rounded-lg border border-dashed p-5 text-sm text-muted-foreground"
              >
                {kind === "knowledge"
                  ? ui("创建第一个知识点，收集相关案例")
                  : ui("写下今天的学习与想法")}
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
