"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postJson, useApi } from "@/lib/use-api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function PersonalMedia({ id, onInsert }: { id: string; onInsert?: (text: string) => void }) {
  const { data, error, refresh } = useApi<{
    attachments: { id: string; name: string; mime: string; size: number }[];
  }>(`/api/attachments?type=personal&id=${encodeURIComponent(id)}`);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const files = data?.attachments ?? [];
  const images = files.filter((f) => f.mime.startsWith("image/"));
  const index = images.findIndex((f) => f.id === selected);
  const image = images[index];
  const move = (delta: number) =>
    setSelected(images[(index + delta + images.length) % images.length]?.id ?? null);
  useEffect(() => {
    if (!selected) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function upload(batch: File[]) {
    if (busy || !batch.length) return;
    setBusy(true);
    setFailure("");
    try {
      for (const file of batch) {
        const body = new FormData();
        body.append("type", "personal");
        body.append("id", id);
        body.append("file", file);
        const r = await fetch("/api/attachments", { method: "POST", body });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
      refresh();
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section
      className="space-y-4"
      onPaste={(e) => {
        const batch = Array.from(e.clipboardData.files);
        if (batch.length) {
          e.preventDefault();
          void upload(batch);
        }
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">图片与附件</h3>
        <span className="text-xs text-muted-foreground">{files.length} 个附件</span>
      </div>
      <button
        type="button"
        disabled={busy}
        className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:border-brand hover:text-foreground"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <ImagePlus className="size-6" />
        {busy ? "正在上传…" : "点击、拖拽或在此粘贴图片"}
        <span className="text-xs">PNG / JPG / WebP / PDF · 每个文件最多 8 MB</span>
      </button>
      <input
        ref={input}
        aria-label="上传图片"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => void upload(Array.from(e.target.files ?? []))}
      />
      {(failure || error) && (
        <p role="alert" className="text-sm text-destructive">
          {failure || error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {files.map((f) => (
          <div className="min-w-0 rounded-lg border p-2" key={f.id}>
            {f.mime.startsWith("image/") ? (
              <button
                type="button"
                className="w-full"
                onClick={() => setSelected(f.id)}
                aria-label={`放大 ${f.name}`}
              >
                <img
                  src={`/api/attachments/${f.id}`}
                  alt={f.name}
                  className="h-40 w-full rounded bg-background object-contain"
                />
              </button>
            ) : (
              <a
                href={`/api/attachments/${f.id}`}
                target="_blank"
                rel="noreferrer"
                className="block p-4 underline"
              >
                {f.name}
              </a>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs" title={f.name}>
                {f.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`删除附件 ${f.name}`}
                disabled={busy}
                onClick={async () => {
                  if (!confirm("删除这张图片/附件？")) return;
                  try {
                    await postJson(`/api/attachments/${f.id}`, undefined, "DELETE");
                    refresh();
                  } catch (e) {
                    setFailure(String(e));
                  }
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
            {onInsert && f.mime.startsWith("image/") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInsert(`\n![图片说明](/api/attachments/${f.id})\n`)}
              >
                插入正文
              </Button>
            )}
          </div>
        ))}
      </div>
      <Dialog open={!!image} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw]">
          <DialogTitle>{image?.name}</DialogTitle>
          <DialogDescription>
            方向键切换图片 · {index + 1} / {images.length}
          </DialogDescription>
          {image && (
            <img
              src={`/api/attachments/${image.id}`}
              alt={image.name}
              className="max-h-[72vh] w-full object-contain"
            />
          )}
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => move(-1)}>
              <ChevronLeft />
              上一张
            </Button>
            <Button variant="outline" onClick={() => move(1)}>
              下一张
              <ChevronRight />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
