/**
 * IPC handlers: every src/api.ts function implemented against SQLite.
 * Money = INTEGER rupees. Dates = ISO 8601 UTC text.
 * IDs returned/accepted as STRING ("1","2") to match the mock's shape.
 * Local time for grouping = UTC+5 (Pakistan Standard Time).
 */
import type { DB } from "./database";
import type { IpcMain, App, Shell, Dialog } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

// ─── Helpers ───────────────────────────────────────────────────────────────

// PKT = UTC+5, used for date grouping
const PKT_OFFSET_HOURS = 5;

function nowIso() {
  return new Date().toISOString();
}

function toStr(id: number | bigint | null | undefined): string | null {
  return id == null ? null : String(id);
}

function parseId(id: string): number {
  const n = parseInt(id, 10);
  if (isNaN(n) || n <= 0) throw new Error("Invalid id: " + id);
  return n;
}

// SQLite date() with localtime offset for Pakistan (UTC+5)
// We compute boundaries in JS and pass ISO strings.
function pktDayBoundary(date: Date): { start: string; end: string } {
  const offsetMs = PKT_OFFSET_HOURS * 60 * 60 * 1000;
  // Start of day in PKT
  const pktDate = new Date(date.getTime() + offsetMs);
  const y = pktDate.getUTCFullYear();
  const m = pktDate.getUTCMonth();
  const d = pktDate.getUTCDate();
  const startPkt = new Date(Date.UTC(y, m, d) - offsetMs);
  const endPkt = new Date(startPkt.getTime() + 86400000);
  return { start: startPkt.toISOString(), end: endPkt.toISOString() };
}

function todayPkt(): { start: string; end: string } {
  return pktDayBoundary(new Date());
}

// ─── Row → API shape converters ────────────────────────────────────────────

interface CustomerRow {
  id: number; name: string; phone: string; address: string;
  type: string; cycle: string | null; credit_limit: number | null;
  usually_delivery: number; notes: string; active: number; created_at: string;
}
interface ProductRow {
  id: number; name: string; size_label: string; price: number;
  active: number; is_default: number; sort_order: number;
}
interface SaleRow {
  id: number; bill_no: string; customer_id: number | null;
  customer_name: string; subtotal: number; delivery_fee: number; total: number;
  payment_type: string; status: string; cancel_reason: string | null;
  note: string; created_at: string;
}
interface SaleItemRow {
  id: number; sale_id: number; product_id: number | null;
  name: string; qty: number; unit_price: number; line_total: number;
}
interface KhataRow {
  id: number; customer_id: number; kind: string; sale_id: number | null;
  amount: number; method: string | null; note: string; created_at: string;
}

function mapCustomer(row: CustomerRow, balance: number, lastActivityAt: string | null) {
  return {
    id: toStr(row.id)!,
    name: row.name, phone: row.phone, address: row.address,
    type: row.type, cycle: row.cycle,
    creditLimit: row.credit_limit,
    usuallyDelivery: !!row.usually_delivery,
    notes: row.notes, active: !!row.active,
    createdAt: row.created_at,
    balance,
    lastActivityAt,
  };
}

function mapProduct(row: ProductRow) {
  return {
    id: toStr(row.id)!,
    name: row.name, sizeLabel: row.size_label, price: row.price,
    active: !!row.active, isDefault: !!row.is_default,
    sortOrder: row.sort_order,
  };
}

function mapSale(row: SaleRow, items: SaleItemRow[]) {
  return {
    id: toStr(row.id)!,
    billNo: row.bill_no,
    customerId: toStr(row.customer_id),
    customerName: row.customer_name,
    items: items.map((i) => ({
      productId: toStr(i.product_id),
      name: i.name, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total,
    })),
    subtotal: row.subtotal, deliveryFee: row.delivery_fee, total: row.total,
    paymentType: row.payment_type, status: row.status,
    cancelReason: row.cancel_reason, note: row.note, createdAt: row.created_at,
  };
}

function mapLedger(row: KhataRow, runningBalance: number) {
  return {
    id: toStr(row.id)!,
    customerId: toStr(row.customer_id)!,
    kind: row.kind,
    saleId: toStr(row.sale_id),
    amount: row.amount, method: row.method, note: row.note,
    createdAt: row.created_at, runningBalance,
  };
}

// ─── DB queries ────────────────────────────────────────────────────────────

function balanceOf(db: DB, customerId: number): number {
  const row = db.prepare("SELECT COALESCE(SUM(amount),0) as bal FROM khata_entries WHERE customer_id=?").get(customerId) as { bal: number };
  return row.bal;
}

function lastActivityOf(db: DB, customerId: number): string | null {
  const ledger = db.prepare("SELECT created_at FROM khata_entries WHERE customer_id=? ORDER BY created_at DESC LIMIT 1").get(customerId) as { created_at: string } | undefined;
  const sales = db.prepare("SELECT created_at FROM sales WHERE customer_id=? ORDER BY created_at DESC LIMIT 1").get(customerId) as { created_at: string } | undefined;
  const dates = [ledger?.created_at, sales?.created_at].filter(Boolean) as string[];
  return dates.sort().at(-1) ?? null;
}

function getSaleItems(db: DB, saleId: number): SaleItemRow[] {
  return db.prepare("SELECT * FROM sale_items WHERE sale_id=?").all(saleId) as SaleItemRow[];
}

function getSettingsObj(db: DB) {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const obj: Record<string, unknown> = {};
  for (const r of rows) {
    try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
  }
  return {
    businessName:    String(obj["businessName"] ?? "IQ Waterland"),
    phone:           String(obj["phone"] ?? ""),
    address:         String(obj["address"] ?? ""),
    deliveryFee:     Number(obj["deliveryFee"] ?? 30),
    defaultProductId: toStr(Number(obj["defaultProductId"] ?? 0)) ?? "",
    autoOpenWhatsApp: Boolean(obj["autoOpenWhatsApp"] ?? false),
    fontScale:       Number(obj["fontScale"] ?? 100),
    templates:       (obj["templates"] as Record<string,string>) ?? {},
    lastBackupAt:    (obj["lastBackupAt"] as string | null) ?? null,
  };
}

function setSetting(db: DB, key: string, value: unknown) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

// Default product ID (is_default = 1)
function defaultProductId(db: DB): number | null {
  const row = db.prepare("SELECT id FROM products WHERE is_default=1 AND active=1 LIMIT 1").get() as { id: number } | undefined;
  return row?.id ?? null;
}

// Next bill number
function nextBillNo(db: DB): string {
  const row = db.prepare("SELECT value FROM settings WHERE key='billCounter'").get() as { value: string } | undefined;
  const next = (parseInt(row?.value ?? "0", 10) || 0) + 1;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('billCounter', ?)").run(String(next));
  return "IQW-" + String(next).padStart(4, "0");
}

// ─── Register all handlers ─────────────────────────────────────────────────

export function registerHandlers(
  ipcMain: IpcMain,
  getDb: () => DB,
  app: App,
  shell: Shell,
  dialog: Dialog,
) {
  function handle(channel: string, fn: (payload: unknown) => unknown) {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, data: await fn(payload) };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
  }

  // ── Customers ────────────────────────────────────────────────────────────
  handle("listCustomers", (p: any) => {
    const db = getDb();
    let sql = "SELECT * FROM customers WHERE 1=1";
    const args: unknown[] = [];
    if (!p?.includeInactive) { sql += " AND active=1"; }
    if (p?.type && p.type !== "all") { sql += " AND type=?"; args.push(p.type); }
    if (p?.cycle && p.cycle !== "all") { sql += " AND cycle=?"; args.push(p.cycle); }
    const rows = db.prepare(sql).all(...args) as CustomerRow[];
    let result = rows.map((r) => mapCustomer(r, balanceOf(db, r.id), lastActivityOf(db, r.id)));
    if (p?.search) {
      const q = String(p.search).trim().toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return result;
  });

  handle("searchCustomers", (p: any) => {
    const db = getDb();
    const q = String(p?.query ?? "").trim();
    if (!q) return [];
    const likeQ = `%${q}%`;
    const rows = db.prepare(
      "SELECT * FROM customers WHERE active=1 AND (name LIKE ? OR phone LIKE ?) LIMIT ?"
    ).all(likeQ, likeQ, p?.limit ?? 8) as CustomerRow[];
    return rows.map((r) => mapCustomer(r, balanceOf(db, r.id), lastActivityOf(db, r.id)));
  });

  handle("getCustomer", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    const row = db.prepare("SELECT * FROM customers WHERE id=?").get(id) as CustomerRow | undefined;
    if (!row) throw new Error("Member nahi mila: id=" + id);
    return mapCustomer(row, balanceOf(db, id), lastActivityOf(db, id));
  });

  handle("createCustomer", (p: any) => {
    const db = getDb();
    if (!p?.name?.trim()) throw new Error("Name zaroori hai");
    const type = p.type ?? "cash";
    if (!["cash", "udhar", "advance"].includes(type)) throw new Error("Invalid type");
    const now = nowIso();

    const result = db.prepare(
      `INSERT INTO customers (name, phone, address, type, cycle, credit_limit, usually_delivery, notes, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      p.name.trim(), p.phone ?? "", p.address ?? "", type,
      p.cycle ?? null, p.creditLimit ?? null,
      p.usuallyDelivery ? 1 : 0, p.notes ?? "", now
    );
    const customerId = Number(result.lastInsertRowid);

    // Opening balance
    if (p.openingBalance?.amount > 0) {
      const amount = p.openingBalance.kind === "udhar" ? p.openingBalance.amount : -p.openingBalance.amount;
      db.prepare(
        "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'opening', NULL, ?, NULL, ?, ?)"
      ).run(customerId, amount, "Pehle ka hisaab", now);
    }
    if (p.advanceAmount > 0) {
      db.prepare(
        "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'advance', NULL, ?, 'Cash', ?, ?)"
      ).run(customerId, -Math.abs(p.advanceAmount), "", now);
    }

    const row = db.prepare("SELECT * FROM customers WHERE id=?").get(customerId) as CustomerRow;
    return mapCustomer(row, balanceOf(db, customerId), lastActivityOf(db, customerId));
  });

  handle("updateCustomer", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    const existing = db.prepare("SELECT * FROM customers WHERE id=?").get(id) as CustomerRow | undefined;
    if (!existing) throw new Error("Member nahi mila: id=" + id);
    if (p?.name !== undefined && !String(p.name).trim()) throw new Error("Name zaroori hai");

    const fields: string[] = [];
    const args: unknown[] = [];
    if (p?.name !== undefined) { fields.push("name=?"); args.push(String(p.name).trim()); }
    if (p?.phone !== undefined) { fields.push("phone=?"); args.push(p.phone); }
    if (p?.address !== undefined) { fields.push("address=?"); args.push(p.address); }
    if (p?.type !== undefined) { fields.push("type=?"); args.push(p.type); }
    if (p?.cycle !== undefined) { fields.push("cycle=?"); args.push(p.cycle ?? null); }
    if (p?.creditLimit !== undefined) { fields.push("credit_limit=?"); args.push(p.creditLimit ?? null); }
    if (p?.usuallyDelivery !== undefined) { fields.push("usually_delivery=?"); args.push(p.usuallyDelivery ? 1 : 0); }
    if (p?.notes !== undefined) { fields.push("notes=?"); args.push(p.notes); }
    if (p?.active !== undefined) { fields.push("active=?"); args.push(p.active ? 1 : 0); }
    if (fields.length > 0) {
      args.push(id);
      db.prepare(`UPDATE customers SET ${fields.join(",")} WHERE id=?`).run(...args);
    }

    const row = db.prepare("SELECT * FROM customers WHERE id=?").get(id) as CustomerRow;
    return mapCustomer(row, balanceOf(db, id), lastActivityOf(db, id));
  });

  handle("setCustomerActive", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    db.prepare("UPDATE customers SET active=? WHERE id=?").run(p?.active ? 1 : 0, id);
    const row = db.prepare("SELECT * FROM customers WHERE id=?").get(id) as CustomerRow;
    return mapCustomer(row, balanceOf(db, id), lastActivityOf(db, id));
  });

  // ── Products ─────────────────────────────────────────────────────────────
  handle("listProducts", (p: any) => {
    const db = getDb();
    let sql = "SELECT * FROM products";
    if (!p?.includeInactive) sql += " WHERE active=1";
    sql += " ORDER BY is_default DESC, sort_order ASC";
    const rows = db.prepare(sql).all() as ProductRow[];
    return rows.map(mapProduct);
  });

  handle("createProduct", (p: any) => {
    const db = getDb();
    if (!p?.name?.trim()) throw new Error("Product name zaroori hai");
    if (p?.price < 0) throw new Error("Price negative nahi ho sakta");
    const result = db.prepare(
      "INSERT INTO products (name, size_label, price, active, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(p.name.trim(), p.sizeLabel ?? "", Math.round(p.price ?? 0), 1, p.isDefault ? 1 : 0, p.sortOrder ?? 99);
    const row = db.prepare("SELECT * FROM products WHERE id=?").get(Number(result.lastInsertRowid)) as ProductRow;
    return mapProduct(row);
  });

  handle("updateProduct", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    const existing = db.prepare("SELECT * FROM products WHERE id=?").get(id) as ProductRow | undefined;
    if (!existing) throw new Error("Product nahi mila: id=" + id);

    const fields: string[] = [];
    const args: unknown[] = [];
    if (p?.name !== undefined) { fields.push("name=?"); args.push(String(p.name).trim()); }
    if (p?.sizeLabel !== undefined) { fields.push("size_label=?"); args.push(p.sizeLabel); }
    if (p?.price !== undefined) { fields.push("price=?"); args.push(Math.round(p.price)); }
    if (p?.active !== undefined) { fields.push("active=?"); args.push(p.active ? 1 : 0); }
    if (p?.isDefault !== undefined) { fields.push("is_default=?"); args.push(p.isDefault ? 1 : 0); }
    if (p?.sortOrder !== undefined) { fields.push("sort_order=?"); args.push(p.sortOrder); }
    if (fields.length > 0) {
      args.push(id);
      db.prepare(`UPDATE products SET ${fields.join(",")} WHERE id=?`).run(...args);
    }
    const row = db.prepare("SELECT * FROM products WHERE id=?").get(id) as ProductRow;
    return mapProduct(row);
  });

  // ── Sales ────────────────────────────────────────────────────────────────
  handle("createSale", (p: any) => {
    const db = getDb();
    const customerId: number | null = p?.customerId ? parseId(String(p.customerId)) : null;

    // Resolve customer
    let customerRow: CustomerRow | null = null;
    if (customerId) {
      customerRow = db.prepare("SELECT * FROM customers WHERE id=? AND active=1").get(customerId) as CustomerRow | null;
      if (!customerRow) throw new Error("Customer nahi mila ya inactive hai");
    }

    // Validate and build items
    const inputItems: { productId: string; qty: number; unitPrice: number }[] = p?.items ?? [];
    const validItems = inputItems.filter((i) => i.qty >= 1);
    if (!validItems.length) throw new Error("Kam az kam ek bottle chahiye");

    let subtotal = 0;
    const resolvedItems: { productId: number | null; name: string; qty: number; unitPrice: number; lineTotal: number }[] = [];
    for (const item of validItems) {
      if (item.qty < 1) throw new Error("Qty 0 se zyada honi chahiye");
      if (item.unitPrice < 0) throw new Error("Price negative nahi ho sakta");
      const productId = parseId(String(item.productId));
      const prod = db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(productId) as ProductRow | undefined;
      if (!prod) throw new Error(`Product ${item.productId} nahi mila ya inactive hai`);
      const lineTotal = Math.round(item.qty) * Math.round(item.unitPrice);
      subtotal += lineTotal;
      resolvedItems.push({ productId, name: prod.name, qty: Math.round(item.qty), unitPrice: Math.round(item.unitPrice), lineTotal });
    }

    const deliveryFee = Math.round(p?.deliveryFee ?? 0);
    if (deliveryFee < 0) throw new Error("Delivery fee negative nahi ho sakti");
    const total = subtotal + deliveryFee;

    // Payment type: force cash for walk-in
    const paymentType = customerId && customerRow ? p?.paymentType ?? "cash" : "cash";
    if (!["cash", "udhar", "advance"].includes(paymentType)) throw new Error("Invalid payment type");

    const createdAt = p?.createdAt ?? nowIso();
    const note = p?.note ?? "";

    const saleId = db.transaction(() => {
      const billNo = nextBillNo(db);
      const saleResult = db.prepare(
        `INSERT INTO sales (bill_no, customer_id, customer_name, subtotal, delivery_fee, total, payment_type, status, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).run(billNo, customerId, customerRow?.name ?? "Walk-in", subtotal, deliveryFee, total, paymentType, note, createdAt);
      const saleId = Number(saleResult.lastInsertRowid);

      for (const item of resolvedItems) {
        db.prepare(
          "INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(saleId, item.productId, item.name, item.qty, item.unitPrice, item.lineTotal);
      }

      // Ledger entry for udhar/advance
      if (customerId && paymentType !== "cash") {
        db.prepare(
          "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'sale', ?, ?, NULL, ?, ?)"
        ).run(customerId, saleId, total, note, createdAt);
      }

      return saleId;
    })();

    const saleRow = db.prepare("SELECT * FROM sales WHERE id=?").get(saleId) as SaleRow;
    return mapSale(saleRow, getSaleItems(db, saleId));
  });

  handle("listSales", (p: any) => {
    const db = getDb();
    let sql = "SELECT * FROM sales WHERE 1=1";
    const args: unknown[] = [];
    if (p?.from) { sql += " AND created_at >= ?"; args.push(p.from); }
    if (p?.to) { sql += " AND created_at <= ?"; args.push(p.to); }
    if (p?.customerId) { sql += " AND customer_id = ?"; args.push(parseId(String(p.customerId))); }
    if (p?.paymentType && p.paymentType !== "all") { sql += " AND payment_type = ?"; args.push(p.paymentType); }
    if (p?.status && p.status !== "all") { sql += " AND status = ?"; args.push(p.status); }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...args) as SaleRow[];
    return rows.map((r) => mapSale(r, getSaleItems(db, r.id)));
  });

  handle("getSale", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    const row = db.prepare("SELECT * FROM sales WHERE id=?").get(id) as SaleRow | undefined;
    if (!row) throw new Error("Sale nahi mili: id=" + id);
    return mapSale(row, getSaleItems(db, id));
  });

  handle("cancelSale", (p: any) => {
    const db = getDb();
    const id = parseId(String(p?.id));
    const reason = String(p?.reason ?? "");

    return db.transaction(() => {
      const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(id) as SaleRow | undefined;
      if (!sale) throw new Error("Sale nahi mili: id=" + id);
      if (sale.status === "cancelled") return mapSale(sale, getSaleItems(db, id));

      db.prepare("UPDATE sales SET status='cancelled', cancel_reason=? WHERE id=?").run(reason, id);

      // Reversal entry only if a ledger entry exists for this sale
      const hasEntry = db.prepare("SELECT id FROM khata_entries WHERE sale_id=? AND kind='sale'").get(id);
      if (hasEntry && sale.customer_id) {
        db.prepare(
          "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'cancel_reversal', ?, ?, NULL, ?, ?)"
        ).run(sale.customer_id, id, -sale.total, reason, nowIso());
      }

      const updated = db.prepare("SELECT * FROM sales WHERE id=?").get(id) as SaleRow;
      return mapSale(updated, getSaleItems(db, id));
    })();
  });

  // ── Ledger ───────────────────────────────────────────────────────────────
  handle("getLedger", (p: any) => {
    const db = getDb();
    const customerId = parseId(String(p?.customerId));
    const all = db.prepare(
      "SELECT * FROM khata_entries WHERE customer_id=? ORDER BY created_at ASC"
    ).all(customerId) as KhataRow[];

    // Compute running balance
    let running = 0;
    const withRun = all.map((r) => {
      running += r.amount;
      return { ...r, runningBalance: running };
    });

    // Filter by date range
    const filtered = withRun.filter((r) => {
      if (p?.from && r.created_at < p.from) return false;
      if (p?.to && r.created_at > p.to) return false;
      return true;
    });

    return filtered.reverse().map((r) => mapLedger(r, r.runningBalance));
  });

  handle("addPayment", (p: any) => {
    const db = getDb();
    const customerId = parseId(String(p?.customerId));
    if (!p?.amount || p.amount <= 0) throw new Error("Amount positive hona chahiye");
    const amount = -Math.abs(Math.round(p.amount));
    const createdAt = p?.createdAt ?? nowIso();
    const result = db.prepare(
      "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'payment', NULL, ?, ?, ?, ?)"
    ).run(customerId, amount, p?.method ?? "Cash", p?.note ?? "", createdAt);
    const row = db.prepare("SELECT * FROM khata_entries WHERE id=?").get(Number(result.lastInsertRowid)) as KhataRow;
    return mapLedger(row, balanceOf(db, customerId));
  });

  handle("addAdvance", (p: any) => {
    const db = getDb();
    const customerId = parseId(String(p?.customerId));
    if (!p?.amount || p.amount <= 0) throw new Error("Amount positive hona chahiye");
    const amount = -Math.abs(Math.round(p.amount));
    const createdAt = p?.createdAt ?? nowIso();
    const result = db.prepare(
      "INSERT INTO khata_entries (customer_id, kind, sale_id, amount, method, note, created_at) VALUES (?, 'advance', NULL, ?, ?, ?, ?)"
    ).run(customerId, amount, p?.method ?? "Cash", p?.note ?? "", createdAt);
    const row = db.prepare("SELECT * FROM khata_entries WHERE id=?").get(Number(result.lastInsertRowid)) as KhataRow;
    return mapLedger(row, balanceOf(db, customerId));
  });

  // ── Dashboard ────────────────────────────────────────────────────────────
  handle("getDashboard", (_p: any) => {
    const db = getDb();
    const { start: todayStart, end: todayEnd } = todayPkt();

    // Today's active sales (PKT local time)
    const todaySalesRows = db.prepare(
      "SELECT * FROM sales WHERE status='active' AND created_at >= ? AND created_at < ?"
    ).all(todayStart, todayEnd) as SaleRow[];
    const todaySales = todaySalesRows.reduce((a, b) => a + b.total, 0);

    // Today bottles + 19L count (default product)
    const todayItems = todaySalesRows.flatMap((s) => getSaleItems(db, s.id));
    const todayBottles = todayItems.reduce((a, i) => a + i.qty, 0);
    const defProductId = defaultProductId(db);
    const today19L = defProductId
      ? todayItems.filter((i) => i.product_id === defProductId).reduce((a, i) => a + i.qty, 0)
      : 0;
    const todayDeliveries = todaySalesRows.filter((s) => s.delivery_fee > 0).length;

    // Balances
    const customerRows = db.prepare("SELECT id FROM customers WHERE active=1").all() as { id: number }[];
    let totalUdhar = 0, totalAdvance = 0;
    for (const c of customerRows) {
      const b = balanceOf(db, c.id);
      if (b > 0) totalUdhar += b;
      else if (b < 0) totalAdvance += -b;
    }

    // Last 7 days bar chart (PKT)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const { start, end } = pktDayBoundary(d);
      const dayTotal = (db.prepare(
        "SELECT COALESCE(SUM(total),0) as t FROM sales WHERE status='active' AND created_at >= ? AND created_at < ?"
      ).get(start, end) as { t: number }).t;
      return { date: start, total: dayTotal };
    });

    // Recent sales
    const recentRows = db.prepare("SELECT * FROM sales ORDER BY created_at DESC LIMIT 8").all() as SaleRow[];
    const recentSales = recentRows.map((r) => mapSale(r, getSaleItems(db, r.id)));

    // Top udhar customers
    const allCusts = db.prepare("SELECT * FROM customers WHERE active=1").all() as CustomerRow[];
    const withBal = allCusts.map((c) => ({ c, b: balanceOf(db, c.id) }));
    const topUdhar = withBal
      .filter((x) => x.b > 0)
      .sort((a, b) => b.b - a.b)
      .slice(0, 5)
      .map((x) => mapCustomer(x.c, x.b, lastActivityOf(db, x.c.id)));

    return { todaySales, todayBottles, today19L, todayDeliveries, totalUdhar, totalAdvance, last7Days, recentSales, topUdhar };
  });

  // ── Reports ──────────────────────────────────────────────────────────────
  handle("getReport", (p: any) => {
    const db = getDb();
    let sql = "SELECT * FROM sales WHERE 1=1";
    const args: unknown[] = [];
    if (p?.from) { sql += " AND created_at >= ?"; args.push(p.from); }
    if (p?.to) { sql += " AND created_at <= ?"; args.push(p.to); }
    const allSales = db.prepare(sql).all(...args) as SaleRow[];
    const active = allSales.filter((s) => s.status === "active");

    let ledgerSql = "SELECT * FROM khata_entries WHERE 1=1";
    const ledgerArgs: unknown[] = [];
    if (p?.from) { ledgerSql += " AND created_at >= ?"; ledgerArgs.push(p.from); }
    if (p?.to) { ledgerSql += " AND created_at <= ?"; ledgerArgs.push(p.to); }
    const ledger = db.prepare(ledgerSql).all(...ledgerArgs) as KhataRow[];

    const cashSales = active.filter((s) => s.payment_type === "cash").reduce((a, b) => a + b.total, 0);
    const paymentsCollected = ledger.filter((l) => l.kind === "payment").reduce((a, l) => a + (-l.amount), 0);
    const advanceReceived = ledger.filter((l) => l.kind === "advance").reduce((a, l) => a + (-l.amount), 0);

    // By size (product name)
    const bySizeMap = new Map<string, { size: string; qty: number; amount: number }>();
    for (const s of active) {
      const items = getSaleItems(db, s.id);
      for (const i of items) {
        const r = bySizeMap.get(i.name) ?? { size: i.name, qty: 0, amount: 0 };
        r.qty += i.qty; r.amount += i.line_total;
        bySizeMap.set(i.name, r);
      }
    }

    // Daily grouping (PKT)
    const dayMap = new Map<string, number>();
    for (const s of active) {
      const { start } = pktDayBoundary(new Date(s.created_at));
      dayMap.set(start, (dayMap.get(start) ?? 0) + s.total);
    }

    return {
      totalSale: active.reduce((a, b) => a + b.total, 0),
      cashReceived: cashSales,
      udharGiven: active.filter((s) => s.payment_type === "udhar").reduce((a, b) => a + b.total, 0),
      paymentsCollected,
      advanceReceived,
      cancelledCount: allSales.filter((s) => s.status === "cancelled").length,
      deliveries: active.filter((s) => s.delivery_fee > 0).length,
      bySize: [...bySizeMap.values()].sort((a, b) => b.amount - a.amount),
      daily: [...dayMap.entries()].sort().map(([date, total]) => ({ date, total })),
      cashInHand: cashSales + paymentsCollected,
    };
  });

  handle("getReceivables", (_p: any) => {
    const db = getDb();
    const allCusts = db.prepare("SELECT * FROM customers").all() as CustomerRow[];
    const rows = allCusts
      .map((c) => ({ customer: mapCustomer(c, balanceOf(db, c.id), lastActivityOf(db, c.id)), balance: balanceOf(db, c.id) }))
      .filter((x) => x.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    return { rows, total: rows.reduce((a, b) => a + b.balance, 0) };
  });

  // ── Settings ─────────────────────────────────────────────────────────────
  handle("getSettings", (_p: any) => {
    return getSettingsObj(getDb());
  });

  handle("saveSettings", (p: any) => {
    const db = getDb();
    const allowed = ["businessName","phone","address","deliveryFee","defaultProductId","autoOpenWhatsApp","fontScale","templates","lastBackupAt","backupFolder"];
    for (const key of allowed) {
      if (p?.[key] !== undefined) setSetting(db, key, p[key]);
    }
    return getSettingsObj(db);
  });

  handle("createBackup", async (_p: any) => {
    const db = getDb();
    const { createBackupFile } = require("./database");
    const destPath = await createBackupFile(db, app.getPath("userData"));
    const at = new Date().toISOString();
    setSetting(db, "lastBackupAt", at);
    return { ok: true, at };
  });

  // ── Export Report ────────────────────────────────────────────────────────
  handle("exportReport", async (p: any) => {
    const db = getDb();
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "IQ Waterland";

    // Get report data
    let sqlActive = "SELECT * FROM sales WHERE status='active'";
    const args: unknown[] = [];
    if (p?.from) { sqlActive += " AND created_at >= ?"; args.push(p.from); }
    if (p?.to)   { sqlActive += " AND created_at <= ?"; args.push(p.to); }
    const active = db.prepare(sqlActive).all(...args) as SaleRow[];

    // Sheet 1: Summary
    const ws1 = wb.addWorksheet("Summary");
    ws1.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
    ];
    ws1.addRow({ metric: "Total Sales", value: active.reduce((a, b) => a + b.total, 0) });
    ws1.addRow({ metric: "Cash Sales", value: active.filter((s) => s.payment_type === "cash").reduce((a, b) => a + b.total, 0) });
    ws1.addRow({ metric: "Udhar Sales", value: active.filter((s) => s.payment_type === "udhar").reduce((a, b) => a + b.total, 0) });
    ws1.addRow({ metric: "Deliveries", value: active.filter((s) => s.delivery_fee > 0).length });

    // Sheet 2: Bottles by size
    const ws2 = wb.addWorksheet("Bottles by Size");
    ws2.columns = [
      { header: "Size", key: "size", width: 15 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Amount (Rs)", key: "amount", width: 15 },
    ];
    const bySizeMap = new Map<string, { size: string; qty: number; amount: number }>();
    for (const s of active) {
      const items = getSaleItems(db, s.id);
      for (const i of items) {
        const r = bySizeMap.get(i.name) ?? { size: i.name, qty: 0, amount: 0 };
        r.qty += i.qty; r.amount += i.line_total; bySizeMap.set(i.name, r);
      }
    }
    for (const row of [...bySizeMap.values()].sort((a, b) => b.amount - a.amount)) {
      ws2.addRow(row);
    }

    // Sheet 3: Receivables
    const ws3 = wb.addWorksheet("Receivables");
    ws3.columns = [
      { header: "Customer", key: "name", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Balance (Rs)", key: "balance", width: 15 },
    ];
    const allCusts = db.prepare("SELECT * FROM customers WHERE active=1").all() as CustomerRow[];
    for (const c of allCusts) {
      const b = balanceOf(db, c.id);
      if (b > 0) ws3.addRow({ name: c.name, phone: c.phone, balance: b });
    }

    // Save with dialog
    const { filePath } = await dialog.showSaveDialog({
      title: "Report save karein",
      defaultPath: `IQ-Waterland-Report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (filePath) {
      await wb.xlsx.writeFile(filePath);
      return { ok: true, path: filePath };
    }
    return { ok: false };
  });

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  handle("openWhatsApp", async (p: any) => {
    const url = String(p?.url ?? "");
    if (!url.startsWith("https://wa.me/")) throw new Error("Invalid WhatsApp URL");
    await shell.openExternal(url);
    return { ok: true };
  });

  // ── Backup folder picker ─────────────────────────────────────────────────
  handle("pickBackupFolder", async (_p: any) => {
    const { filePaths } = await dialog.showOpenDialog({
      title: "Extra backup folder chunein",
      properties: ["openDirectory"],
    });
    if (filePaths[0]) {
      setSetting(getDb(), "backupFolder", filePaths[0]);
      return { ok: true, path: filePaths[0] };
    }
    return { ok: false };
  });
}
