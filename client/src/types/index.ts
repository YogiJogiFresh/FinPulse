export interface Account {
  _id: string
  name: string
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'retirement' | 'cash' | 'other'
  balance: number
  currency: string
  createdAt: string
  updatedAt: string
  source: 'manual' | 'plaid'
  institutionName: string
  plaidAccountId: string
  plaidType: string
  plaidSubtype: string
  mask: string
  creditLimit: number | null
  availableCredit: number | null
  isLiability: number
  liabilityType: Debt['type'] | ''
  plaidConnected: number
}

export interface BudgetCategory {
  _id: string
  name: string
  monthlyLimit: number
  color: string
  createdAt: string
}

export interface BudgetProgress extends BudgetCategory {
  spent: number
  remaining: number
  percentage: number
}

export interface Debt {
  _id: string
  name: string
  type: 'student_loan' | 'car_loan' | 'mortgage' | 'credit_card' | 'personal_loan' | 'medical' | 'other'
  currentBalance: number
  monthlyPayment: number
  interestRate: number
  notes?: string
  createdAt: string
  updatedAt: string
  source?: 'manual' | 'plaid'
  linkedAccountId?: string | null
  institutionName?: string
  plaidConnected?: number
  hasManualMetadata?: boolean
  paymentStrategy?: 'fixed' | 'pay_in_full' | 'custom' | 'exclude'
  statementBalance?: number | null
  statementBalanceAsOf?: string | null
  statementIsStale?: boolean
  plannedPayment?: number
  creditLimit?: number | null
  availableCredit?: number | null
  utilization?: number | null
}

export interface DebtTotal {
  currentBalance: number
  totalMonthly: number
  creditCardBalance: number
  loanBalance: number
}

export interface IncomeSource {
  _id: string
  name: string
  yearlySalary: number
  monthlyTakeHome: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface IncomeDistribution {
  _id: string
  incomeId: string
  label: string
  amount: number
  createdAt: string
}

export interface AccountHistoryEntry {
  id: string
  account_name: string
  date: string
  value: number
  tag: string
  source?: 'manual' | 'plaid'
  source_account_id?: string
  balance_effect?: number
  captured_at?: string
  sync_run_id?: string
  sync_trigger?: 'legacy' | 'manual' | 'link' | 'scheduled' | 'catch_up'
}

export interface LiabilityMatchSuggestion {
  accountId: string
  accountName: string
  institutionName: string
  debtId: string
  debtName: string
  liabilityType: Debt['type']
}

export interface ParsedExcelData {
  accounts: string[]
  dates: string[]
  values: number[][]
}

export interface Property {
  _id: string
  name: string
  designation: 'primary_residence' | 'rental'
  address: string
  purchaseDate: string
  purchasePrice: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface PropertyDetail {
  _id: string
  propertyId: string
  label: string
  value: string
  category: 'systems' | 'structure' | 'appliances' | 'other'
  createdAt: string
  updatedAt: string
}

export interface PropertyExpense {
  _id: string
  propertyId: string
  date: string
  description: string
  amount: number
  category: 'maintenance' | 'repair' | 'improvement' | 'tax' | 'insurance' | 'utility' | 'hoa' | 'other'
  notes: string
  createdAt: string
}

export interface PropertyContractor {
  _id: string
  propertyId: string
  name: string
  specialty: 'plumber' | 'electrician' | 'hvac' | 'roofer' | 'general' | 'landscaper' | 'painter' | 'other'
  phone: string
  email: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  date: string
  postDate: string
  description: string
  originalDescription: string
  amount: number
  category: string
  bank: string
  accountLabel: string
  notes: string
  importBatch: string
  customData: Record<string, string>
  createdAt: string
}

export interface CategoryRule {
  id: string
  pattern: string
  category: string
  priority: number
  createdAt: string
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  category?: string
  bank?: string
  search?: string
  limit?: number
  offset?: number
}

export interface TransactionImportResult {
  imported: number
  skipped: number
  batchId: string
}

export interface MonthlyCategorySummary {
  category: string
  total: number
  count: number
}

export interface BankConfig {
  id: string
  name: string
  dateColumn: string
  postDateColumn: string
  descriptionColumn: string
  amountType: 'signed' | 'split'
  amountColumn: string
  debitColumn: string
  creditColumn: string
  detectionFields: string
  customColumns: { csvHeader: string; displayName: string }[]
  createdAt: string
}

export interface PlaidItem {
  itemId: string
  institutionName: string
  createdAt: string
  lastSyncedAt: string | null
}

export interface PlaidStatus {
  configured: boolean
  environment: 'sandbox' | 'production' | null
  secureStorageAvailable: boolean
  items: PlaidItem[]
}

export interface PlaidSyncResult {
  added: number
  modified: number
  removed: number
  items?: number
  institutions: {
    institutionName: string
    accountsAddedCount: number
    accountsUpdatedCount: number
    accountsAdded: string[]
    accountsUpdated: string[]
    transactionsAddedCount: number
    transactionsModifiedCount: number
    transactionsRemovedCount: number
    transactionsAdded: string[]
    transactionsModified: string[]
    transactionsRemoved: string[]
  }[]
}

export interface PlaidScheduleConfig {
  firstDayEnabled: boolean
  lastDayEnabled: boolean
  localTime: string
}

export interface PlaidScheduleStatus extends PlaidScheduleConfig {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastTrigger: 'link' | 'manual' | 'scheduled' | 'catch_up' | null
  lastError: string | null
  lastCompletedSlot: string | null
  nextRunAt: string | null
}

export type AppNotificationSeverity = 'success' | 'info' | 'warn' | 'error'

export interface CreateAppNotification {
  severity?: AppNotificationSeverity
  summary?: string
  detail?: string
  expandedDetail?: string
}

export interface AppNotification {
  id: string
  severity: AppNotificationSeverity
  summary: string
  detail: string
  expandedDetail: string
  source: string
  createdAt: string
  readAt: string | null
}

export interface BackupRecord {
  id: string
  createdAt: string
  reason: 'automatic' | 'manual' | 'pre_restore'
  sizeBytes: number
  includesPlaidSecrets: boolean
}
