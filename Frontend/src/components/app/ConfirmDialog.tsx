import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "./bits";

export function ConfirmDialog({ open, title, message, requireReason, confirmLabel = "Haan, karo", onConfirm, onClose, destructive }: {
  open: boolean; title: string; message: string; requireReason?: boolean; confirmLabel?: string; destructive?: boolean;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl p-8">
        <DialogTitle className="text-2xl text-deep">{title}</DialogTitle>
        <DialogDescription className="text-base text-foreground">{message}</DialogDescription>
        {requireReason && (
          <Field label="Wajah (zaroori)" hint="Kyun cancel kar rahe hain?">
            <input className="field" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        <div className="mt-2 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Wapas</Button>
          <Button variant={destructive ? "destructive" : "default"} className="flex-1" disabled={requireReason && reason.trim().length < 2}
            onClick={() => { onConfirm(reason.trim()); setReason(""); }}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
