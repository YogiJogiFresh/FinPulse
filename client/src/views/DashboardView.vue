<template>
  <div class="dashboard-view">
    <!-- Summary Cards -->
    <div class="summary-cards" v-if="!loading">
      <div class="summary-card">
        <div class="card-icon" style="background-color: #38bdf8">
          <i class="pi pi-dollar"></i>
        </div>
        <div class="card-content">
          <span class="card-label">Net Worth</span>
          <span class="card-value">{{ formatCurrency(summary.totalBalance) }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon" style="background-color: #4ade80">
          <i class="pi pi-arrow-down"></i>
        </div>
        <div class="card-content">
          <span class="card-label">Monthly Income</span>
          <span class="card-value text-income">{{ formatCurrency(monthlyIncome) }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon" style="background-color: #f87171">
          <i class="pi pi-credit-card"></i>
        </div>
        <div class="card-content">
          <span class="card-label">Total Debt</span>
          <span class="card-value text-expense">{{ formatCurrency(debtTotals.currentBalance) }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="card-icon" style="background-color: #a78bfa">
          <i class="pi pi-calendar"></i>
        </div>
        <div class="card-content">
          <span class="card-label">Monthly Debt Payments</span>
          <span class="card-value text-expense">
            {{ formatCurrency(debtTotals.totalMonthly) }}
          </span>
        </div>
      </div>
    </div>
    <div class="summary-cards" v-else>
      <div class="summary-card" v-for="i in 4" :key="i">
        <Skeleton width="40px" height="40px" borderRadius="10px" />
        <div class="card-content">
          <Skeleton width="100px" height="14px" />
          <Skeleton width="120px" height="24px" />
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row" v-if="!loading">
      <div class="chart-card">
        <h3>Monthly Budget Breakdown</h3>
        <BudgetPieChart :categories="allBudgetItems" :monthlyIncome="monthlyIncome" />
      </div>
      <div class="chart-card">
        <h3>Budget vs Income</h3>
        <div class="budget-summary-list">
          <div v-for="cat in allBudgetItems" :key="cat._id" class="budget-line">
            <div class="budget-line-label">
              <span class="budget-dot" :style="{ backgroundColor: cat.color }"></span>
              <span>{{ cat.name }}</span>
            </div>
            <span class="budget-line-amount">{{ formatCurrency(cat.monthlyLimit) }}</span>
          </div>
          <div class="budget-line budget-total-line" v-if="allBudgetItems.length > 0">
            <div class="budget-line-label">
              <span class="budget-dot" style="background-color: transparent"></span>
              <span class="budget-total-text">Total Budgeted</span>
            </div>
            <span class="budget-line-amount budget-total-amount">{{ formatCurrency(totalBudgeted) }}</span>
          </div>
          <div class="budget-line" v-if="monthlyIncome > 0 && allBudgetItems.length > 0">
            <div class="budget-line-label">
              <span class="budget-dot" style="background-color: transparent"></span>
              <span class="budget-remaining-text">{{ remainingBudget >= 0 ? 'Unbudgeted' : 'Over Budget' }}</span>
            </div>
            <span class="budget-line-amount" :class="remainingBudget >= 0 ? 'text-income' : 'text-expense'">
              {{ formatCurrency(Math.abs(remainingBudget)) }}
            </span>
          </div>
          <div v-if="allBudgetItems.length === 0" class="empty-chart-msg">
            <span>Add budget categories to see breakdown.</span>
          </div>
        </div>
      </div>
    </div>
    <div class="charts-row" v-if="loading">
      <div class="chart-card">
        <Skeleton width="180px" height="20px" class="mb-3" />
        <Skeleton width="100%" height="200px" borderRadius="8px" />
      </div>
      <div class="chart-card">
        <Skeleton width="140px" height="20px" class="mb-3" />
        <Skeleton width="100%" height="200px" borderRadius="8px" />
      </div>
    </div>

    <!-- Account Type Breakdown -->
    <div class="charts-row" v-if="!loading">
      <div class="chart-card">
        <h3>Account Type Breakdown</h3>
        <AccountTypePieChart :accounts="accounts" />
      </div>
      <div class="chart-card">
        <h3>Balance by Type</h3>
        <div class="budget-summary-list">
          <div v-for="item in accountTypeBreakdown" :key="item.type" class="budget-line">
            <div class="budget-line-label">
              <span class="budget-dot" :style="{ backgroundColor: item.color }"></span>
              <span>{{ formatType(item.type) }}</span>
            </div>
            <span class="budget-line-amount">{{ formatCurrency(item.total) }}</span>
          </div>
          <div class="budget-line budget-total-line" v-if="accountTypeBreakdown.length > 0">
            <div class="budget-line-label">
              <span class="budget-dot" style="background-color: transparent"></span>
              <span class="budget-total-text">Total</span>
            </div>
            <span class="budget-line-amount budget-total-amount">{{ formatCurrency(summary.totalBalance) }}</span>
          </div>
          <div v-if="accounts.length === 0" class="empty-chart-msg">
            <span>Add accounts to see breakdown.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Debt Overview -->
    <div class="recent-section">
      <h3>Debt Overview</h3>
      <DataTable :value="debts" :loading="loading" stripedRows dataKey="_id" :rows="10" v-if="debts.length > 0 || loading">
        <Column field="name" header="Name" />
        <Column field="type" header="Type">
          <template #body="{ data }">
            <Tag :value="formatDebtType(data.type)" :severity="debtSeverity(data.type)" />
          </template>
        </Column>
        <Column field="currentBalance" header="Current Balance">
          <template #body="{ data }">
            <span class="text-expense">{{ formatCurrency(data.currentBalance) }}</span>
          </template>
        </Column>
        <Column field="monthlyPayment" header="Monthly Payment">
          <template #body="{ data }">
            {{ formatCurrency(data.monthlyPayment) }}
          </template>
        </Column>
        <Column field="interestRate" header="Rate">
          <template #body="{ data }">
            {{ data.interestRate }}%
          </template>
        </Column>
      </DataTable>
      <div v-if="!loading && debts.length === 0" class="empty-debts">
        <i class="pi pi-check-circle"></i>
        <span>No debts tracked. Add debts from the Debts page.</span>
      </div>
    </div>

    <!-- Historical Net Worth -->
    <HistoricalNetWorth compact />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Debt, DebtTotal, BudgetCategory, DashboardSummary } from '@/types'
import { getDebts, getDebtTotal, getDashboardSummary, getBudgetCategories, getMonthlyIncomeTotal, getAccounts } from '@/services/api'
import type { Account } from '@/types'
import BudgetPieChart from '@/components/charts/BudgetPieChart.vue'
import AccountTypePieChart from '@/components/charts/AccountTypePieChart.vue'
import HistoricalNetWorth from '@/components/HistoricalNetWorth.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'

const summary = ref<DashboardSummary>({
  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  netSavings: 0
})

const budgetCategories = ref<BudgetCategory[]>([])
const debts = ref<Debt[]>([])
const debtTotals = ref<DebtTotal>({ currentBalance: 0, totalMonthly: 0 })
const monthlyIncome = ref(0)
const accounts = ref<Account[]>([])
const loading = ref(true)

const totalBudgeted= computed(() =>
  allBudgetItems.value.reduce((sum, c) => sum + c.monthlyLimit, 0)
)

const allBudgetItems = computed<BudgetCategory[]>(() => {
  const items = [...budgetCategories.value]
  if (debtTotals.value.totalMonthly > 0) {
    items.push({
      _id: '__debt_payments__',
      name: 'Debt Payments',
      monthlyLimit: debtTotals.value.totalMonthly,
      color: '#ef4444',
      createdAt: ''
    })
  }
  return items
})

const remainingBudget = computed(() =>
  monthlyIncome.value - totalBudgeted.value
)

const typeColors: Record<string, string> = {
  checking: '#38bdf8',
  savings: '#4ade80',
  investment: '#a78bfa',
  retirement: '#fbbf24',
  credit_card: '#f87171',
  cash: '#2dd4bf',
  other: '#64748b'
}

const accountTypeBreakdown = computed(() => {
  const groups: Record<string, number> = {}
  for (const acct of accounts.value) {
    const type = acct.type || 'other'
    groups[type] = (groups[type] || 0) + acct.balance
  }
  return Object.entries(groups)
    .sort(([, a], [, b]) => b - a)
    .map(([type, total]) => ({ type, total, color: typeColors[type] || '#64748b' }))
})

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDebtType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function debtSeverity(type: string): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
  switch (type) {
    case 'mortgage': return 'info'
    case 'student_loan': return 'warn'
    case 'car_loan': return 'secondary'
    case 'credit_card': return 'danger'
    default: return 'secondary'
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [summaryData, categories, debtList, debtTotal, incomeTotal, accountList] = await Promise.all([
      getDashboardSummary(),
      getBudgetCategories(),
      getDebts(),
      getDebtTotal(),
      getMonthlyIncomeTotal(),
      getAccounts()
    ])

    summary.value = summaryData
    budgetCategories.value = categories
    debts.value = debtList
    debtTotals.value = debtTotal
    monthlyIncome.value = incomeTotal
    accounts.value = accountList
  } catch {
    // API may not be available yet
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.summary-card {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: #0f172a;
  flex-shrink: 0;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-label {
  font-size: 0.8rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f1f5f9;
}

.text-income {
  color: #4ade80;
}

.text-expense {
  color: #f87171;
}

.text-transfer {
  color: #38bdf8;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-card {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 20px;
}

.chart-card h3 {
  margin-bottom: 16px;
  color: #f1f5f9;
  font-size: 1rem;
}

.budget-summary-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.budget-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.budget-line-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.budget-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.budget-line-amount {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.9rem;
}

.budget-total-line {
  border-top: 1px solid #334155;
  padding-top: 10px;
  margin-top: 4px;
}

.budget-total-text {
  font-weight: 700;
}

.budget-total-amount {
  font-size: 1rem;
}

.budget-remaining-text {
  font-style: italic;
  color: #94a3b8;
}

.empty-chart-msg {
  color: #64748b;
  font-size: 0.9rem;
  padding: 20px 0;
  text-align: center;
}

.recent-section {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 20px;
}

.recent-section h3 {
  margin-bottom: 16px;
  color: #f1f5f9;
  font-size: 1rem;
}

.empty-debts {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #94a3b8;
  font-size: 0.95rem;
}
</style>
