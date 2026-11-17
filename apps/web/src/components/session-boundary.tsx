"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function accountChanged() {
  try {
    localStorage.setItem("zhifan-account-event", String(Date.now()));
  } catch {
    /* Storage optional. */
  }
}
export function SessionBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPage = pathname === "/login" || pathname === "/register";
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (publicPage) return;
    let stopped = false,
      identity = "";
    const check = async () => {
      try {
        const r = await fetch("/api/auth", { cache: "no-store" });
        const data = await r.json();
        if (stopped) return;
        if (!data.user || (identity && identity !== data.user.id)) {
          setVerified(false);
          window.location.replace("/login");
          return;
        }
        identity = data.user.id;
        setVerified(true);
      } catch {
        if (!stopped) {
          setVerified(false);
          window.location.replace("/login");
        }
      }
    };
    const changed = (e: StorageEvent) => {
      if (e.key === "zhifan-account-event") {
        setVerified(false);
        window.location.replace("/login");
      }
    };
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    void check();
    window.addEventListener("focus", check);
    window.addEventListener("storage", changed);
    window.addEventListener("pageshow", shown);
    return () => {
      stopped = true;
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", changed);
      window.removeEventListener("pageshow", shown);
    };
  }, [publicPage]);
  return publicPage || verified ? (
    children
  ) : (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      知返 · Zhifan
    </div>
  );
}
