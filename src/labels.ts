// All UI labels live here. Add `ur` (Urdu script) later as a third field.
export type Label = { en: string; ro: string };
const L = (en: string, ro: string): Label => ({ en, ro });

export const labels = {
  appName: L("IQ Waterland", "Billing and Khata System"),
  nav: {
    dashboard: L("Dashboard", "Home"),
    newSale: L("New Sale", "Nayi Sale"),
    khata: L("Udhar Khata", "Udhar / Advance Khata"),
    sales: L("Sale History", "Purani Sales"),
    rates: L("Rates", "Rate List"),
    reports: L("Reports", "Hisaab"),
    settings: L("Settings", "Settings"),
  },
  actions: {
    newSale: L("New Sale", "Nayi Sale"),
    receivePayment: L("Receive Payment", "Payment Lo"),
    newMember: L("New Member", "Naya Member"),
    addAdvance: L("Add Advance", "Advance Jama"),
    save: L("Save", "Mehfooz karo"),
    cancel: L("Cancel", "Wapas"),
    edit: L("Edit", "Tabdeel karo"),
    deactivate: L("Deactivate member", "Member band karo"),
    activate: L("Activate member", "Member chalu karo"),
    reminder: L("WhatsApp Reminder", "Yaad dihani"),
    print: L("Print", "Print"),
  },
  dashboard: {
    greeting: "Assalam o Alaikum",
    todaySale: L("Today's Sale", "Aaj ki sale"),
    todayBottles: L("Today's Bottles", "Aaj ki bottlein"),
    deliveries: L("Deliveries Today", "Aaj ki delivery"),
    totalUdhar: L("Total Udhar Baqi", "Kul udhar"),
    totalAdvance: L("Total Advance Jama", "Kul advance"),
    chart: L("Last 7 days sales", "Pichle 7 din"),
    recent: L("Recent Sales", "Taaza sales"),
    topUdhar: L("Top Udhar", "Sab se zyada udhar"),
  },
  sale: {
    customer: L("Customer", "Grahak"),
    bottles: L("Bottles", "Bottlein"),
    delivery: L("Delivery?", "Delivery chahiye?"),
    payment: L("Payment", "Paisa kaise"),
    summary: L("Bill Summary", "Bill"),
    saveSale: L("SAVE SALE", "Sale mehfooz karo"),
  },
  khata: {
    title: L("Udhar Khata", "Udhar / Advance Khata"),
    members: L("Members", "Members"),
  },
  sales: { title: L("Sale History", "Purani Sales") },
  rates: { title: L("Rates", "Rate List"), deliveryFee: L("Delivery fee", "Delivery ka kharcha") },
  reports: { title: L("Reports", "Hisaab"), dayClose: L("Day Close", "Roz ka Hisaab") },
  settings: { title: L("Settings", "Settings") },
  member: L("Member detail", "Member ka khata"),
};
