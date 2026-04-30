/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  api: {
    getAccounts(): Promise<import('./types').Account[]>
    createAccount(data: any): Promise<import('./types').Account>
    updateAccount(data: any): Promise<import('./types').Account>
    deleteAccount(id: string): Promise<void>
    getDebts(): Promise<import('./types').Debt[]>
    createDebt(data: any): Promise<import('./types').Debt>
    updateDebt(data: any): Promise<import('./types').Debt>
    deleteDebt(id: string): Promise<void>
    getDebtTotal(): Promise<import('./types').DebtTotal>
    getIncomeSources(): Promise<import('./types').IncomeSource[]>
    createIncomeSource(data: any): Promise<import('./types').IncomeSource>
    updateIncomeSource(data: any): Promise<import('./types').IncomeSource>
    deleteIncomeSource(id: string): Promise<void>
    getIncomeDistributions(incomeId: string): Promise<import('./types').IncomeDistribution[]>
    setIncomeDistributions(data: any): Promise<import('./types').IncomeDistribution[]>
    getMonthlyIncomeTotal(): Promise<number>
    getSettings(): Promise<Record<string, string>>
    getSetting(key: string): Promise<string | null>
    setSetting(key: string, value: string): Promise<void>
    setSettingsBatch(settings: Record<string, string>): Promise<void>
    clearAllData(): Promise<void>
    clearByPage(page: string): Promise<void>
    getBudgetCategories(): Promise<import('./types').BudgetCategory[]>
    createBudgetCategory(data: any): Promise<import('./types').BudgetCategory>
    updateBudgetCategory(data: any): Promise<import('./types').BudgetCategory>
    deleteBudgetCategory(id: string): Promise<void>
    getBudgetProgress(): Promise<import('./types').BudgetProgress[]>
    openAndParseExcel(): Promise<import('./types').ParsedExcelData | null>
    parseExcelBase64(base64: string): Promise<import('./types').ParsedExcelData>
    importHistory(data: import('./types').ParsedExcelData): Promise<void>
    getAccountHistory(): Promise<import('./types').AccountHistoryEntry[]>
    updateHistoryEntry(data: { account_name: string; date: string; value: number; tag: string }): Promise<void>
    deleteHistory(): Promise<void>
    clearAccountTags(accountName: string): Promise<void>
    addHistoryEntry(data: { account_name: string; date: string; value: number }): Promise<void>
    deleteHistoryEntry(data: { account_name: string; date: string }): Promise<void>
    exportHistory(): Promise<boolean>
    // Properties
    getProperties(): Promise<import('./types').Property[]>
    createProperty(data: any): Promise<import('./types').Property>
    updateProperty(data: any): Promise<import('./types').Property>
    deleteProperty(id: string): Promise<void>
    getPropertyDetails(propertyId: string): Promise<import('./types').PropertyDetail[]>
    createPropertyDetail(data: any): Promise<import('./types').PropertyDetail>
    updatePropertyDetail(data: any): Promise<import('./types').PropertyDetail>
    deletePropertyDetail(id: string): Promise<void>
    getPropertyExpenses(propertyId: string): Promise<import('./types').PropertyExpense[]>
    createPropertyExpense(data: any): Promise<import('./types').PropertyExpense>
    updatePropertyExpense(data: any): Promise<import('./types').PropertyExpense>
    deletePropertyExpense(id: string): Promise<void>
    getPropertyContractors(propertyId: string): Promise<import('./types').PropertyContractor[]>
    createPropertyContractor(data: any): Promise<import('./types').PropertyContractor>
    updatePropertyContractor(data: any): Promise<import('./types').PropertyContractor>
    deletePropertyContractor(id: string): Promise<void>
    // Transactions
    parseTransactionCSV(csvContent: string): Promise<{ bank: string; transactions: Array<{ date: string; postDate: string; description: string; amount: number }>; errors: string[] }>
    importTransactions(data: { transactions: Array<{ date: string; postDate?: string; description: string; amount: number; category?: string }>; bank: string; accountLabel: string }): Promise<import('./types').TransactionImportResult>
    getTransactions(filters?: import('./types').TransactionFilters): Promise<import('./types').Transaction[]>
    getTransactionCount(filters?: import('./types').TransactionFilters): Promise<number>
    updateTransaction(id: string, data: Partial<{ description: string; category: string; notes: string; amount: number; date: string }>): Promise<void>
    deleteTransaction(id: string): Promise<void>
    bulkCategorizeTransactions(ids: string[], category: string): Promise<void>
    applyTransactionRules(): Promise<{ categorized: number }>
    getTransactionBanks(): Promise<Array<{ bank: string; accountLabel: string }>>
    getTransactionMonthlySummary(year: number, month: number): Promise<import('./types').MonthlyCategorySummary[]>
    // Category Rules
    getCategoryRules(): Promise<import('./types').CategoryRule[]>
    createCategoryRule(data: { pattern: string; category: string; priority?: number }): Promise<{ id: string }>
    updateCategoryRule(id: string, data: Partial<{ pattern: string; category: string; priority: number }>): Promise<void>
    deleteCategoryRule(id: string): Promise<void>
    autoGenerateCategoryRules(): Promise<{ created: number }>
    // Bank Configs
    getBankConfigs(): Promise<import('./types').BankConfig[]>
    createBankConfig(data: { name: string; dateColumn: string; postDateColumn?: string; descriptionColumn: string; amountType: string; amountColumn?: string; debitColumn?: string; creditColumn?: string; detectionFields: string }): Promise<{ id: string }>
    updateBankConfig(id: string, data: Partial<{ name: string; dateColumn: string; postDateColumn: string; descriptionColumn: string; amountType: string; amountColumn: string; debitColumn: string; creditColumn: string; detectionFields: string }>): Promise<void>
    deleteBankConfig(id: string): Promise<void>
    getAppVersion(): Promise<string>
    platform: string
  }
}
