// The ONE data door. All UI reads/writes go through these async functions.
// DEMO ONLY - in-memory store seeded from mockData. Real storage will be SQLite (Electron).
import {
  buildSeed, type CustomerRow, type CustomerType, type Cycle, type LedgerRow, type PaymentType,
  type Product, type Sale, type Settings,
} from "./mockData";
import { fmtDate, itemsShort, startOfDay } from "./lib/format";

export type { Product, Sale, Settings, PaymentType, CustomerType, Cycle } from "./mockData";
export type Customer = CustomerRow & { balance: number; lastActivityAt: string | null };
export type LedgerEntry = LedgerRow & { runningBalance: number };

let db: ReturnType<typeof buildSeed> | null = null;
const store = () => (db ??= buildSeed());
const delay = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 60));
let uid = 1000;
const newId = (p: string) => p + ++uid;

function balanceOf(id: string) {
  return store().ledger.filter((l) => l.customerId === id).reduce((s, l) => s + l.amount, 0);
}
function lastActivity(id: string) {
  const s = store();
  const dates = [...s.ledger.filter((l) => l.customerId === id).map((l) => l.createdAt), ...s.sales.filter((x) => x.customerId === id).map((x) => x.createdAt)];
  return dates.sort().at(-1) ?? null;
}
function hydrate(c: CustomerRow): Customer {
  return { ...c, balance: balanceOf(c.id), lastActivityAt: lastActivity(c.id) };
}
const inRange = (iso: string, from?: string, to?: string) => (!from || iso >= from) && (!to || iso <= to);

// ---------- Customers ----------
export async function listCustomers(opts: { search?: string; type?: CustomerType | "all"; cycle?: Cycle | "all"; includeInactive?: boolean } = {}) {
  const q = (opts.search ?? "").trim().toLowerCase();
  const rows = store().customers
    .filter((c) => opts.includeInactive || c.active)
    .filter((c) => !opts.type || opts.type === "all" || c.type === opts.type)
    .filter((c) => !opts.cycle || opts.cycle === "all" || c.cycle === opts.cycle)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
    .map(hydrate);
  return delay(rows);
}
export async function searchCustomers(query: string, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return delay([] as Customer[]);
  const rows = store().customers
    .filter((c) => c.active && (c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000")))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
    .slice(0, limit)
    .map(hydrate);
  return delay(rows);
}
export async function getCustomer(id: string) {
  const c = store().customers.find((x) => x.id === id);
  if (!c) throw new Error("Member nahi mila");
  return delay(hydrate(c));
}
export type NewCustomer = Omit<CustomerRow, "id" | "createdAt" | "active"> & {
  openingBalance?: { amount: number; kind: "udhar" | "advance" } | null;
  advanceAmount?: number | null;
};
export async function createCustomer(data: NewCustomer) {
  const s = store();
  const { openingBalance, advanceAmount, ...rest } = data;
  const now = new Date().toISOString();
  const c: CustomerRow = { ...rest, id: newId("c"), active: true, createdAt: now };
  s.customers.push(c);
  if (openingBalance && openingBalance.amount > 0)
    s.ledger.push({ id: newId("l"), customerId: c.id, kind: "opening", saleId: null, amount: openingBalance.kind === "udhar" ? openingBalance.amount : -openingBalance.amount, method: null, note: "Pehle ka hisaab", createdAt: now });
  if (advanceAmount && advanceAmount > 0)
    s.ledger.push({ id: newId("l"), customerId: c.id, kind: "advance", saleId: null, amount: -advanceAmount, method: "Cash", note: "", createdAt: now });
  return delay(hydrate(c));
}
export async function updateCustomer(id: string, patch: Partial<CustomerRow>) {
  const c = store().customers.find((x) => x.id === id)!;
  Object.assign(c, patch, { id });
  return delay(hydrate(c));
}
export async function setCustomerActive(id: string, active: boolean) {
  return updateCustomer(id, { active });
}

// ---------- Products ----------
export async function listProducts(opts: { includeInactive?: boolean } = {}) {
  const rows = store().products.filter((p) => opts.includeInactive || p.active).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return delay(rows);
}
export async function createProduct(data: Omit<Product, "id">) {
  const p = { ...data, id: newId("p") };
  store().products.push(p);
  return delay(p);
}
export async function updateProduct(id: string, patch: Partial<Product>) {
  const p = store().products.find((x) => x.id === id)!;
  Object.assign(p, patch, { id });
  return delay(p);
}

// ---------- Sales ----------
export async function createSale(input: { customerId: string | null; items: { productId: string; qty: number; unitPrice: number }[]; deliveryFee: number; paymentType: PaymentType; note?: string; createdAt?: string }) {
  const s = store();
  const items = input.items.filter((i) => i.qty > 0).map((i) => {
    const p = s.products.find((x) => x.id === i.productId)!;
    return { productId: i.productId, name: p.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.qty * i.unitPrice };
  });
  if (!items.length) throw new Error("Kam az kam ek bottle chahiye");
  const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
  const cust = input.customerId ? s.customers.find((c) => c.id === input.customerId) : null;
  const sale: Sale = {
    id: newId("s"), billNo: "IQW-" + String(s.sales.length + 1).padStart(4, "0"), customerId: cust?.id ?? null,
    customerName: cust?.name ?? "Walk-in", items, subtotal, deliveryFee: input.deliveryFee || 0, total: subtotal + (input.deliveryFee || 0),
    paymentType: cust ? input.paymentType : "cash", status: "active", cancelReason: null, note: input.note ?? "",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  s.sales.push(sale);
  if (cust && sale.paymentType !== "cash")
    s.ledger.push({ id: newId("l"), customerId: cust.id, kind: "sale", saleId: sale.id, amount: sale.total, method: null, note: sale.note, createdAt: sale.createdAt });
  return delay(sale);
}
export async function listSales(opts: { from?: string | undefined; to?: string | undefined; customerId?: string | null | undefined; paymentType?: PaymentType | "all"; status?: "active" | "cancelled" | "all" } = {}) {
  const rows = store().sales
    .filter((x) => inRange(x.createdAt, opts.from, opts.to))
    .filter((x) => !opts.customerId || x.customerId === opts.customerId)
    .filter((x) => !opts.paymentType || opts.paymentType === "all" || x.paymentType === opts.paymentType)
    .filter((x) => !opts.status || opts.status === "all" || x.status === opts.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(rows);
}
export async function getSale(id: string) {
  return delay(store().sales.find((x) => x.id === id)!);
}
export async function cancelSale(id: string, reason: string) {
  const s = store();
  const sale = s.sales.find((x) => x.id === id)!;
  if (sale.status === "cancelled") return delay(sale);
  sale.status = "cancelled";
  sale.cancelReason = reason;
  if (s.ledger.some((l) => l.saleId === id && l.kind === "sale"))
    s.ledger.push({ id: newId("l"), customerId: sale.customerId!, kind: "cancel_reversal", saleId: id, amount: -sale.total, method: null, note: reason, createdAt: new Date().toISOString() });
  return delay(sale);
}

// ---------- Ledger ----------
export async function getLedger(customerId: string, opts: { from?: string | undefined; to?: string | undefined } = {}) {
  const all = store().ledger.filter((l) => l.customerId === customerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let run = 0;
  const withRun = all.map((l) => ({ ...l, runningBalance: (run += l.amount) }));
  return delay(withRun.filter((l) => inRange(l.createdAt, opts.from, opts.to)).reverse());
}
export async function addPayment(d: { customerId: string; amount: number; method: string; note?: string; createdAt?: string }) {
  const e: LedgerRow = { id: newId("l"), customerId: d.customerId, kind: "payment", saleId: null, amount: -Math.abs(d.amount), method: d.method, note: d.note ?? "", createdAt: d.createdAt ?? new Date().toISOString() };
  store().ledger.push(e);
  return delay({ ...e, runningBalance: balanceOf(d.customerId) });
}
export async function addAdvance(d: { customerId: string; amount: number; method?: string; note?: string; createdAt?: string }) {
  const e: LedgerRow = { id: newId("l"), customerId: d.customerId, kind: "advance", saleId: null, amount: -Math.abs(d.amount), method: d.method ?? "Cash", note: d.note ?? "", createdAt: d.createdAt ?? new Date().toISOString() };
  store().ledger.push(e);
  return delay({ ...e, runningBalance: balanceOf(d.customerId) });
}

// ---------- Dashboard / Reports ----------
export async function getDashboard() {
  const s = store();
  const t0 = startOfDay().toISOString();
  const active = s.sales.filter((x) => x.status === "active");
  const today = active.filter((x) => x.createdAt >= t0);
  const balances = s.customers.map((c) => ({ c, b: balanceOf(c.id) }));
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = startOfDay(new Date(Date.now() - (6 - i) * 864e5));
    const e = new Date(d.getTime() + 864e5).toISOString();
    return { date: d.toISOString(), total: active.filter((x) => x.createdAt >= d.toISOString() && x.createdAt < e).reduce((a, b) => a + b.total, 0) };
  });
  return delay({
    todaySales: today.reduce((a, b) => a + b.total, 0),
    todayBottles: today.reduce((a, b) => a + b.items.reduce((x, y) => x + y.qty, 0), 0),
    today19L: today.reduce((a, b) => a + b.items.filter((i) => i.productId === "p1").reduce((x, y) => x + y.qty, 0), 0),
    todayDeliveries: today.filter((x) => x.deliveryFee > 0).length,
    totalUdhar: balances.filter((x) => x.b > 0).reduce((a, x) => a + x.b, 0),
    totalAdvance: -balances.filter((x) => x.b < 0).reduce((a, x) => a + x.b, 0),
    last7Days,
    recentSales: [...s.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    topUdhar: balances.filter((x) => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 5).map((x) => hydrate(x.c)),
  });
}
export async function getReport({ from, to }: { from?: string | undefined; to?: string | undefined }) {
  const s = store();
  const sales = s.sales.filter((x) => inRange(x.createdAt, from, to));
  const active = sales.filter((x) => x.status === "active");
  const led = s.ledger.filter((l) => inRange(l.createdAt, from, to));
  const cashSales = active.filter((x) => x.paymentType === "cash").reduce((a, b) => a + b.total, 0);
  const paymentsCollected = -led.filter((l) => l.kind === "payment").reduce((a, b) => a + b.amount, 0);
  const bySizeMap = new Map<string, { size: string; qty: number; amount: number }>();
  active.forEach((x) => x.items.forEach((i) => {
    const r = bySizeMap.get(i.name) ?? { size: i.name, qty: 0, amount: 0 };
    r.qty += i.qty; r.amount += i.lineTotal; bySizeMap.set(i.name, r);
  }));
  const dayMap = new Map<string, number>();
  active.forEach((x) => { const k = startOfDay(new Date(x.createdAt)).toISOString(); dayMap.set(k, (dayMap.get(k) ?? 0) + x.total); });
  return delay({
    totalSale: active.reduce((a, b) => a + b.total, 0),
    cashReceived: cashSales,
    udharGiven: active.filter((x) => x.paymentType === "udhar").reduce((a, b) => a + b.total, 0),
    paymentsCollected,
    advanceReceived: -led.filter((l) => l.kind === "advance").reduce((a, b) => a + b.amount, 0),
    cancelledCount: sales.filter((x) => x.status === "cancelled").length,
    deliveries: active.filter((x) => x.deliveryFee > 0).length,
    bySize: [...bySizeMap.values()].sort((a, b) => b.amount - a.amount),
    daily: [...dayMap.entries()].sort().map(([date, total]) => ({ date, total })),
    cashInHand: cashSales + paymentsCollected,
  });
}
export async function getReceivables() {
  const rows = store().customers.map((c) => ({ customer: hydrate(c), balance: balanceOf(c.id) })).filter((x) => x.balance > 0).sort((a, b) => b.balance - a.balance);
  return delay({ rows, total: rows.reduce((a, b) => a + b.balance, 0) });
}

// ---------- Settings ----------
export async function getSettings() {
  return delay(store().settings);
}
export async function saveSettings(patch: Partial<Settings>) {
  Object.assign(store().settings, patch);
  return delay(store().settings);
}
export async function createBackup() {
  const at = new Date().toISOString();
  store().settings.lastBackupAt = at;
  return delay({ ok: true, at });
}
export async function exportReport(_r: { from?: string | undefined; to?: string | undefined }) {
  return delay({ ok: true });
}

// ---------- WhatsApp ----------
function normalizePhone(p: string) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "92" + d.slice(1); // 0300... -> 92300...
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d; // already 92... stays
}
export async function openWhatsApp(phone: string, message: string) {
  const url = "https://wa.me/" + normalizePhone(phone) + "?text=" + encodeURIComponent(message);
  window.open(url, "_blank"); // TODO Electron: replace with shell.openExternal(url)
}

export type MessageType = "sale" | "payment" | "reminder" | "advance";
export function balanceLine(b: number) {
  if (b > 0) return `Aapka kul udhar: Rs ${b.toLocaleString("en-US")}`;
  if (b < 0) return `Aapka advance baqi: Rs ${Math.abs(b).toLocaleString("en-US")}`;
  return "Aapka hisaab clear hai";
}
export function buildMessage(
  type: MessageType,
  ctx: { customerName: string; date?: string; items?: { name: string; qty: number }[]; deliveryFee?: number; total?: number; amount?: number; balance?: number; businessName: string; templates: Settings["templates"] },
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
