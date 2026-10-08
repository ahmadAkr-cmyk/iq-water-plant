import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, type DB } from "./database";
import { registerHandlers } from "./handlers";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

let db: DB;
let dbPath: string;
let tempDir: string;

const handlers = new Map<string, (e: any, payload: any) => Promise<{ ok: boolean; data?: any; error?: string }>>();

const mockIpcMain = {
  handle: (channel: string, fn: any) => {
    handlers.set(channel, fn);
  },
} as any;
const mockApp = {
  getPath: (p: string) => tempDir,
} as any;
const mockShell = {} as any;
const mockDialog = {} as any;

function invoke(channel: string, payload?: any) {
  const fn = handlers.get(channel);
  if (!fn) throw new Error("No handler for " + channel);
  return fn({}, payload).then(r => {
    if (!r.ok) throw new Error(r.error);
    return r.data;
  });
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iqw-test-"));
  dbPath = path.join(tempDir, "billing.db");
  db = initDatabase(tempDir);
  handlers.clear();
  registerHandlers(mockIpcMain, () => db, mockApp, mockShell, mockDialog);
});

afterEach(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Backend Handlers", () => {
  it("uses string ids for customer and returns string ids", async () => {
    const cust = await invoke("createCustomer", { name: "Test String ID" });
    expect(typeof cust.id).toBe("string");
    
    const fetched = await invoke("getCustomer", { id: cust.id });
    expect(fetched.id).toBe(cust.id);
  });

  it("forces paymentType to cash when there is no customer", async () => {
    const prods = await invoke("listProducts");
    const sale = await invoke("createSale", {
      customerId: null,
      items: [{ productId: prods[0].id, qty: 1, unitPrice: 70 }],
      paymentType: "udhar" // Should be forced to cash internally
    });
    
    expect(sale.paymentType).toBe("cash");
    expect(sale.customerName).toBe("Walk-in");
  });

  it("calculates udhar and advance balances correctly", async () => {
    const cust = await invoke("createCustomer", { name: "Balance Test" });
    // Advance payment
    await invoke("addAdvance", { customerId: cust.id, amount: 500 }); // -500 balance
    
    let fetched = await invoke("getCustomer", { id: cust.id });
    expect(fetched.balance).toBe(-500); // Negative means advance
    
    // Udhar sale
    const prods = await invoke("listProducts");
    await invoke("createSale", {
      customerId: cust.id,
      items: [{ productId: prods[0].id, qty: 10, unitPrice: 70 }], // 700 total
      paymentType: "udhar"
    });
    
    fetched = await invoke("getCustomer", { id: cust.id });
    expect(fetched.balance).toBe(200); // -500 + 700 = +200 udhar
  });

  it("excludes cancelled sales from totals and reverses ledger", async () => {
    const cust = await invoke("createCustomer", { name: "Cancel Test" });
    const prods = await invoke("listProducts");
    const sale = await invoke("createSale", {
      customerId: cust.id,
      items: [{ productId: prods[0].id, qty: 2, unitPrice: 70 }], // 140
      paymentType: "udhar"
    });
    
    let fetched = await invoke("getCustomer", { id: cust.id });
    expect(fetched.balance).toBe(140);
    
    await invoke("cancelSale", { id: sale.id, reason: "Wrong entry" });
    
    fetched = await invoke("getCustomer", { id: cust.id });
    expect(fetched.balance).toBe(0); // Reversed
    
    const report = await invoke("getReport", {});
    expect(report.totalSale).toBe(0);
    expect(report.udharGiven).toBe(0);
    expect(report.cancelledCount).toBe(1);
  });

  it("generates sequential bill numbers", async () => {
    const prods = await invoke("listProducts");
    const sale1 = await invoke("createSale", {
      customerId: null,
      items: [{ productId: prods[0].id, qty: 1, unitPrice: 10 }],
      paymentType: "cash"
    });
    const sale2 = await invoke("createSale", {
      customerId: null,
      items: [{ productId: prods[0].id, qty: 1, unitPrice: 10 }],
      paymentType: "cash"
    });
    
    expect(sale1.billNo).toBe("IQW-0001");
    expect(sale2.billNo).toBe("IQW-0002");
  });

  it("groups by local-time (UTC+5) day", async () => {
    // PKT is UTC+5. So 19:00 UTC = 00:00 next day PKT.
    const cust = await invoke("createCustomer", { name: "Timezone Test" });
    const prods = await invoke("listProducts");
    
    const time1 = "2026-10-07T18:59:00.000Z"; // 23:59 PKT Oct 7
    const time2 = "2026-10-07T19:01:00.000Z"; // 00:01 PKT Oct 8
    
    await invoke("createSale", {
      customerId: cust.id,
      items: [{ productId: prods[0].id, qty: 1, unitPrice: 10 }],
      paymentType: "cash",
      createdAt: time1
    });
    
    await invoke("createSale", {
      customerId: cust.id,
      items: [{ productId: prods[0].id, qty: 2, unitPrice: 10 }],
      paymentType: "cash",
      createdAt: time2
    });
    
    const report = await invoke("getReport", {});
    // Expect two different days in report.daily
    expect(report.daily.length).toBe(2);
    // The days in PKT
    expect(report.daily[0].date).toBe("2026-10-06T19:00:00.000Z"); // PKT Oct 7 midnight in UTC
    expect(report.daily[0].total).toBe(10);
    
    expect(report.daily[1].date).toBe("2026-10-07T19:00:00.000Z"); // PKT Oct 8 midnight in UTC
    expect(report.daily[1].total).toBe(20);
  });
});
