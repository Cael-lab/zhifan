// @vitest-environment jsdom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LanguageProvider, LanguageSwitch, useI18n } from "../src/components/language";
import { LANGUAGE_KEY, languagePreference, translate } from "../src/lib/i18n";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function Probe() {
  const { t } = useI18n();
  const [title] = useState("我的交易 Diary — Save");
  const [status] = useState("观察验证中");
  return h(
    "div",
    null,
    h("h1", null, t("交易学习")),
    h("input", { value: title, readOnly: true }),
    h(
      "select",
      { "aria-label": "status", value: status, onChange: () => {} },
      h("option", { value: status }, t(status)),
    ),
    h(LanguageSwitch),
  );
}
it("switches interface language without remounting or translating user text and stored option values", async () => {
  await act(async () => root.render(h(LanguageProvider, null, h(Probe))));
  const input = host.querySelector("input")!;
  const select = host.querySelector('select[aria-label="语言 / Language"]') as HTMLSelectElement;
  expect(host.querySelector("h1")?.textContent).toBe("交易学习");
  await act(async () => {
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.querySelector("h1")?.textContent).toBe("Trading study");
  expect(host.querySelector("input")).toBe(input);
  expect(input.value).toBe("我的交易 Diary — Save");
  const status = host.querySelector('select[aria-label="status"]') as HTMLSelectElement;
  expect(status.value).toBe("观察验证中");
  expect(status.options[0]?.text).toBe("Under observation");
  expect(document.documentElement.lang).toBe("en");
  expect(document.title).toBe("Zhifan · Trading & Learning");
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
});
it("restores the saved preference and synchronizes changes from another tab", async () => {
  localStorage.setItem(LANGUAGE_KEY, "en");
  await act(async () => root.render(h(LanguageProvider, null, h(Probe))));
  expect(host.querySelector("h1")?.textContent).toBe("Trading study");
  await act(async () =>
    window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_KEY, newValue: "zh-CN" })),
  );
  expect(host.querySelector("h1")?.textContent).toBe("交易学习");
  expect(document.documentElement.lang).toBe("zh-CN");
  expect(document.title).toBe("知返 · 交易与学习");
});
it("uses a safe preference fallback and preserves unknown source text", () => {
  expect(languagePreference("fr")).toBe("zh-CN");
  expect(translate("净盈亏", "en")).toBe("Net P&L");
  expect(translate("Stop loss", "zh-CN")).toBe("止损价");
  expect(translate("unrecognized broker response", "zh-CN")).toBe("unrecognized broker response");
});
