/**
 * src/api.ts — Thin client layer.
 * In Electron: calls window.electronAPI.invoke(channel, payload).
 * In browser dev (npm run dev): falls back to the in-memory mock in api.mock.ts.
 *
 * Types, pure helpers (buildMessage, balanceLine, itemsShort) are exported from here
 * so UI imports never need to change.
 */
import { fmtDate, itemsShort } from "./lib/format";

// ── Re-export types so UI imports are unchanged ─────────────────────────────
export type {
  Product, Sale, Settings, PaymentType, CustomerType, Cycle,
} from "./mockData";
export type { CustomerRow } from "./mockData";

import type { CustomerRow, PaymentType, Settings } from "./mockData";
import type { LedgerRow } from "./mockData";

export type Customer = CustomerRow & { balance: number; lastActivityAt: string | null };
export type LedgerEntry = LedgerRow & { runningBalance: number };

export type NewCustomer = Omit<CustomerRow, "id" | "createdAt" | "active"> & {
  openingBalance?: { amount: number; kind: "udhar" | "advance" } | null;
  advanceAmount?: number | null;
};

export type MessageType = "sale" | "payment" | "reminder" | "advance";

// ── Detect Electron ─────────────────────────────────────────────────────────
const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI;

// ── IPC bridge ──────────────────────────────────────────────────────────────
async function ipc<T>(channel: string, payload?: unknown): Promise<T> {
  const result = await (window as any).electronAPI.invoke(channel, payload);
  if (!result.ok) throw new Error(result.error ?? "Unknown error");
  return result.data as T;
}

// ── Lazy mock import ────────────────────────────────────────────────────────
let _mock: typeof import("./api.mock") | null = null;
async function mock(): Promise<typeof import("./api.mock")> {
  if (!_mock) _mock = await import("./api.mock");
  return _mock;
}

// ── API functions ────────────────────────────────────────────────────────────

export async function listCustomers(opts?: { search?: string; type?: import("./mockData").CustomerType | "all"; cycle?: import("./mockData").Cycle | "all"; includeInactive?: boolean }) {
  if (isElectron) return ipc<Customer[]>("listCustomers", opts);
  return (await mock()).listCustomers(opts);
}

export async function searchCustomers(query: string, limit = 8) {
  if (isElectron) return ipc<Customer[]>("searchCustomers", { query, limit });
  return (await mock()).searchCustomers(query, limit);
}

export async function getCustomer(id: string) {
  if (isElectron) return ipc<Customer>("getCustomer", { id });
  return (await mock()).getCustomer(id);
}

export async function createCustomer(data: NewCustomer) {
  if (isElectron) return ipc<Customer>("createCustomer", data);
  return (await mock()).createCustomer(data);
}

export async function updateCustomer(id: string, patch: Partial<CustomerRow>) {
  if (isElectron) return ipc<Customer>("updateCustomer", { id, ...patch });
  return (await mock()).updateCustomer(id, patch);
}

export async function setCustomerActive(id: string, active: boolean) {
  if (isElectron) return ipc<Customer>("setCustomerActive", { id, active });
  return (await mock()).setCustomerActive(id, active);
}

export async function listProducts(opts?: { includeInactive?: boolean }) {
  if (isElectron) return ipc<import("./mockData").Product[]>("listProducts", opts);
  return (await mock()).listProducts(opts);
}

export async function createProduct(data: Omit<import("./mockData").Product, "id">) {
  if (isElectron) return ipc<import("./mockData").Product>("createProduct", data);
  return (await mock()).createProduct(data);
}

export async function updateProduct(id: string, patch: Partial<import("./mockData").Product>) {
  if (isElectron) return ipc<import("./mockData").Product>("updateProduct", { id, ...patch });
  return (await mock()).updateProduct(id, patch);
}

export async function createSale(input: {
  customerId: string | null;
  items: { productId: string; qty: number; unitPrice: number }[];
  deliveryFee: number;
  paymentType: PaymentType;
  note?: string;
  createdAt?: string;
}) {
  if (isElectron) return ipc<import("./mockData").Sale>("createSale", input);
  return (await mock()).createSale(input);
}

export async function listSales(opts?: {
  from?: string;
  to?: string;
  customerId?: string | null | undefined;
  paymentType?: PaymentType | "all";
  status?: "active" | "cancelled" | "all";
}) {
  if (isElectron) return ipc<import("./mockData").Sale[]>("listSales", opts);
  return (await mock()).listSales(opts);
}

export async function getSale(id: string) {
  if (isElectron) return ipc<import("./mockData").Sale>("getSale", { id });
  return (await mock()).getSale(id);
}

export async function cancelSale(id: string, reason: string) {
  if (isElectron) return ipc<import("./mockData").Sale>("cancelSale", { id, reason });
  return (await mock()).cancelSale(id, reason);
}

export async function getLedger(customerId: string, opts?: { from?: string; to?: string }) {
  if (isElectron) return ipc<LedgerEntry[]>("getLedger", { customerId, ...opts });
  return (await mock()).getLedger(customerId, opts);
}

export async function addPayment(d: { customerId: string; amount: number; method: string; note?: string; createdAt?: string }) {
  if (isElectron) return ipc<LedgerEntry>("addPayment", d);
  return (await mock()).addPayment(d);
}

export async function addAdvance(d: { customerId: string; amount: number; method?: string; note?: string; createdAt?: string }) {
  if (isElectron) return ipc<LedgerEntry>("addAdvance", d);
  return (await mock()).addAdvance(d);
}

export async function getDashboard() {
  if (isElectron) return ipc<any>("getDashboard", {});
  return (await mock()).getDashboard();
}

export async function getReport(r: { from?: string; to?: string }) {
  if (isElectron) return ipc<any>("getReport", r);
  return (await mock()).getReport(r);
}

export async function getReceivables() {
  if (isElectron) return ipc<any>("getReceivables", {});
  return (await mock()).getReceivables();
}

export async function getSettings() {
  if (isElectron) return ipc<Settings>("getSettings", {});
  return (await mock()).getSettings();
}

export async function saveSettings(patch: Partial<Settings>) {
  if (isElectron) return ipc<Settings>("saveSettings", patch);
  return (await mock()).saveSettings(patch);
}

export async function createBackup() {
  if (isElectron) return ipc<{ ok: boolean; at: string }>("createBackup", {});
  return (await mock()).createBackup();
}

export async function exportReport(r: { from?: string; to?: string }) {
  if (isElectron) return ipc<{ ok: boolean }>("exportReport", r);
  return (await mock()).exportReport(r);
}

export async function openWhatsApp(phone: string, message: string) {
  const url = "https://wa.me/" + normalizePhone(phone) + "?text=" + encodeURIComponent(message);
  if (isElectron) {
    return ipc<{ ok: boolean }>("openWhatsApp", { url });
  }
  // Browser fallback
  window.open(url, "_blank");
  return { ok: true };
}

// ── Pure helpers (exported, UI uses these directly) ─────────────────────────

function normalizePhone(p: string) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d;
}

export function balanceLine(b: number) {
  if (b > 0) return `Aapka kul udhar: Rs ${b.toLocaleString("en-US")}`;
  if (b < 0) return `Aapka advance baqi: Rs ${Math.abs(b).toLocaleString("en-US")}`;
  return "Aapka hisaab clear hai";
}

export function buildMessage(
  type: MessageType,
  ctx: {
    customerName: string; date?: string;
    items?: { name: string; qty: number }[];
    deliveryFee?: number; total?: number; amount?: number;
    balance?: number; businessName: string;
    templates: Settings["templates"];
  },
) {
  const map: Record<string, string> = {
    customer_name: ctx.customerName,
    date: fmtDate(ctx.date ?? new Date().toISOString()),
    items: ctx.items ? ctx.items.map((i) => `${i.qty} x ${i.name}`).join(", ") : "",
    delivery_line: ctx.deliveryFee ? ` + Delivery Rs ${ctx.deliveryFee}` : "",
    total: (ctx.total ?? 0).toLocaleString("en-US"),
    amount: (ctx.amount ?? 0).toLocaleString("en-US"),
    balance: Math.abs(ctx.balance ?? 0).toLocaleString("en-US"),
    balance_line: balanceLine(ctx.balance ?? 0),
    business_name: ctx.businessName,
  };
  return ctx.templates[type].replace(/\{(\w+)\}/g, (m, k) => (map[k] ?? m));
}

export { itemsShort };
