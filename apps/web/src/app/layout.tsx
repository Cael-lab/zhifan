import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
import { PrivacyProvider } from "@/components/privacy";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LanguageProvider } from "@/components/language";
import { SessionBoundary } from "@/components/session-boundary";

export const metadata: Metadata = {
  description: "个人交易复盘、知识点案例库与日记。基于 LuxAlgo Trade Journal，本机保存。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider delayDuration={350} skipDelayDuration={150}>
          <Suspense>
            <ThemeProvider>
              <PrivacyProvider>
                <LanguageProvider>
                  <SessionBoundary>
                    <Shell>{children}</Shell>
                  </SessionBoundary>
                </LanguageProvider>
              </PrivacyProvider>
            </ThemeProvider>
          </Suspense>
        </TooltipProvider>
      </body>
    </html>
  );
}
