"use client";
import { useI18n } from "@/components/language";

import type { ImportReview, ImportReviewOptions } from "@/lib/import-review";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/utils";

export function ImportReconciliation({
  review,
  options,
  onChange,
  onReview,
  busy,
}: {
  review?: ImportReview;
  options: ImportReviewOptions;
  onChange: (next: ImportReviewOptions) => void;
  onReview: () => void;
  busy: boolean;
}) {
  const { t: ui, language } = useI18n();

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm font-medium">{ui("Review NinjaTrader import")}</p>
      <p className="text-xs text-muted-foreground">
        {ui(
          "Keep each source account separate inside your selected journal account. Review the result before saving.",
        )}
      </p>
      {review && (
        <>
          {review.sources.map((source) => (
            <label key={source.key} className="block space-y-1 text-sm">
              <span>{source.label}</span>
              <select
                aria-label={`Source mapping for ${source.label}`}
                disabled={busy || source.saved}
                className="block w-full rounded-md border bg-background p-2 text-sm"
                value={options.sourceMappings?.[source.key] ?? source.selected ?? ""}
                onChange={(event) =>
                  onChange({
                    ...options,
                    sourceMappings: { ...options.sourceMappings, [source.key]: event.target.value },
                  })
                }
              >
                <option value="">{ui("Choose the source this file belongs to")}</option>
                {review.savedSources.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                  </option>
                ))}
                <option value="new">{ui("Create a separate source account")}</option>
              </select>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            {ui(
              "If an account or connection was renamed, select its existing source. Choose a new source only for a genuinely different account.",
            )}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" role="status">
            <span>
              {review.inserted} {ui("new fills")}
            </span>
            <span>
              {review.duplicates} {ui("duplicate fills")}
            </span>
            <span>
              {review.corrections.length} {ui("fee corrections")}
            </span>
          </div>
          {review.multipliers.map((item) => (
            <p key={item.symbol} className="text-xs">
              {item.symbol} {ui("multiplier:")}{" "}
              {item.value ?? ui("missing — configure in Settings")}
            </p>
          ))}
          {review.multipliers.some((item) => item.value === null) && (
            <a className="text-sm underline" href="/settings" target="_blank" rel="noreferrer">
              {ui("Open Settings, then review again")}
            </a>
          )}
          {review.totals && (
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {ui("Destination account after import (")}
                {review.currency})
              </p>
              <p>
                {review.totals.closedTrades} {ui("closed trades ·")} {review.totals.openTrades}{" "}
                {ui("open trades")}
              </p>
              <p>
                {ui("Closed-trade net P&L:")}
                {fmtMoney(review.totals.netPnl, review.currency)} {ui("· Fees:")}{" "}
                {fmtMoney(review.totals.fees, review.currency)}
              </p>
            </div>
          )}
          {review.needsCompleteHistory && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!options.completeHistory}
                disabled={busy}
                onChange={(event) =>
                  onChange({ ...options, completeHistory: event.target.checked })
                }
              />
              <span>
                {ui(
                  "This export includes every execution for each listed source contract between its first and last timestamp. It is not a partial selection of repeated fills.",
                )}
              </span>
            </label>
          )}
          {!!review.corrections.length && (
            <div className="space-y-2">
              {review.corrections.slice(0, 10).map((correction, index) => (
                <p key={index} className="text-xs">
                  {correction.symbol} · {correction.executedAt}
                  {ui(": commission")} {fmtMoney(correction.oldFee, review.currency)} →{" "}
                  {fmtMoney(correction.newFee, review.currency)}
                </p>
              ))}
              {review.corrections.length > 10 && (
                <p className="text-xs">
                  {ui("Plus")} {review.corrections.length - 10} {ui("more fee corrections.")}
                </p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!options.approveFeeCorrections}
                  disabled={busy}
                  onChange={(event) =>
                    onChange({ ...options, approveFeeCorrections: event.target.checked })
                  }
                />
                <span>
                  {ui(
                    "Apply these commission corrections to the existing executions and recalculate P&L.",
                  )}
                </span>
              </label>
            </div>
          )}
          {review.warnings.map((message) => (
            <p key={message} className="text-xs text-muted-foreground">
              {message}
            </p>
          ))}
          {review.conflicts.map((message) => (
            <p key={message} role="alert" className="text-xs text-loss">
              {message}
            </p>
          ))}
        </>
      )}
      <Button variant="outline" disabled={busy} onClick={onReview}>
        {busy ? ui("Reviewing…") : ui("Review import")}
      </Button>
      {review?.token && (
        <p className="text-xs text-muted-foreground">
          {ui(
            "Review complete. Import will save this result; if the file, settings or journal changes, another review is required.",
          )}
        </p>
      )}
    </div>
  );
}
