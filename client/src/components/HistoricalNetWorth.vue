<template>
  <div class="historical-net-worth">
    <div v-if="historyRows.length === 0" class="empty-state">
      <i class="pi pi-info-circle"></i>
      <span>No history data. Import an Excel file to see historical account progression.</span>
      <ExcelImport v-if="!compact" @imported="reload" style="margin-top: 16px;" />
    </div>

    <template v-else>
      <div class="chart-panel">
        <div class="chart-header-row">
          <h3>Historical Net Worth</h3>
          <div v-if="!compact" class="chart-header-actions">
            <ExcelImport @imported="reload" />
            <button v-if="!confirmingClear" class="clear-history-btn" @click="confirmingClear = true">
              <i class="pi pi-trash"></i> Clear
            </button>
            <template v-else>
              <button class="clear-history-confirm" @click="clearHistory">Confirm</button>
              <button class="clear-history-cancel" @click="confirmingClear = false">Cancel</button>
            </template>
          </div>
        </div>

        <template v-if="!compact">
          <div class="history-filter-bar">
            <div class="filter-group">
              <label>Date From</label>
              <DatePicker v-model="filterDateFrom" dateFormat="mm-dd-yy" placeholder="MM-DD-YYYY" showIcon :showOnFocus="false" class="filter-datepicker" />
            </div>
            <div class="filter-group">
              <label>Date To</label>
              <DatePicker v-model="filterDateTo" dateFormat="mm-dd-yy" placeholder="MM-DD-YYYY" showIcon :showOnFocus="false" class="filter-datepicker" />
            </div>
            <div class="filter-group">
              <label>Tags</label>
              <MultiSelect v-model="filterTags" :options="allTags" placeholder="All Tags" :maxSelectedLabels="2" class="filter-multiselect" />
            </div>
          </div>

          <div class="account-filter-row">
            <label>Accounts:</label>
            <button class="filter-link" @click="filterAccounts = [...allAccounts]">All</button>
            <button class="filter-link" @click="filterAccounts = []">None</button>
            <label v-for="acct in allAccounts" :key="acct" class="account-checkbox">
              <input type="checkbox" :checked="filterAccounts.includes(acct)" @change="toggleAccount(acct)" />
              {{ acct }}
            </label>
          </div>
        </template>

        <div class="chart-container" :class="{ 'chart-compact': compact }">
          <Line :data="chartData" :options="chartOptions" />
        </div>

        <div class="projection-summary">
          <div class="summary-item">
            <span class="summary-label">Date Range</span>
            <span class="summary-value">{{ dates[0] }} — {{ dates[dates.length - 1] }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Starting Net Worth</span>
            <span class="summary-value">{{ formatCurrency(startNetWorth) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Current Net Worth</span>
            <span class="summary-value text-income">{{ formatCurrency(endNetWorth) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Change</span>
            <span class="summary-value" :class="endNetWorth - startNetWorth >= 0 ? 'text-income' : 'text-expense'">
              {{ formatCurrency(endNetWorth - startNetWorth) }}
              <span class="pct-change">({{ percentChange }})</span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { AccountHistoryEntry } from '@/types'
import { getAccountHistory, deleteHistory } from '@/services/api'
import { useToast } from 'primevue/usetoast'
import ExcelImport from '@/components/ExcelImport.vue'
import DatePicker from 'primevue/datepicker'
import MultiSelect from 'primevue/multiselect'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), { compact: false })

const emit = defineEmits<{
  (e: 'reloaded', rows: AccountHistoryEntry[]): void
}>()

const toast = useToast()
const historyRows = ref<AccountHistoryEntry[]>([])
const confirmingClear = ref(false)

// Filters (only used when not compact)
const filterDateFrom = ref<Date | null>(null)
const filterDateTo = ref<Date | null>(null)
const filterAccounts = ref<string[]>([])
const filterTags = ref<string[]>([])

const allAccounts = computed(() => {
  const s = new Set(historyRows.value.map(r => r.account_name))
  return [...s].sort()
})

const allTags = computed(() => {
  // Show tags only from rows matching current date and account filters (excluding tag filter itself)
  const fromStr = filterDateFrom.value ? dateToFilterStr(filterDateFrom.value) : ''
  const toStr = filterDateTo.value ? dateToFilterStr(filterDateTo.value) : ''
  const relevant = historyRows.value.filter(row => {
    if (filterAccounts.value.length > 0 && !filterAccounts.value.includes(row.account_name)) return false
    if (fromStr && row.date < fromStr) return false
    if (toStr && row.date > toStr) return false
    return true
  })
  const s = new Set(relevant.map(r => r.tag || '(Untagged)'))
  return [...s].sort()
})

watch(allAccounts, (accts) => {
  if (filterAccounts.value.length === 0 && accts.length > 0) {
    filterAccounts.value = [...accts]
  }
}, { immediate: true })

// Remove stale tag selections when available tags change
watch(allTags, (tags) => {
  if (filterTags.value.length > 0) {
    filterTags.value = filterTags.value.filter(t => tags.includes(t))
  }
})

function dateToFilterStr(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}-${d.getFullYear()}`
}

const filteredRows = computed(() => {
  if (props.compact) return historyRows.value
  const fromStr = filterDateFrom.value ? dateToFilterStr(filterDateFrom.value) : ''
  const toStr = filterDateTo.value ? dateToFilterStr(filterDateTo.value) : ''
  return historyRows.value.filter(row => {
    if (filterAccounts.value.length > 0 && !filterAccounts.value.includes(row.account_name)) return false
    if (fromStr && row.date < fromStr) return false
    if (toStr && row.date > toStr) return false
    if (filterTags.value.length > 0) {
      const tagMatch = row.tag ? filterTags.value.includes(row.tag) : filterTags.value.includes('(Untagged)')
      if (!tagMatch) return false
    }
    return true
  })
})

const dates = computed(() => {
  const s = new Set(filteredRows.value.map(r => r.date))
  return [...s].sort((a, b) => {
    const [am, ad, ay] = a.split('-').map(Number)
    const [bm, bd, by] = b.split('-').map(Number)
    return new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()
  })
})

const accounts = computed(() => {
  const s = new Set(filteredRows.value.map(r => r.account_name))
  return [...s].sort()
})

const valueMap = computed(() => {
  const map: Record<string, Record<string, number>> = {}
  for (const row of filteredRows.value) {
    if (!map[row.account_name]) map[row.account_name] = {}
    map[row.account_name][row.date] = row.value
  }
  return map
})

function getValue(account: string, date: string): number {
  return valueMap.value[account]?.[date] ?? 0
}

function getTotal(date: string): number {
  return accounts.value.reduce((sum, acct) => sum + getValue(acct, date), 0)
}

const startNetWorth = computed(() =>
  dates.value.length > 0 ? getTotal(dates.value[0]) : 0
)

const endNetWorth = computed(() =>
  dates.value.length > 0 ? getTotal(dates.value[dates.value.length - 1]) : 0
)

const percentChange = computed(() => {
  const change = endNetWorth.value - startNetWorth.value
  if (startNetWorth.value === 0) return change === 0 ? '0.0%' : '∞'
  const pct = (change / Math.abs(startNetWorth.value)) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
})

const chartColors = ['#38bdf8', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#f472b6', '#2dd4bf', '#fb923c']

const chartData = computed(() => {
  const datasets: any[] = []
  accounts.value.forEach((acct, idx) => {
    datasets.push({
      label: acct,
      data: dates.value.map(d => getValue(acct, d)),
      borderColor: chartColors[idx % chartColors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: props.compact ? 2 : 3,
      tension: 0.3
    })
  })
  datasets.push({
    label: 'Total Net Worth',
    data: dates.value.map(d => getTotal(d)),
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 3,
    pointRadius: props.compact ? 2 : 3,
    tension: 0.3,
    fill: true
  })
  return { labels: dates.value, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { labels: { color: '#94a3b8' } },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#64748b', maxRotation: 45 },
      grid: { color: '#1e293b' }
    },
    y: {
      ticks: {
        color: '#64748b',
        callback: (value: string | number) => formatCurrency(Number(value))
      },
      grid: { color: '#1e293b' }
    }
  }
}))

function toggleAccount(account: string) {
  const idx = filterAccounts.value.indexOf(account)
  if (idx >= 0) filterAccounts.value.splice(idx, 1)
  else filterAccounts.value.push(account)
}

async function clearHistory() {
  await deleteHistory()
  historyRows.value = []
  confirmingClear.value = false
  emit('reloaded', [])
  toast.add({ severity: 'info', summary: 'History Cleared', detail: 'All account history data has been removed', life: 3000 })
}

async function reload() {
  historyRows.value = await getAccountHistory()
  emit('reloaded', historyRows.value)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

// Expose for parent components that need access to filtered data
defineExpose({
  historyRows,
  filteredRows,
  dates,
  accounts,
  allAccounts,
  allTags,
  valueMap,
  getValue,
  getTotal,
  reload,
  filterAccounts,
  filterDateFrom,
  filterDateTo,
  filterTags
})

onMounted(reload)
</script>

<style scoped>
.historical-net-worth {
  width: 100%;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #94a3b8;
  font-size: 0.95rem;
}

.chart-panel {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 24px;
}

.chart-panel h3 {
  color: #f1f5f9;
  font-size: 1rem;
  margin-bottom: 16px;
}

.chart-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header-row h3 {
  margin: 0;
}

.chart-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-container {
  height: 400px;
}

.chart-compact {
  height: 300px;
}

.projection-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #334155;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 0.8rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f1f5f9;
}

.text-income {
  color: #4ade80;
}

.text-expense {
  color: #f87171;
}

.pct-change {
  font-size: 0.85rem;
  font-weight: 600;
  opacity: 0.85;
}

/* Filter bar */
.history-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 12px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-datepicker,
.filter-multiselect {
  min-width: 160px;
  font-size: 0.85rem;
}

.account-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
  margin-bottom: 12px;
  border-top: 1px solid #334155;
}

.account-filter-row > label:first-child {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.account-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: #e2e8f0;
  cursor: pointer;
}

.account-checkbox input[type="checkbox"] {
  accent-color: #38bdf8;
}

.filter-link {
  background: none;
  border: none;
  color: #38bdf8;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.filter-link:hover {
  color: #7dd3fc;
}

.clear-history-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background-color: transparent;
  border: 1px solid #f87171;
  border-radius: 6px;
  color: #f87171;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  background-color: #f87171;
  color: #0f172a;
}

.clear-history-confirm {
  padding: 6px 14px;
  background-color: #ef4444;
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.clear-history-cancel {
  padding: 6px 14px;
  background-color: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
