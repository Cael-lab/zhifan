"use client";
import { useI18n } from "@/components/language";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ZhifanMark as LuxAlgoMark } from "@/components/zhifan-mark";
import { postJson } from "@/lib/use-api";

export default function LoginPage() {
  const { t: ui, language } = useI18n();

  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await postJson("/api/auth", { password });
      router.push("/");
      router.refresh();
    } catch {
      setError(ui("Wrong password"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-80">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="text-center">
              <LuxAlgoMark className="mx-auto mb-2 h-6 w-7" />
              <h1 className="text-sm font-semibold">{ui("知返")}</h1>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={ui("Password")}
              autoFocus
            />
            {error && <p className="text-center text-xs text-loss">{error}</p>}
            <Button type="submit" className="w-full">
              {ui("Unlock")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
