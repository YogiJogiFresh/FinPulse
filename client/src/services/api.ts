import type { Account, Transaction, BudgetCategory, BudgetProgress, DashboardSummary, Debt, DebtTotal, IncomeSource, IncomeDistribution } from '@/types'

export interface TransactionFilters {
  accountId?: string
  category?: string
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export interface CategorySpending {
  category: string
  total: number
  count: number
}

// Accounts
export function getAccounts(): Promise<Account[]> {
  return window.api.getAccounts()
}

export function createAccount(account: Omit<Account, '_id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
  return window.api.createAccount(account)
}

export function updateAccount(id: string, account: Partial<Account>): Promise<Account> {
  return window.api.updateAccount({ id, ...account })
}

export function deleteAccount(id: string): Promise<void> {
  return window.api.deleteAccount(id)
}

// Transactions
export function getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
  return window.api.getTransactions(filters)
}

export function createTransaction(transaction: Omit<Transaction, '_id' | 'createdAt'>): Promise<Transaction> {
  return window.api.createTransaction(transaction)
}

export function updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
  return window.api.updateTransaction({ id, ...transaction })
}

export function deleteTransaction(id: string): Promise<void> {
  return window.api.deleteTransaction(id)
}

export function getTransactionSummary(): Promise<CategorySpending[]> {
  return window.api.getTransactionSummary()
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return window.api.getDashboardSummary()
}

// Budget
export function getBudgetCategories(): Promise<BudgetCategory[]> {
  return window.api.getBudgetCategories()
}

export function createBudgetCategory(category: Omit<BudgetCategory, '_id' | 'createdAt'>): Promise<BudgetCategory> {
  return window.api.createBudgetCategory(category)
}

export function updateBudgetCategory(id: string, category: Partial<BudgetCategory>): Promise<BudgetCategory> {
  return window.api.updateBudgetCategory({ id, ...category })
}

export function deleteBudgetCategory(id: string): Promise<void> {
  return window.api.deleteBudgetCategory(id)
}

export function getBudgetProgress(): Promise<BudgetProgress[]> {
  return window.api.getBudgetProgress()
}

// Debts
export function getDebts(): Promise<Debt[]> {
  return window.api.getDebts()
}

export function createDebt(debt: Omit<Debt, '_id' | 'createdAt' | 'updatedAt'>): Promise<Debt> {
  return window.api.createDebt(debt)
}

export function updateDebt(id: string, debt: Partial<Debt>): Promise<Debt> {
  return window.api.updateDebt({ id, ...debt })
}

export function deleteDebt(id: string): Promise<void> {
  return window.api.deleteDebt(id)
}

export function getDebtTotal(): Promise<DebtTotal> {
  return window.api.getDebtTotal()
}

// Income
export function getIncomeSources(): Promise<IncomeSource[]> {
  return window.api.getIncomeSources()
}

export function createIncomeSource(source: Omit<IncomeSource, '_id' | 'createdAt' | 'updatedAt'>): Promise<IncomeSource> {
  return window.api.createIncomeSource(source)
}

export function updateIncomeSource(id: string, source: Partial<IncomeSource>): Promise<IncomeSource> {
  return window.api.updateIncomeSource({ id, ...source })
}

export function deleteIncomeSource(id: string): Promise<void> {
  return window.api.deleteIncomeSource(id)
}

export function getIncomeDistributions(incomeId: string): Promise<IncomeDistribution[]> {
  return window.api.getIncomeDistributions(incomeId)
}

export function setIncomeDistributions(incomeId: string, distributions: { label: string; amount: number }[]): Promise<IncomeDistribution[]> {
  return window.api.setIncomeDistributions({ incomeId, distributions })
}

export function getMonthlyIncomeTotal(): Promise<number> {
  return window.api.getMonthlyIncomeTotal()
}

// Settings
export function getSettings(): Promise<Record<string, string>> {
  return window.api.getSettings()
}

export function getSetting(key: string): Promise<string | null> {
  return window.api.getSetting(key)
}

export function setSetting(key: string, value: string): Promise<void> {
  return window.api.setSetting(key, value)
}

export function setSettingsBatch(settings: Record<string, string>): Promise<void> {
  return window.api.setSettingsBatch(settings)
}

export function clearAllData(): Promise<void> {
  return window.api.clearAllData()
}

export function clearByPage(page: string): Promise<void> {
  return window.api.clearByPage(page)
}

// History
export function openAndParseExcel(): Promise<import('@/types').ParsedExcelData | null> {
  return window.api.openAndParseExcel()
}

export function parseExcelBase64(base64: string): Promise<import('@/types').ParsedExcelData> {
  return window.api.parseExcelBase64(base64)
}

export function importHistory(data: import('@/types').ParsedExcelData): Promise<void> {
  return window.api.importHistory(data)
}

export function getAccountHistory(): Promise<import('@/types').AccountHistoryEntry[]> {
  return window.api.getAccountHistory()
}

export function updateHistoryEntry(data: { account_name: string; date: string; value: number; tag: string }): Promise<void> {
  return window.api.updateHistoryEntry(data)
}

export function deleteHistory(): Promise<void> {
  return window.api.deleteHistory()
}

export function clearAccountTags(accountName: string): Promise<void> {
  return window.api.clearAccountTags(accountName)
}

export function addHistoryEntry(data: { account_name: string; date: string; value: number }): Promise<void> {
  return window.api.addHistoryEntry(data)
}

export function deleteHistoryEntry(data: { account_name: string; date: string }): Promise<void> {
  return window.api.deleteHistoryEntry(data)
}

export function exportHistory(): Promise<boolean> {
  return window.api.exportHistory()
}

// App
export function getAppVersion(): Promise<string> {
  return window.api.getAppVersion()
}

// Properties
import type { Property, PropertyDetail, PropertyExpense, PropertyContractor } from '@/types'

function plain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function getProperties(): Promise<Property[]> {
  return window.api.getProperties()
}
export function createProperty(data: Omit<Property, '_id' | 'createdAt' | 'updatedAt'>): Promise<Property> {
  return window.api.createProperty(plain(data))
}
export function updateProperty(id: string, data: Partial<Property>): Promise<Property> {
  return window.api.updateProperty(plain({ id, ...data }))
}
export function deleteProperty(id: string): Promise<void> {
  return window.api.deleteProperty(id)
}

export function getPropertyDetails(propertyId: string): Promise<PropertyDetail[]> {
  return window.api.getPropertyDetails(propertyId)
}
export function createPropertyDetail(data: Omit<PropertyDetail, '_id' | 'createdAt' | 'updatedAt'>): Promise<PropertyDetail> {
  return window.api.createPropertyDetail(plain(data))
}
export function updatePropertyDetail(id: string, data: Partial<PropertyDetail>): Promise<PropertyDetail> {
  return window.api.updatePropertyDetail(plain({ id, ...data }))
}
export function deletePropertyDetail(id: string): Promise<void> {
  return window.api.deletePropertyDetail(id)
}

export function getPropertyExpenses(propertyId: string): Promise<PropertyExpense[]> {
  return window.api.getPropertyExpenses(propertyId)
}
export function createPropertyExpense(data: Omit<PropertyExpense, '_id' | 'createdAt'>): Promise<PropertyExpense> {
  return window.api.createPropertyExpense(plain(data))
}
export function updatePropertyExpense(id: string, data: Partial<PropertyExpense>): Promise<PropertyExpense> {
  return window.api.updatePropertyExpense(plain({ id, ...data }))
}
export function deletePropertyExpense(id: string): Promise<void> {
  return window.api.deletePropertyExpense(id)
}

export function getPropertyContractors(propertyId: string): Promise<PropertyContractor[]> {
  return window.api.getPropertyContractors(propertyId)
}
export function createPropertyContractor(data: Omit<PropertyContractor, '_id' | 'createdAt' | 'updatedAt'>): Promise<PropertyContractor> {
  return window.api.createPropertyContractor(plain(data))
}
export function updatePropertyContractor(id: string, data: Partial<PropertyContractor>): Promise<PropertyContractor> {
  return window.api.updatePropertyContractor(plain({ id, ...data }))
}
export function deletePropertyContractor(id: string): Promise<void> {
  return window.api.deletePropertyContractor(id)
}
