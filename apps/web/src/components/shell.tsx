"use client";
import { useI18n, LanguageSwitch } from "@/components/language";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FILTER_KEYS } from "@luxalgo/journal-core";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BookText,
  CalendarDays,
  Import,
  LayoutDashboard,
  ListOrdered,
  NotebookPen,
  Settings,
  ListChecks,
  BookmarkPlus,
  Wallet,
  Landmark,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ZhifanMark as LuxAlgoMark } from "@/components/zhifan-mark";
import { PrivacyToggle } from "./privacy";
import { ThemeToggle } from "./theme";
import { PageTransition } from "./page-transition";
import { Button } from "./ui/button";
import { HoverHint } from "./ui/tooltip";

const NAV = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/trades", label: "交易记录", icon: ListOrdered },
  { href: "/calendar", label: "交易日历", icon: CalendarDays },
  { href: "/reports", label: "绩效报告", icon: BarChart3 },
  { href: "/learning", label: "交易学习", icon: BookText },
  { href: "/diary", label: "日记", icon: NotebookPen },
  { href: "/journal", label: "每日交易复盘", icon: CalendarDays },
  { href: "/playbooks", label: "策略清单", icon: BookOpen },
  { href: "/progress", label: "执行习惯", icon: ListChecks },
  { href: "/missed", label: "错过的机会", icon: BookmarkPlus },
] as const;

const NAV_SETUP = [
  { href: "/account", label: "账号与邀请", icon: Wallet },
  { href: "/import", label: "导入与录入", icon: Import },
  { href: "/accounts", label: "交易账户", icon: Wallet },
  { href: "/personal-backup", label: "数据备份", icon: BookText },
  { href: "/settings", label: "设置", icon: Settings },
] as const;

const SIDEBAR_COLLAPSED_KEY = "journal-sidebar-collapsed-v1";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed?: boolean;
}) {
  const { t: ui } = useI18n();

  return (
    <HoverHint content={collapsed ? label : null} side="right">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "journal-sidebar-nav-link relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", active && "text-brand")} />
        <span className="journal-sidebar-label">{ui(label)}</span>
      </Link>
    </HoverHint>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t: ui, language } = useI18n();

  const pathname = usePathname();
  const search = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    const read = () => {
      try {
        setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
      } catch {
        setSidebarCollapsed(false);
      } finally {
        setSidebarReady(true);
      }
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === SIDEBAR_COLLAPSED_KEY || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "b") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // The interaction still works when storage is unavailable.
      }
      return next;
    });
  }
  const filterQuery = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = search.get(key);
    if (value) filterQuery.set(key, value);
  }
  if (search.get("range")) filterQuery.set("range", search.get("range")!);
  if (pathname === "/login" || pathname === "/register")
    return (
      <>
        <div className="fixed right-4 top-4 z-50">
          <LanguageSwitch />
        </div>
        {children}
      </>
    );
  const navigation = (collapsed = false) => (
    <nav
      aria-label={ui("Journal navigation")}
      className="journal-sidebar-navigation min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain p-2"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
      }}
    >
      {NAV.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={filterQuery.size ? `${href}?${filterQuery}` : href}
          label={ui(label)}
          icon={icon}
          collapsed={collapsed}
          active={href === "/" ? pathname === "/" : pathname.startsWith(href)}
        />
      ))}
      <div className="!my-3 border-t" />
      {NAV_SETUP.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={filterQuery.size ? `${href}?${filterQuery}` : href}
          label={ui(label)}
          icon={icon}
          collapsed={collapsed}
          active={pathname.startsWith(href)}
        />
      ))}
    </nav>
  );
  const footer = (
    <div className="journal-sidebar-footer space-y-1 border-t p-3 text-xs text-muted-foreground">
      <div>
        {ui("基于")}{" "}
        <a
          href="https://github.com/LuxAlgo/trade-journal"
          className="underline underline-offset-2 hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          {ui("LuxAlgo Trade Journal")}
        </a>
      </div>
      <div>{ui("知返 · 个人交易与学习空间")}</div>
    </div>
  );
  return (
    <div className="journal-shell min-h-dvh lg:flex">
      <header className="journal-mobile-header sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label={ui("Open navigation")}
            >
              <Menu />
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="journal-nav-overlay fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
            <DialogPrimitive.Content
              className="journal-nav-drawer fixed inset-y-0 left-0 z-50 flex w-[min(288px,calc(100vw-40px))] flex-col border-r bg-card shadow-2xl"
              aria-describedby={undefined}
            >
              <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
                <LuxAlgoMark className="h-[18px] w-5" />
                <DialogPrimitive.Title className="text-sm font-semibold">
                  {ui("知返")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8"
                    aria-label={ui("Close navigation")}
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </div>
              {navigation()}
              <div className="border-t p-3">
                <PrivacyToggle />
              </div>
              {footer}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
        <Link
          href="/"
          className="mr-auto flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <LuxAlgoMark className="hidden h-4 w-[18px] shrink-0 min-[380px]:block" />
          <span className="truncate">{ui("知返")}</span>
        </Link>
        <LanguageSwitch compact />
        <PrivacyToggle iconOnly />
        <ThemeToggle iconOnly />
      </header>
      <aside
        className="journal-desktop-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card/50 lg:flex"
        data-collapsed={sidebarCollapsed}
        data-ready={sidebarReady}
      >
        <div className="journal-sidebar-header relative flex h-14 shrink-0 items-center border-b">
          <Link href="/" className="journal-sidebar-home flex h-full min-w-0 items-center gap-2.5">
            <LuxAlgoMark className="h-[18px] w-5 shrink-0" />
            <span className="journal-sidebar-brand-label text-sm font-semibold tracking-tight">
              {ui("知返")}
            </span>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="journal-sidebar-trigger absolute h-7 w-7 rounded-full bg-background shadow-sm"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? ui("Expand sidebar") : ui("Collapse sidebar")}
            aria-expanded={!sidebarCollapsed}
            aria-keyshortcuts="Meta+B Control+B"
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar (⌘B)`}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {navigation(sidebarCollapsed)}
        <div className="journal-sidebar-privacy border-t p-3">
          <div className="w-full space-y-1">
            <LanguageSwitch iconOnly={sidebarCollapsed} />
            <ThemeToggle iconOnly={sidebarCollapsed} />
            <PrivacyToggle iconOnly={sidebarCollapsed} />
          </div>
        </div>
        {footer}
      </aside>
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
