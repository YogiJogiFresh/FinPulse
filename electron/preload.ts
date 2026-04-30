import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // App
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('accounts:getAll'),
  createAccount: (data: any) => ipcRenderer.invoke('accounts:create', data),
  updateAccount: (data: any) => ipcRenderer.invoke('accounts:update', data),
  deleteAccount: (id: string) => ipcRenderer.invoke('accounts:delete', { id }),

  // Debts
  getDebts: () => ipcRenderer.invoke('debts:getAll'),
  createDebt: (data: any) => ipcRenderer.invoke('debts:create', data),
  updateDebt: (data: any) => ipcRenderer.invoke('debts:update', data),
  deleteDebt: (id: string) => ipcRenderer.invoke('debts:delete', { id }),
  getDebtTotal: () => ipcRenderer.invoke('debts:total'),

  // Income
  getIncomeSources: () => ipcRenderer.invoke('income:getAll'),
  createIncomeSource: (data: any) => ipcRenderer.invoke('income:create', data),
  updateIncomeSource: (data: any) => ipcRenderer.invoke('income:update', data),
  deleteIncomeSource: (id: string) => ipcRenderer.invoke('income:delete', { id }),
  getIncomeDistributions: (incomeId: string) => ipcRenderer.invoke('income:getDistributions', incomeId),
  setIncomeDistributions: (data: any) => ipcRenderer.invoke('income:setDistributions', data),
  getMonthlyIncomeTotal: () => ipcRenderer.invoke('income:getMonthlyTotal'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', { key, value }),
  setSettingsBatch: (settings: Record<string, string>) => ipcRenderer.invoke('settings:setBatch', settings),
  clearAllData: () => ipcRenderer.invoke('settings:clearAllData'),
  clearByPage: (page: string) => ipcRenderer.invoke('settings:clearByPage', page),

  // Budget
  getBudgetCategories: () => ipcRenderer.invoke('budget:getAll'),
  createBudgetCategory: (data: any) => ipcRenderer.invoke('budget:create', data),
  updateBudgetCategory: (data: any) => ipcRenderer.invoke('budget:update', data),
  deleteBudgetCategory: (id: string) => ipcRenderer.invoke('budget:delete', { id }),
  getBudgetProgress: () => ipcRenderer.invoke('budget:progress'),

  // History
  openAndParseExcel: () => ipcRenderer.invoke('history:openAndParse'),
  parseExcelBase64: (base64: string) => ipcRenderer.invoke('history:parseExcelBase64', base64),
  importHistory: (data: any) => ipcRenderer.invoke('history:import', data),
  getAccountHistory: () => ipcRenderer.invoke('history:getAll'),
  updateHistoryEntry: (data: any) => ipcRenderer.invoke('history:updateEntry', data),
  deleteHistory: () => ipcRenderer.invoke('history:delete'),
  clearAccountTags: (accountName: string) => ipcRenderer.invoke('history:clearAccountTags', accountName),
  addHistoryEntry: (data: any) => ipcRenderer.invoke('history:addEntry', data),
  deleteHistoryEntry: (data: any) => ipcRenderer.invoke('history:deleteEntry', data),
  exportHistory: () => ipcRenderer.invoke('history:export'),

  // Properties
  getProperties: () => ipcRenderer.invoke('properties:getAll'),
  createProperty: (data: any) => ipcRenderer.invoke('properties:create', data),
  updateProperty: (data: any) => ipcRenderer.invoke('properties:update', data),
  deleteProperty: (id: string) => ipcRenderer.invoke('properties:delete', { id }),
  getPropertyDetails: (propertyId: string) => ipcRenderer.invoke('propertyDetails:getAll', propertyId),
  createPropertyDetail: (data: any) => ipcRenderer.invoke('propertyDetails:create', data),
  updatePropertyDetail: (data: any) => ipcRenderer.invoke('propertyDetails:update', data),
  deletePropertyDetail: (id: string) => ipcRenderer.invoke('propertyDetails:delete', { id }),
  getPropertyExpenses: (propertyId: string) => ipcRenderer.invoke('propertyExpenses:getAll', propertyId),
  createPropertyExpense: (data: any) => ipcRenderer.invoke('propertyExpenses:create', data),
  updatePropertyExpense: (data: any) => ipcRenderer.invoke('propertyExpenses:update', data),
  deletePropertyExpense: (id: string) => ipcRenderer.invoke('propertyExpenses:delete', { id }),
  getPropertyContractors: (propertyId: string) => ipcRenderer.invoke('propertyContractors:getAll', propertyId),
  createPropertyContractor: (data: any) => ipcRenderer.invoke('propertyContractors:create', data),
  updatePropertyContractor: (data: any) => ipcRenderer.invoke('propertyContractors:update', data),
  deletePropertyContractor: (id: string) => ipcRenderer.invoke('propertyContractors:delete', { id }),

  // Transactions
  parseTransactionCSV: (csvContent: string) => ipcRenderer.invoke('transactions:parseCSV', csvContent),
  importTransactions: (data: any) => ipcRenderer.invoke('transactions:import', data),
  getTransactions: (filters?: any) => ipcRenderer.invoke('transactions:getAll', filters),
  getTransactionCount: (filters?: any) => ipcRenderer.invoke('transactions:getCount', filters),
  updateTransaction: (id: string, data: any) => ipcRenderer.invoke('transactions:update', id, data),
  deleteTransaction: (id: string) => ipcRenderer.invoke('transactions:delete', id),
  bulkCategorizeTransactions: (ids: string[], category: string) => ipcRenderer.invoke('transactions:bulkCategorize', ids, category),
  applyTransactionRules: () => ipcRenderer.invoke('transactions:applyRules'),
  getTransactionBanks: () => ipcRenderer.invoke('transactions:getBanks'),
  getTransactionMonthlySummary: (year: number, month: number) => ipcRenderer.invoke('transactions:getMonthlySummary', year, month),

  // Category Rules
  getCategoryRules: () => ipcRenderer.invoke('categoryRules:getAll'),
  createCategoryRule: (data: any) => ipcRenderer.invoke('categoryRules:create', data),
  updateCategoryRule: (id: string, data: any) => ipcRenderer.invoke('categoryRules:update', id, data),
  deleteCategoryRule: (id: string) => ipcRenderer.invoke('categoryRules:delete', id),
  autoGenerateCategoryRules: () => ipcRenderer.invoke('categoryRules:autoGenerate'),

  // Platform info
  platform: process.platform,
});
