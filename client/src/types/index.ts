export interface Account {
  _id: string
  name: string
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'retirement' | 'cash' | 'other'
  balance: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  _id: string
  accountId: string
  date: string
  description: string
  amount: number
  category: string
  type: 'income' | 'expense' | 'transfer'
  notes?: string
  createdAt: string
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

export interface DashboardSummary {
  totalBalance: number
  monthlyIncome: number
  monthlyExpenses: number
  netSavings: number
}

export interface Debt {
  _id: string
  name: string
  type: 'student_loan' | 'car_loan' | 'mortgage' | 'credit_card' | 'personal_loan' | 'medical' | 'other'
  totalDebt: number
  monthlyPayment: number
  interestRate: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface DebtTotal {
  totalDebt: number
  totalMonthly: number
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
  account_name: string
  date: string
  value: number
  tag: string
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
