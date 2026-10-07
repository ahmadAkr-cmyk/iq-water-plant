import { contextBridge, ipcRenderer } from "electron";

// Expose a whitelist of IPC channels
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, data: any) => {
    const validChannels = [
      "listCustomers", "searchCustomers", "getCustomer", "createCustomer",
      "updateCustomer", "setCustomerActive", "listProducts", "createProduct",
      "updateProduct", "createSale", "listSales", "getSale", "cancelSale",
      "getLedger", "addPayment", "addAdvance", "getDashboard", "getReport",
      "getReceivables", "getSettings", "saveSettings", "createBackup",
      "exportReport", "openWhatsApp"
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error("Invalid IPC channel"));
  },
});
