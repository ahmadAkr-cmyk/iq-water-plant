export const rs = (n: number) => "Rs " + Math.round(Math.abs(n)).toLocaleString("en-US");
export const rsSigned = (n: number) => (n < 0 ? "-" : "") + rs(n);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
export function fmtLong(d = new Date()) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export type Preset = "today" | "yesterday" | "7d" | "month" | "all" | "custom";
export function presetRange(p: Preset, custom?: { from: string; to: string }) {
  const now = new Date();
  if (p === "today") return { from: startOfDay().toISOString(), to: endOfDay().toISOString() };
  if (p === "yesterday") {
    const y = new Date(now.getTime() - 864e5);
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
  }
  if (p === "7d") return { from: startOfDay(new Date(now.getTime() - 6 * 864e5)).toISOString(), to: endOfDay().toISOString() };
  if (p === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: endOfDay().toISOString() };
  if (p === "custom" && custom?.from && custom?.to)
    return { from: startOfDay(new Date(custom.from)).toISOString(), to: endOfDay(new Date(custom.to)).toISOString() };
  return { from: undefined, to: undefined };
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function itemsShort(items: { name: string; qty: number }[]) {
  return items.map((i) => `${i.qty} x ${i.name.replace(" Litre", "L").replace(" Bottle", "")}`).join(", ");
}
