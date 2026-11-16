import pairs from "./messages.json";
export type Language = "zh-CN" | "en";
export const LANGUAGE_KEY = "zhifan-language-v1";
export const languagePreference = (value: string | null): Language =>
  value === "en" ? "en" : "zh-CN";
const zh = new Map<string, string>();
const en = new Map<string, string>();
for (const [english, chinese] of pairs) {
  if (!english || !chinese) continue;
  zh.set(english, chinese);
  if (!en.has(chinese)) en.set(chinese, english);
}
/** Only call on interface messages and fixed labels, never user-authored content. */
export function translate(text: string, language: Language) {
  return (language === "en" ? en : zh).get(text) ?? text;
}
