<template>
  <div class="budget-view">
    <div class="view-toolbar">
      <Button label="Add Category" icon="pi pi-plus" @click="openCreate" />
    </div>

    <!-- Date Range Filters -->
    <div class="date-filters">
      <div class="quick-filters">
        <Button label="1 Month" size="small" :severity="activeQuickFilter === '1m' ? 'primary' : 'secondary'" @click="setQuickFilter('1m')" />
        <Button label="3 Months" size="small" :severity="activeQuickFilter === '3m' ? 'primary' : 'secondary'" @click="setQuickFilter('3m')" />
        <Button label="1 Year" size="small" :severity="activeQuickFilter === '1y' ? 'primary' : 'secondary'" @click="setQuickFilter('1y')" />
      </div>
      <div class="date-range-pickers">
        <DatePicker v-model="startDate" placeholder="Start Date" dateFormat="yy-mm-dd" showIcon @date-select="onDateChange" />
        <span class="date-separator">to</span>
        <DatePicker v-model="endDate" placeholder="End Date" dateFormat="yy-mm-dd" showIcon @date-select="onDateChange" />
      </div>
    </div>

    <!-- Budget vs Actual Chart -->
    <div v-if="categories.length > 0" class="chart-container">
      <Bar :data="chartData" :options="chartOptions" />
    </div>

    <DataTable :value="categories" :loading="loading" stripedRows dataKey="_id" paginator :rows="15" v-if="categories.length > 0 || loading">
      <Column header="Color" style="width: 8%">
        <template #body="{ data }">
          <span class="color-swatch" :style="{ backgroundColor: data.color }"></span>
        </template>
      </Column>
      <Column field="name" header="Category" sortable />
      <Column field="monthlyLimit" header="Budget" sortable>
        <template #body="{ data }">
          {{ formatCurrency(data.monthlyLimit) }}
        </template>
      </Column>
      <Column header="Actual" style="width: 14%">
        <template #body="{ data }">
          <span :class="'actual-' + getSpendStatus(data.name, data.monthlyLimit)">
            {{ formatCurrency(getActualSpend(data.name)) }}
          </span>
        </template>
      </Column>
      <Column header="Remaining" style="width: 14%">
        <template #body="{ data }">
          <span :class="'actual-' + getSpendStatus(data.name, data.monthlyLimit)">
            {{ formatCurrency(data.monthlyLimit - getActualSpend(data.name)) }}
          </span>
        </template>
      </Column>
      <Column header="Actions" style="width: 14%">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button icon="pi pi-pencil" severity="info" text rounded @click="openEdit(data)" />
            <Button icon="pi pi-trash" severity="danger" text rounded @click="onDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>
    <div v-if="!loading && categories.length === 0" class="empty-state">
      <i class="pi pi-tags"></i>
      <span>No budget categories yet. Add one to start tracking.</span>
    </div>

    <Dialog v-model:visible="dialogVisible" :header="editingCategory ? 'Edit Category' : 'New Category'" modal :style="{ width: '90vw', maxWidth: '28rem' }">
      <BudgetCategoryForm :category="editingCategory" @save="onSave" @cancel="dialogVisible = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { BudgetCategory, MonthlyCategorySummary } from '@/types'
import { getBudgetCategories, createBudgetCategory, updateBudgetCategory, deleteBudgetCategory, getTransactionDateRangeSummary } from '@/services/api'
import BudgetCategoryForm from '@/components/budget/BudgetCategoryForm.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DatePicker from 'primevue/datepicker'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const categories = ref<BudgetCategory[]>([])
const dialogVisible = ref(false)
const editingCategory = ref<BudgetCategory | null>(null)
const loading = ref(true)
const monthlySummary = ref<MonthlyCategorySummary[]>([])

const activeQuickFilter = ref<'1m' | '3m' | '1y'>('1m')
const startDate = ref<Date>(getMonthsAgo(1))
const endDate = ref<Date>(new Date())

function getMonthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setQuickFilter(filter: '1m' | '3m' | '1y') {
  activeQuickFilter.value = filter
  endDate.value = new Date()
  if (filter === '1m') startDate.value = getMonthsAgo(1)
  else if (filter === '3m') startDate.value = getMonthsAgo(3)
  else startDate.value = getMonthsAgo(12)
  loadBudget()
}

function onDateChange() {
  activeQuickFilter.value = '' as any
  loadBudget()
}

function getActualSpend(categoryName: string): number {
  const match = monthlySummary.value.find(s => s.category === categoryName)
  return match ? match.total : 0
}

function getSpendStatus(categoryName: string, limit: number): 'under' | 'near' | 'over' {
  const actual = getActualSpend(categoryName)
  if (actual > limit) return 'over'
  if (actual > limit * 0.8) return 'near'
  return 'under'
}

function getBarColor(actual: number, limit: number): string {
  if (actual > limit) return '#f87171'
  if (actual > limit * 0.8) return '#fbbf24'
  return '#4ade80'
}

const chartData = computed(() => {
  const labels = categories.value.map(c => c.name)
  const budgetData = categories.value.map(c => c.monthlyLimit)
  const actualData = categories.value.map(c => getActualSpend(c.name))
  const actualColors = categories.value.map(c => getBarColor(getActualSpend(c.name), c.monthlyLimit))

  return {
    labels,
    datasets: [
      {
        label: 'Budget',
        data: budgetData,
        backgroundColor: 'rgba(96, 165, 250, 0.6)',
        borderColor: '#60a5fa',
        borderWidth: 1
      },
      {
        label: 'Actual',
        data: actualData,
        backgroundColor: actualColors,
        borderColor: actualColors,
        borderWidth: 1
      }
    ]
  }
})

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#ffffff',
        generateLabels: () => [
          { text: 'Budget', fillStyle: 'rgba(96, 165, 250, 0.6)', strokeStyle: '#60a5fa', lineWidth: 1, fontColor: '#ffffff' },
          { text: 'Under Budget', fillStyle: '#4ade80', strokeStyle: '#4ade80', lineWidth: 1, fontColor: '#ffffff' },
          { text: 'Near Budget (>80%)', fillStyle: '#fbbf24', strokeStyle: '#fbbf24', lineWidth: 1, fontColor: '#ffffff' },
          { text: 'Over Budget', fillStyle: '#f87171', strokeStyle: '#f87171', lineWidth: 1, fontColor: '#ffffff' }
        ]
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          return `${context.dataset.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}`
        }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', callback: (value: any) => '$' + value },
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    },
    y: {
      ticks: { color: '#e2e8f0' },
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    }
  }
}))

async function loadBudget() {
  loading.value = true
  try {
    const start = formatDateStr(startDate.value)
    const end = formatDateStr(endDate.value)
    const [cats, summary] = await Promise.all([
      getBudgetCategories(),
      getTransactionDateRangeSummary(start, end)
    ])
    categories.value = cats
    monthlySummary.value = summary
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingCategory.value = null
  dialogVisible.value = true
}

function openEdit(cat: BudgetCategory) {
  editingCategory.value = cat
  dialogVisible.value = true
}

async function onSave(data: { name: string; monthlyLimit: number; color: string }) {
  if (editingCategory.value) {
    await updateBudgetCategory(editingCategory.value._id, data)
  } else {
    await createBudgetCategory(data)
  }
  dialogVisible.value = false
  await loadBudget()
}

async function onDelete(cat: BudgetCategory) {
  await deleteBudgetCategory(cat._id)
  await loadBudget()
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

onMounted(loadBudget)
</script>

<style scoped>
.budget-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.view-toolbar {
  display: flex;
  justify-content: flex-start;
}

.date-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.quick-filters {
  display: flex;
  gap: 6px;
}

.date-range-pickers {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-separator {
  color: #94a3b8;
  font-size: 0.875rem;
}

.chart-container {
  height: 300px;
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  padding: 16px;
}

.color-swatch {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 4px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #94a3b8;
  font-size: 0.95rem;
  justify-content: center;
}

.actual-under {
  color: #4ade80;
  font-weight: 600;
}

.actual-near {
  color: #fbbf24;
  font-weight: 600;
}

.actual-over {
  color: #f87171;
  font-weight: 600;
}
</style>
