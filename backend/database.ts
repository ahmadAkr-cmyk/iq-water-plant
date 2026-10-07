import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";

export type DB = Database.Database;

const CURRENT_USER_VERSION = 1;

// ─── Default data ──────────────────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  { name: "19 Litre", sizeLabel: "19L", price: 70, isDefault: 1, sortOrder: 1 },
  { name: "10 Litre", sizeLabel: "10L", price: 40, isDefault: 0, sortOrder: 2 },
  { name: "5 Litre",  sizeLabel: "5L",  price: 25, isDefault: 0, sortOrder: 3 },
  { name: "1.5 Litre",sizeLabel: "1.5L",price: 10, isDefault: 0, sortOrder: 4 },
];

const DEFAULT_TEMPLATES = {
  sale:     "Assalam o Alaikum {customer_name},\n{date}: {items}{delivery_line}\nBill: Rs {total}\n{balance_line}\nShukriya - {business_name}",
  payment:  "Assalam o Alaikum {customer_name}, {date} ko Rs {amount} wasool hue.\n{balance_line}\nShukriya - {business_name}",
  reminder: "Assalam o Alaikum {customer_name}, aapka Rs {balance} udhar baqi hai.\nMehrbani karke jald ada farmayen. Shukriya - {business_name}",
  advance:  "Assalam o Alaikum {customer_name}, {date} ko Rs {amount} advance jama hua.\nAapka advance balance: Rs {balance}. Shukriya - {business_name}",
};

// ─── Schema migration v1 ───────────────────────────────────────────────────
function migrate_v1(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      phone         TEXT    NOT NULL DEFAULT '',
      address       TEXT    NOT NULL DEFAULT '',
      type          TEXT    NOT NULL CHECK(type IN ('cash','udhar','advance')),
      cycle         TEXT             CHECK(cycle IN ('daily','weekly','monthly')),
      credit_limit  INTEGER,
      usually_delivery INTEGER NOT NULL DEFAULT 0,
      notes         TEXT    NOT NULL DEFAULT '',
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      size_label TEXT    NOT NULL DEFAULT '',
      price      INTEGER NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no       TEXT    NOT NULL UNIQUE,
      customer_id   INTEGER REFERENCES customers(id),
      customer_name TEXT    NOT NULL,
      subtotal      INTEGER NOT NULL,
      delivery_fee  INTEGER NOT NULL DEFAULT 0,
      total         INTEGER NOT NULL,
      payment_type  TEXT    NOT NULL CHECK(payment_type IN ('cash','udhar','advance')),
      status        TEXT    NOT NULL CHECK(status IN ('active','cancelled')) DEFAULT 'active',
      cancel_reason TEXT,
      note          TEXT    NOT NULL DEFAULT '',
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id    INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      name       TEXT    NOT NULL,
      qty        INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS khata_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      kind        TEXT    NOT NULL CHECK(kind IN ('sale','payment','advance','opening','cancel_reversal')),
      sale_id     INTEGER REFERENCES sales(id),
      amount      INTEGER NOT NULL,
      method      TEXT,
      note        TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_sales_created_at   ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_id  ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_khata_cust_date    ON khata_entries(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_customers_name     ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_phone    ON customers(phone);
  `);
}

// ─── Seed default data on first run ───────────────────────────────────────
function seedDefaults(db: DB) {
  const productCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
  if (productCount === 0) {
    const insertProduct = db.prepare(
      "INSERT INTO products (name, size_label, price, active, is_default, sort_order) VALUES (?, ?, ?, 1, ?, ?)"
    );
    for (const p of DEFAULT_PRODUCTS) {
      insertProduct.run(p.name, p.sizeLabel, p.price, p.isDefault, p.sortOrder);
    }
  }

  // Default settings
  const upsert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  upsert.run("businessName",    "IQ Waterland");
  upsert.run("phone",           "");
  upsert.run("address",         "");
  upsert.run("deliveryFee",     "30");
  upsert.run("autoOpenWhatsApp","false");
  upsert.run("fontScale",       "100");
  upsert.run("templates",       JSON.stringify(DEFAULT_TEMPLATES));
  upsert.run("lastBackupAt",    "null");
  upsert.run("billCounter",     "0");
  upsert.run("backupFolder",    "null");
}

// ─── Main init ─────────────────────────────────────────────────────────────
export function initDatabase(userDataPath: string): DB {
  const dbPath = path.join(userDataPath, "billing.db");
  const db = new Database(dbPath);

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const currentVersion = (db.pragma("user_version", { simple: true }) as number);

  if (currentVersion < 1) {
    db.transaction(() => {
      migrate_v1(db);
      db.pragma("user_version = 1");
    })();
  }
  // Future migrations: if (currentVersion < 2) { migrate_v2(db); db.pragma("user_version = 2"); }

  seedDefaults(db);
  return db;
}

// ─── Backup helpers ────────────────────────────────────────────────────────
export async function createBackupFile(db: DB, userDataPath: string): Promise<string> {
  const backupsDir = path.join(userDataPath, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const destPath = path.join(backupsDir, `billing-${today}.db`);

  await (db as any).backup(destPath);

  // Prune old backups — keep last 30
  const files = fs.readdirSync(backupsDir)
    .filter((f) => f.startsWith("billing-") && f.endsWith(".db"))
    .sort();
  while (files.length > 30) {
    fs.unlinkSync(path.join(backupsDir, files.shift()!));
  }

  // Copy to extra backup folder if configured
  const extraFolderRaw = db.prepare("SELECT value FROM settings WHERE key='backupFolder'").get() as { value: string } | undefined;
  if (extraFolderRaw?.value && extraFolderRaw.value !== "null") {
    try {
      fs.copyFileSync(destPath, path.join(extraFolderRaw.value, `billing-${today}.db`));
    } catch (e) {
      console.error("Extra backup copy failed:", e);
    }
  }

  return destPath;
}

export async function autoBackup(db: DB, userDataPath: string) {
  const today = new Date().toISOString().slice(0, 10);
  const lastBackupRaw = db.prepare("SELECT value FROM settings WHERE key='lastBackupAt'").get() as { value: string } | undefined;
  const lastBackup = lastBackupRaw?.value ?? "null";

  if (!lastBackup.startsWith(`"${today}`) && lastBackup !== `"${today}"`) {
    try {
      await createBackupFile(db, userDataPath);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
        "lastBackupAt", JSON.stringify(new Date().toISOString())
      );
    } catch (e) {
      console.error("Auto backup failed:", e);
    }
  }
}
