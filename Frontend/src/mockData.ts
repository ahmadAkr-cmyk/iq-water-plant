// DEMO ONLY - seed data. Real storage will be SQLite. Never import this from UI code; use src/api.ts.
export type CustomerType = "cash" | "udhar" | "advance";
export type Cycle = "daily" | "weekly" | "monthly" | null;
export type PaymentType = "cash" | "udhar" | "advance";

export interface CustomerRow {
  id: string; name: string; phone: string; address: string; type: CustomerType; cycle: Cycle;
  creditLimit: number | null; usuallyDelivery: boolean; notes: string; active: boolean; createdAt: string;
}
export interface Product { id: string; name: string; sizeLabel: string; price: number; active: boolean; isDefault: boolean }
export interface SaleItem { productId: string; name: string; qty: number; unitPrice: number; lineTotal: number }
export interface Sale {
  id: string; billNo: string; customerId: string | null; customerName: string; items: SaleItem[];
  subtotal: number; deliveryFee: number; total: number; paymentType: PaymentType;
  status: "active" | "cancelled"; cancelReason: string | null; note: string; createdAt: string;
}
export type LedgerKind = "sale" | "payment" | "advance" | "opening" | "cancel_reversal";
export interface LedgerRow {
  id: string; customerId: string; kind: LedgerKind; saleId: string | null; amount: number;
  method: string | null; note: string; createdAt: string;
}
export interface Settings {
  businessName: string; phone: string; address: string; deliveryFee: number; defaultProductId: string;
  autoOpenWhatsApp: boolean; fontScale: number;
  templates: { sale: string; payment: string; reminder: string; advance: string };
  lastBackupAt: string | null;
}

export const defaultTemplates = {
  sale: "Assalam o Alaikum {customer_name},\n{date}: {items}{delivery_line}\nBill: Rs {total}\n{balance_line}\nShukriya - {business_name}",
  payment: "Assalam o Alaikum {customer_name}, {date} ko Rs {amount} wasool hue.\n{balance_line}\nShukriya - {business_name}",
  reminder: "Assalam o Alaikum {customer_name}, aapka Rs {balance} udhar baqi hai.\nMehrbani karke jald ada farmayen. Shukriya - {business_name}",
  advance: "Assalam o Alaikum {customer_name}, {date} ko Rs {amount} advance jama hua.\nAapka advance balance: Rs {balance}. Shukriya - {business_name}",
};

export function buildSeed() {
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const now = Date.now();
  const daysAgo = (d: number, h = 10, m = 0) => {
    const x = new Date(now - d * 864e5);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };

  const c = (i: number, name: string, type: CustomerType, cycle: Cycle, extra: Partial<CustomerRow> = {}): CustomerRow => ({
    id: "c" + i, name, phone: "030012345" + String(i).padStart(2, "0"), address: "", type, cycle,
    creditLimit: null, usuallyDelivery: false, notes: "", active: true, createdAt: daysAgo(30), ...extra,
  });
  const customers: CustomerRow[] = [
    c(1, "Haji Rashid", "udhar", "monthly", { address: "Gulshan Block 4", creditLimit: 3000, usuallyDelivery: true }),
    c(2, "Bilal Ahmed", "cash", null),
    c(3, "Shafiq Medical Store", "udhar", "weekly", { address: "Main Bazar", usuallyDelivery: true }),
    c(4, "Madina Hotel", "advance", "monthly", { address: "GT Road", usuallyDelivery: true }),
    c(5, "Imran Khan", "cash", null),
    c(6, "Ayesha Bibi", "udhar", "daily", { address: "Street 7", creditLimit: 1000 }),
    c(7, "Noor Muhammad", "advance", "weekly"),
    c(8, "Usman Traders", "udhar", "monthly", { address: "Anarkali", usuallyDelivery: true }),
    c(9, "Zubair Hussain", "advance", "monthly"),
    c(10, "Ali General Store", "cash", null, { address: "Chowk" }),
  ];

  const products: Product[] = [
    { id: "p1", name: "19 Litre", sizeLabel: "19L", price: 70, active: true, isDefault: true },
    { id: "p2", name: "10 Litre", sizeLabel: "10L", price: 40, active: true, isDefault: false },
    { id: "p3", name: "5 Litre", sizeLabel: "5L", price: 25, active: true, isDefault: false },
    { id: "p4", name: "1.5 Litre", sizeLabel: "1.5L", price: 10, active: true, isDefault: false },
  ];

  const ledger: LedgerRow[] = [];
  let lid = 1;
  const addL = (r: Omit<LedgerRow, "id">) => ledger.push({ id: "l" + lid++, ...r });

  // Opening balances and advance deposits
  addL({ customerId: "c1", kind: "opening", saleId: null, amount: 500, method: null, note: "Pehle ka hisaab", createdAt: daysAgo(15, 9) });
  addL({ customerId: "c4", kind: "advance", saleId: null, amount: -3000, method: "Cash", note: "Monthly advance", createdAt: daysAgo(14, 9) });
  addL({ customerId: "c9", kind: "advance", saleId: null, amount: -1500, method: "JazzCash", note: "", createdAt: daysAgo(13, 9) });
  addL({ customerId: "c7", kind: "opening", saleId: null, amount: -800, method: null, note: "Pehle ka advance", createdAt: daysAgo(15, 9) });

  const sales: Sale[] = [];
  for (let i = 0; i < 40; i++) {
    const d = 13 - Math.floor((i * 14) / 40);
    const cust = rnd() < 0.2 ? null : customers[Math.floor(rnd() * customers.length)];
    const items: SaleItem[] = [];
    if (rnd() < 0.8 || true) {
      const q = 1 + Math.floor(rnd() * 4);
      items.push({ productId: "p1", name: "19 Litre", qty: q, unitPrice: 70, lineTotal: q * 70 });
    }
    if (rnd() < 0.2) {
      const p = products[1 + Math.floor(rnd() * 3)]!;
      const q = 1 + Math.floor(rnd() * 3);
      items.push({ productId: p.id, name: p.name, qty: q, unitPrice: p.price, lineTotal: q * p.price });
    }
    const delivery = rnd() < 0.4 ? 30 : 0;
    const subtotal = items.reduce((s, x) => s + x.lineTotal, 0);
    const pt: PaymentType = !cust || cust.type === "cash" ? "cash" : cust.type;
    const sale: Sale = {
      id: "s" + (i + 1), billNo: "IQW-" + String(i + 1).padStart(4, "0"), customerId: cust?.id ?? null,
      customerName: cust?.name ?? "Walk-in", items, subtotal, deliveryFee: delivery, total: subtotal + delivery,
      paymentType: pt, status: "active", cancelReason: null, note: "",
      createdAt: daysAgo(d, 8 + Math.floor(rnd() * 11), Math.floor(rnd() * 60)),
    };
    sales.push(sale);
    if (pt !== "cash" && cust) addL({ customerId: cust.id, kind: "sale", saleId: sale.id, amount: sale.total, method: null, note: "", createdAt: sale.createdAt });
  }
  // One cancelled sale
  const cs = sales.find((s) => s.paymentType === "udhar")!;
  cs.status = "cancelled";
  cs.cancelReason = "Ghalat entry";
  addL({ customerId: cs.customerId!, kind: "cancel_reversal", saleId: cs.id, amount: -cs.total, method: null, note: "Ghalat entry", createdAt: cs.createdAt });

  // Payments
  addL({ customerId: "c3", kind: "payment", saleId: null, amount: -400, method: "Cash", note: "", createdAt: daysAgo(5, 17) });
  addL({ customerId: "c8", kind: "payment", saleId: null, amount: -300, method: "Easypaisa", note: "", createdAt: daysAgo(3, 12) });
  addL({ customerId: "c6", kind: "payment", saleId: null, amount: -200, method: "Cash", note: "", createdAt: daysAgo(1, 18) });

  const settings: Settings = {
    businessName: "IQ Waterland", phone: "03001234500", address: "", deliveryFee: 30, defaultProductId: "p1",
    autoOpenWhatsApp: false, fontScale: 100, templates: { ...defaultTemplates }, lastBackupAt: null,
  };
  return { customers, products, sales, ledger, settings };
}
