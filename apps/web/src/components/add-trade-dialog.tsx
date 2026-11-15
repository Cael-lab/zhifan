"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ManualTradeEntry } from "./manual-trade-entry";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export function AddTradeDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5" />
          记录交易
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>记录一笔交易</DialogTitle>
          <DialogDescription>
            选择账户并填写每次买卖的时间、价格、数量与费用。支持只记录入场，也支持分批加仓、减仓和出场。
          </DialogDescription>
        </DialogHeader>
        <ManualTradeEntry
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
