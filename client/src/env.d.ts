/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface TransactionFilters {
  accountId?: string
  category?: string
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

interface CategorySpending {
  category: string
  total: number
  count: number
}

interface Window {
  api: {
    getAccounts(): Promise<import('./types').Account[]>
    createAccount(data: any): Promise<import('./types').Account>
    updateAccount(data: any): Promise<import('./types').Account>
    deleteAccount(id: string): Promise<void>
    getTransactions(filters?: TransactionFilters): Promise<import('./types').Transaction[]>
    createTransaction(data: any): Promise<import('./types').Transaction>
    updateTransaction(data: any): Promise<import('./types').Transaction>
    deleteTransaction(id: string): Promise<void>
    getTransactionSummary(): Promise<CategorySpending[]>
    getDashboardSummary(): Promise<import('./types').DashboardSummary>
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
    platform: string
  }
}
