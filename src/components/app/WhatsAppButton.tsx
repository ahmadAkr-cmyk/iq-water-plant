import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WhatsAppButton({ phone, onClick, label, icon = false, className }: { phone?: string | null | undefined; onClick: () => void; label?: string; icon?: boolean; className?: string }) {
  const disabled = !phone;
  const title = disabled ? "Phone number nahi hai" : "WhatsApp";
  return (
    <span title={title} className="inline-flex">
      <Button type="button" variant={icon ? "ghost" : "whatsapp"} size={icon ? "icon" : "default"} disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn(className)} aria-label={title}>
        <MessageCircle className="text-wa" />
        {!icon && (label ?? "WhatsApp")}
      </Button>
    </span>
  );
}
