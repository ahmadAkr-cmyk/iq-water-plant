import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "@/api";
import type { Customer, Settings } from "@/api";
import { MemberFormModal } from "./MemberFormModal";
import { PaymentModal } from "./PaymentModal";

type Ctx = {
  settings: Settings | null;
  refreshSettings: () => void;
  version: number; // bumps after any data change so pages reload
  bump: () => void;
  openMemberForm: (o: { member?: Customer | null; initialName?: string; onSaved?: (c: Customer) => void }) => void;
  openPayment: (o: { customer?: Customer | null; mode?: "payment" | "advance" }) => void;
  wa: (phone: string, type: api.MessageType, ctx: Omit<Parameters<typeof api.buildMessage>[1], "businessName" | "templates">) => void;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [version, setVersion] = useState(0);
  const [member, setMember] = useState<{ member?: Customer | null; initialName?: string; onSaved?: (c: Customer) => void } | null>(null);
  const [payment, setPayment] = useState<{ customer?: Customer | null; mode?: "payment" | "advance" } | null>(null);

  const refreshSettings = useCallback(() => { api.getSettings().then(setSettings); }, []);
  useEffect(refreshSettings, [refreshSettings]);
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String((settings?.fontScale ?? 100) / 100));
  }, [settings?.fontScale]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const wa: Ctx["wa"] = (phone, type, ctx) => {
    if (!settings) return;
    api.openWhatsApp(phone, api.buildMessage(type, { ...ctx, businessName: settings.businessName, templates: settings.templates }));
  };

  return (
    <AppCtx.Provider value={{ settings, refreshSettings, version, bump, openMemberForm: setMember, openPayment: setPayment, wa }}>
      {children}
      {member && (
        <MemberFormModal
          member={member.member ?? null}
          initialName={member.initialName ?? ""}
          onClose={() => setMember(null)}
          onSaved={(c) => { bump(); member.onSaved?.(c); setMember(null); }}
        />
      )}
      {payment && (
        <PaymentModal customer={payment.customer ?? null} mode={payment.mode ?? "payment"} onClose={() => setPayment(null)} onSaved={bump} />
      )}
    </AppCtx.Provider>
  );
}
