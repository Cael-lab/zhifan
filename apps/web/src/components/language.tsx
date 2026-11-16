"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Languages } from "lucide-react";
import { LANGUAGE_KEY, languagePreference, translate, type Language } from "@/lib/i18n";

// Components rendered outside the app provider retain their source-language labels.
const Context = createContext({
  language: "zh-CN" as Language,
  ready: false,
  t: (text: string) => text,
  setLanguage: (_language: Language) => {},
  error: "",
});
export const useI18n = () => useContext(Context);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState<Language>("zh-CN");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      setValue(languagePreference(localStorage.getItem(LANGUAGE_KEY)));
    } catch {
      /* Session-only preference remains usable. */
    }
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key === LANGUAGE_KEY || e.key === null) setValue(languagePreference(e.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "en" ? "Zhifan · Trading & Learning" : "知返 · 交易与学习";
  }, [language]);
  const setLanguage = useCallback((next: Language) => {
    setValue(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
      setError("");
    } catch {
      setError(
        next === "en"
          ? "Language changed for this session; browser storage is unavailable."
          : "语言已切换；浏览器存储不可用，无法记住此选择。",
      );
    }
  }, []);
  const value = useMemo(
    () => ({ language, ready, setLanguage, error, t: (text: string) => translate(text, language) }),
    [language, ready, setLanguage, error],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function LanguageSwitch({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const { language, setLanguage, ready, error } = useI18n();
  if (iconOnly)
    return (
      <button
        type="button"
        className="h-9 w-9 rounded-md border text-xs"
        aria-label="语言 / Language"
        title={language === "en" ? "切换到中文" : "Switch to English"}
        disabled={!ready}
        onClick={() => setLanguage(language === "en" ? "zh-CN" : "en")}
      >
        {language === "en" ? "EN" : "中"}
      </button>
    );
  return (
    <div className="min-w-0">
      <label className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
        <Languages className="size-4 shrink-0" aria-hidden="true" />
        <select
          aria-label="语言 / Language"
          className="min-w-0 bg-background text-foreground"
          value={language}
          disabled={!ready}
          onChange={(e) => setLanguage(languagePreference(e.target.value))}
        >
          <option value="zh-CN">{compact ? "中文" : "简体中文"}</option>
          <option value="en">English</option>
        </select>
      </label>
      {error && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
