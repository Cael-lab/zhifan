export const ENTRY_KINDS = ["knowledge", "case", "diary", "review"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export interface PersonalContent {
  title: string;
  content: string;
  category: string;
  status: string;
  tags: string[];
  source: string;
  date: string;
  mood: string;
  applies: string;
  invalidates: string;
  questions: string;
  symbol: string;
  timeframe: string;
  outcome: string;
  entryReason: string;
  exitReason: string;
  improvement: string;
  followedPlan: string;
  tradeKeys: string[];
  knowledgeIds: string[];
}
export interface PersonalEntry extends PersonalContent {
  id: string;
  kind: EntryKind;
  parentId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  coverId?: string;
  attachmentCount?: number;
  caseCount?: number;
}
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const emptyContent = (): PersonalContent => ({
  title: "",
  content: "",
  category: "价格行为",
  status: "整理中",
  tags: [],
  source: "",
  date: todayLocal(),
  mood: "平静",
  applies: "",
  invalidates: "",
  questions: "",
  symbol: "",
  timeframe: "",
  outcome: "待观察",
  entryReason: "",
  exitReason: "",
  improvement: "",
  followedPlan: "待评价",
  tradeKeys: [],
  knowledgeIds: [],
});

/** Allowlisted, bounded fields shared by writes and backup restores. */
export function parsePersonalContent(input: unknown): PersonalContent {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("记录格式无效");
  const obj = input as Record<string, unknown>;
  const result = emptyContent();
  for (const key of Object.keys(result) as (keyof PersonalContent)[]) {
    if (key === "tags" || key === "tradeKeys" || key === "knowledgeIds") {
      const list = obj[key] ?? [];
      if (
        !Array.isArray(list) ||
        list.length > 100 ||
        list.some((v) => typeof v !== "string" || v.length > 1000)
      )
        throw new Error(`${key} 列表无效`);
      result[key] = [...new Set((list as string[]).map((v) => v.trim()).filter(Boolean))];
    } else {
      const value = obj[key] ?? result[key];
      if (typeof value !== "string" || value.length > (key === "content" ? 200000 : 10000))
        throw new Error(`${key} 内容过长或格式无效`);
      result[key] = value;
    }
  }
  result.title = result.title.trim();
  if (!result.title || result.title.length > 200) throw new Error("请填写 1–200 字的标题");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result.date) ||
    !Number.isFinite(Date.parse(result.date)) ||
    new Date(result.date).toISOString().slice(0, 10) !== result.date
  )
    throw new Error("日期无效");
  if (result.source && !/^https?:\/\//i.test(result.source))
    throw new Error("来源链接必须以 http:// 或 https:// 开头");
  return result;
}
