import type { Account, BudgetCategory, BudgetProgress, Debt, DebtTotal, IncomeSource, IncomeDistribution, Transaction, TransactionFilters, TransactionImportResult, CategoryRule, MonthlyCategorySummary, BankConfig, PlaidStatus, PlaidSyncResult, PlaidScheduleConfig, PlaidScheduleStatus, LiabilityMatchSuggestion, AppNotification, CreateAppNotification, BackupRecord, RuntimeProfileInfo } from '@/types'

// Accounts
export function getAccounts(): Promise<Account[]> {
  return window.api.getAccounts()
}

export function createAccount(account: Pick<Account, 'name' | 'type' | 'balance' | 'currency'>): Promise<Account> {
  return window.api.createAccount(account)
}

export function updateAccount(id: string, account: Partial<Account>): Promise<Account> {
  return window.api.updateAccount({ id, ...account })
}

export function deleteAccount(id: string): Promise<void> {
  return window.api.deleteAccount(id)
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

export function getLiabilityLinkSuggestions(): Promise<LiabilityMatchSuggestion[]> {
  return window.api.getLiabilityLinkSuggestions()
}

export function linkDebtAccount(debtId: string, accountId: string): Promise<void> {
  return window.api.linkDebtAccount({ debtId, accountId })
}

export function unlinkDebtAccount(debtId: string): Promise<void> {
  return window.api.unlinkDebtAccount(debtId)
}

export function dismissLiabilityLinkSuggestion(debtId: string, accountId: string): Promise<void> {
  return window.api.dismissLiabilityLinkSuggestion({ debtId, accountId })
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

// Backups
export function getBackups(): Promise<BackupRecord[]> {
  return window.api.getBackups()
}

export function createBackup(): Promise<BackupRecord> {
  return window.api.createBackup()
}

export function openBackupFolder(): Promise<void> {
  return window.api.openBackupFolder()
}

export function restoreBackup(id: string): Promise<BackupRecord> {
  return window.api.restoreBackup(id)
}

// Notifications
export function getAppNotifications(): Promise<AppNotification[]> {
  return window.api.getAppNotifications()
}

export function createAppNotification(data: CreateAppNotification): Promise<AppNotification> {
  return window.api.createAppNotification(data)
}

export function markAllAppNotificationsRead(): Promise<void> {
  return window.api.markAllAppNotificationsRead()
}

export function dismissAppNotification(id: string): Promise<void> {
  return window.api.dismissAppNotification(id)
}

export function clearAppNotifications(): Promise<void> {
  return window.api.clearAppNotifications()
}

export function onAppNotificationsChanged(callback: () => void): () => void {
  return window.api.onAppNotificationsChanged(callback)
}

// History
export function openAndParseExcel(): Promise<import('@/types').ParsedExcelData | null> {
  return window.api.openAndParseExcel()
}

export function importHistory(data: import('@/types').ParsedExcelData): Promise<void> {
  return window.api.importHistory(data)
}

export function getAccountHistory(): Promise<import('@/types').AccountHistoryEntry[]> {
  return window.api.getAccountHistory()
}

export function updateHistoryEntry(data: { id: string; account_name: string; value: number; tag: string }): Promise<void> {
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

export function deleteHistoryEntry(data: { id: string; account_name: string }): Promise<void> {
  return window.api.deleteHistoryEntry(data)
}

export function exportHistory(): Promise<boolean> {
  return window.api.exportHistory()
}

// App
export function getAppVersion(): Promise<string> {
  return window.api.getAppVersion()
}

export function getRuntimeProfile(): Promise<RuntimeProfileInfo> {
  return window.api.getRuntimeProfile()
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

// Transactions
export function parseTransactionCSV(csvContent: string) {
  return window.api.parseTransactionCSV(csvContent)
}

export function parseTransactionCSVWithConfig(csvContent: string, bankId?: string | null) {
  return window.api.parseTransactionCSVWithConfig(csvContent, bankId || '')
}

export function importTransactions(data: { transactions: Array<{ date: string; postDate?: string; description: string; amount: number; category?: string; customData?: Record<string, string> }>; bank: string; accountLabel: string }): Promise<TransactionImportResult> {
  // Deep-clone to strip Vue reactive proxies before IPC transfer
  return window.api.importTransactions(JSON.parse(JSON.stringify(data)))
}

export function getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
  return window.api.getTransactions(filters)
}

export function getTransactionCount(filters?: TransactionFilters): Promise<number> {
  return window.api.getTransactionCount(filters)
}

export function updateTransaction(id: string, data: Partial<{ description: string; category: string; notes: string; amount: number; date: string }>): Promise<void> {
  return window.api.updateTransaction(id, data)
}

export function deleteTransaction(id: string): Promise<void> {
  return window.api.deleteTransaction(id)
}

export function bulkCategorizeTransactions(ids: string[], category: string): Promise<void> {
  return window.api.bulkCategorizeTransactions(ids, category)
}

export function getTransactionBanks(): Promise<Array<{ bank: string; accountLabel: string }>> {
  return window.api.getTransactionBanks()
}

export function getTransactionMonthlySummary(year: number, month: number): Promise<MonthlyCategorySummary[]> {
  return window.api.getTransactionMonthlySummary(year, month)
}

export function getTransactionDateRangeSummary(startDate: string, endDate: string): Promise<MonthlyCategorySummary[]> {
  return window.api.getTransactionDateRangeSummary(startDate, endDate)
}

// Category Rules
export function getCategoryRules(): Promise<CategoryRule[]> {
  return window.api.getCategoryRules()
}

export function createCategoryRule(data: { pattern: string; category: string; priority?: number }): Promise<{ id: string }> {
  return window.api.createCategoryRule(data)
}

export function updateCategoryRule(id: string, data: Partial<{ pattern: string; category: string; priority: number }>): Promise<void> {
  return window.api.updateCategoryRule(id, data)
}

export function deleteCategoryRule(id: string): Promise<void> {
  return window.api.deleteCategoryRule(id)
}

export function autoGenerateCategoryRules(): Promise<{ created: number }> {
  return window.api.autoGenerateCategoryRules()
}

export function applyTransactionRules(): Promise<{ updated: number }> {
  return window.api.applyTransactionRules()
}

// Bank Configs
export function getBankConfigs(): Promise<BankConfig[]> {
  return window.api.getBankConfigs()
}

export function createBankConfig(data: { name: string; dateColumn?: string; postDateColumn?: string; descriptionColumn?: string; amountType?: string; amountColumn?: string; debitColumn?: string; creditColumn?: string; detectionFields?: string; customColumns?: { csvHeader: string; displayName: string }[] }): Promise<{ id: string }> {
  return window.api.createBankConfig(JSON.parse(JSON.stringify(data)))
}

export function updateBankConfig(id: string, data: Partial<{ name: string; dateColumn: string; postDateColumn: string; descriptionColumn: string; amountType: string; amountColumn: string; debitColumn: string; creditColumn: string; detectionFields: string; customColumns: { csvHeader: string; displayName: string }[] }>): Promise<void> {
  return window.api.updateBankConfig(id, JSON.parse(JSON.stringify(data)))
}

export function deleteBankConfig(id: string): Promise<void> {
  return window.api.deleteBankConfig(id)
}

// Plaid
export function getPlaidStatus(): Promise<PlaidStatus> {
  return window.api.getPlaidStatus()
}

export function configurePlaid(data: { clientId: string; secret: string; environment: 'sandbox' | 'production' }): Promise<void> {
  return window.api.configurePlaid(data)
}

export function openPlaidLink(): Promise<(PlaidSyncResult & { itemId: string }) | null> {
  return window.api.openPlaidLink()
}

export function syncPlaid(itemId?: string): Promise<PlaidSyncResult> {
  return window.api.syncPlaid(itemId)
}

export function getPlaidSchedule(): Promise<PlaidScheduleStatus> {
  return window.api.getPlaidSchedule()
}

export function setPlaidSchedule(data: PlaidScheduleConfig): Promise<PlaidScheduleStatus> {
  return window.api.setPlaidSchedule(data)
}

export function onPlaidScheduleChanged(callback: () => void): () => void {
  return window.api.onPlaidScheduleChanged(callback)
}

export function disconnectPlaid(itemId: string): Promise<void> {
  return window.api.disconnectPlaid(itemId)
}

export function clearPlaid(): Promise<{ revocationErrors: string[] }> {
  return window.api.clearPlaid()
}

export function clearPlaidLocal(): Promise<void> {
  return window.api.clearPlaidLocal()
}

export function openPlaidDashboard(): Promise<void> {
  return window.api.openPlaidDashboard()
}
