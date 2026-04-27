<template>
  <div class="projection-view">
    <!-- Tab Toggle -->
    <div class="tab-toggle">
      <button class="tab-btn" :class="{ active: activeTab === 'future' }" @click="activeTab = 'future'">
        <i class="pi pi-chart-line"></i> Future Projection
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
        <i class="pi pi-history"></i> History
      </button>
    </div>

    <!-- FUTURE PROJECTION TAB -->
    <template v-if="activeTab === 'future'">
      <div class="settings-panel">
        <div class="horizon-row">
          <label>Time Horizon</label>
          <div class="horizon-controls">
            <input type="range" :min="1" :max="30" v-model.number="years" class="horizon-slider" />
            <span class="horizon-value">{{ years }} {{ years === 1 ? 'year' : 'years' }}</span>
          </div>
        </div>

        <div class="accounts-table-wrapper">
          <table class="accounts-table">
            <thead>
              <tr>
                <th><input type="checkbox" v-model="allSelected" @change="toggleAll" /></th>
                <th>Account</th>
                <th>Type</th>
                <th>Current Balance</th>
                <th>Annual Rate (%)</th>
                <th>Monthly Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in accountSettings" :key="item.account._id">
                <td><input type="checkbox" v-model="item.enabled" /></td>
                <td class="account-name">{{ item.account.name }}</td>
                <td><span class="account-type-badge">{{ formatType(item.account.type) }}</span></td>
                <td class="balance-cell">{{ formatCurrency(item.account.balance) }}</td>
                <td>
                  <input type="number" v-model.number="item.annualRate" step="0.1" min="0" max="100" class="rate-input" :disabled="!item.enabled" />
                </td>
                <td>
                  <input type="number" v-model.number="item.monthlyContribution" step="50" min="0" class="contribution-input" :disabled="!item.enabled" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="accountSettings.length === 0" class="empty-state">
          <i class="pi pi-info-circle"></i>
          <span>No accounts found. Add accounts first to use projections.</span>
        </div>
      </div>

      <div class="chart-panel" v-if="enabledAccounts.length > 0">
        <h3>Projected Growth</h3>
        <div class="chart-container">
          <Line :data="chartData" :options="chartOptions" />
        </div>
        <div class="projection-summary">
          <div class="summary-item">
            <span class="summary-label">Starting Net Worth</span>
            <span class="summary-value">{{ formatCurrency(startingNetWorth) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Projected Net Worth ({{ years }}yr)</span>
            <span class="summary-value text-income">{{ formatCurrency(projectedNetWorth) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Growth</span>
            <span class="summary-value text-income">{{ formatCurrency(projectedNetWorth - startingNetWorth) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Contributions</span>
            <span class="summary-value">{{ formatCurrency(totalContributions) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Interest Earned</span>
            <span class="summary-value text-income">{{ formatCurrency(projectedNetWorth - startingNetWorth - totalContributions) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- HISTORY TAB -->
    <template v-if="activeTab === 'history'">
      <HistoricalNetWorth ref="historyRef" @reloaded="onHistoryReloaded" />

      <template v-if="historyRef?.filteredRows?.length">
        <!-- History Data Table -->
        <div class="settings-panel">
          <div class="history-table-header">
            <h3 style="color: #f1f5f9;">Account History Data</h3>
            <button class="add-entry-btn" @click="startAddEntry('')" title="Add new entry">
              <i class="pi pi-plus"></i> Add Entry
            </button>
          </div>

          <div class="accounts-table-wrapper">
            <table class="accounts-table history-data-table">
              <thead>
                <tr>
                  <th class="sortable-th" @click="toggleSort('date')">
                    Date <i :class="sortIcon('date')"></i>
                  </th>
                  <th class="sortable-th" @click="toggleSort('value')">
                    Value <i :class="sortIcon('value')"></i>
                  </th>
                  <th class="sortable-th" @click="toggleSort('tag')">
                    Tag <i :class="sortIcon('tag')"></i>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="item in paginatedItems" :key="item.type === 'header' ? 'h-' + item.account : 'e-' + item.row.account_name + item.row.date">
                  <!-- Account group header -->
                  <tr v-if="item.type === 'header'" class="group-header-row" @click="toggleCollapse(item.account)">
                    <td colspan="4">
                      <div class="group-header-content">
                        <i :class="item.collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" class="collapse-icon"></i>
                        <span class="group-account-name">{{ item.account }}</span>
                        <span class="group-entry-count">{{ item.count }} {{ item.count === 1 ? 'entry' : 'entries' }}</span>
                        <button class="group-add-btn" title="Add entry" @click.stop="startAddEntry(item.account)">
                          <i class="pi pi-plus"></i>
                        </button>
                        <button class="group-clear-tag-btn" title="Clear all tags for this account" @click.stop="onClearTag(item.account)">
                          <i class="pi pi-tag"></i> Clear Tags
                        </button>
                      </div>
                    </td>
                  </tr>
                  <!-- Entry row -->
                  <tr v-else class="entry-row">
                    <td>{{ item.row.date }}</td>
                    <td class="balance-cell">
                      <input
                        v-if="isEditingValue(item.row.account_name, item.row.date)"
                        type="text"
                        v-model="editingValue"
                        class="edit-input"
                        @blur="saveEditValue"
                        @keyup.enter="saveEditValue"
                      />
                      <span v-else class="editable-cell" @click="startEditValue(item.row.account_name, item.row.date)">
                        {{ formatCurrency(item.row.value) }}
                      </span>
                    </td>
                    <td class="tag-cell">
                      <input
                        v-if="isEditingTag(item.row.account_name, item.row.date)"
                        type="text"
                        v-model="editingTagValue"
                        class="edit-input tag-input"
                        @blur="saveEditTag"
                        @keyup.enter="saveEditTag"
                      />
                      <span v-else class="editable-cell" @click="startEditTag(item.row.account_name, item.row.date)">
                        {{ item.row.tag || '—' }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button
                        v-if="item.row.tag"
                        class="clear-tag-btn"
                        title="Clear tag"
                        @click="onClearTag(item.row.account_name)"
                      >×</button>
                      <button
                        class="delete-entry-btn"
                        title="Delete entry"
                        @click="onDeleteEntry(item.row.account_name, item.row.date)"
                      ><i class="pi pi-trash"></i></button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="pagination-bar">
            <div class="pagination-info">
              Showing {{ paginationStart }}–{{ paginationEnd }} of {{ visibleEntryCount }} entries ({{ totalEntries }} total)
            </div>
            <div class="pagination-controls">
              <label class="page-size-label">Rows:
                <select v-model.number="pageSize" class="page-size-select">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                </select>
              </label>
              <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--">
                <i class="pi pi-chevron-left"></i>
              </button>
              <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
              <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">
                <i class="pi pi-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Add Entry Dialog -->
        <Dialog v-model:visible="addEntryVisible" :header="'Add Entry' + (addEntryAccount ? ' — ' + addEntryAccount : '')" modal :style="{ width: '400px' }">
          <div class="add-entry-form">
            <div v-if="!addEntryAccount" class="add-entry-field">
              <label>Account</label>
              <select v-model="addEntryAccountSelect" class="add-entry-input">
                <option value="" disabled>Select account</option>
                <option v-for="acct in historyRef.allAccounts" :key="acct" :value="acct">{{ acct }}</option>
              </select>
              <small v-if="addEntryAccountError" class="field-error">{{ addEntryAccountError }}</small>
            </div>
            <div class="add-entry-field">
              <label>Date (MM-DD-YYYY)</label>
              <input
                type="text"
                v-model="addEntryDate"
                placeholder="MM-DD-YYYY"
                class="add-entry-input"
                :class="{ 'input-error': addEntryDateError }"
              />
              <small v-if="addEntryDateError" class="field-error">{{ addEntryDateError }}</small>
            </div>
            <div class="add-entry-field">
              <label>Value ($)</label>
              <input
                type="text"
                v-model="addEntryValue"
                placeholder="0.00"
                class="add-entry-input"
                :class="{ 'input-error': addEntryValueError }"
              />
              <small v-if="addEntryValueError" class="field-error">{{ addEntryValueError }}</small>
            </div>
            <div class="add-entry-actions">
              <button class="cancel-btn" @click="addEntryVisible = false">Cancel</button>
              <button class="confirm-btn" @click="confirmAddEntry">Add</button>
            </div>
          </div>
        </Dialog>
      </template>
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
import type { Account, AccountHistoryEntry } from '@/types'
import { getAccounts, updateHistoryEntry, clearAccountTags, addHistoryEntry, deleteHistoryEntry } from '@/services/api'
import { useToast } from 'primevue/usetoast'
import HistoricalNetWorth from '@/components/HistoricalNetWorth.vue'
import Dialog from 'primevue/dialog'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface AccountProjectionSettings {
  account: Account
  enabled: boolean
  annualRate: number
  monthlyContribution: number
}

const years = ref(10)
const accountSettings = ref<AccountProjectionSettings[]>([])
const activeTab = ref<'future' | 'history'>('future')
const toast = useToast()
const historyRef = ref<InstanceType<typeof HistoricalNetWorth> | null>(null)

// Editing state
const editingCell = ref<{ account: string; date: string } | null>(null)
const editingValue = ref('')
const editingTagCell = ref<{ account: string; date: string } | null>(null)
const editingTagValue = ref('')

// Sorting state — applies within each account group
const sortField = ref<'date' | 'value' | 'tag'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')

function toggleSort(field: 'date' | 'value' | 'tag') {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = field === 'value' ? 'desc' : 'asc'
  }
  currentPage.value = 1
}

function sortIcon(field: string): string {
  if (sortField.value !== field) return 'pi pi-sort-alt'
  return sortOrder.value === 'asc' ? 'pi pi-sort-amount-up' : 'pi pi-sort-amount-down'
}

function parseDateForSort(dateStr: string): number {
  const [mm, dd, yyyy] = dateStr.split('-').map(Number)
  return new Date(yyyy, mm - 1, dd).getTime()
}

interface GroupedAccount {
  account: string
  entries: AccountHistoryEntry[]
}

const groupedData = computed<GroupedAccount[]>(() => {
  const rows = historyRef.value?.filteredRows ?? []
  const map = new Map<string, AccountHistoryEntry[]>()
  for (const row of rows) {
    if (!map.has(row.account_name)) map.set(row.account_name, [])
    map.get(row.account_name)!.push(row)
  }

  const dir = sortOrder.value === 'asc' ? 1 : -1
  const groups: GroupedAccount[] = []
  for (const [account, entries] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...entries].sort((a, b) => {
      let cmp = 0
      switch (sortField.value) {
        case 'date':
          cmp = parseDateForSort(a.date) - parseDateForSort(b.date)
          break
        case 'value':
          cmp = a.value - b.value
          break
        case 'tag':
          cmp = (a.tag ?? '').localeCompare(b.tag ?? '')
          break
      }
      return cmp * dir
    })
    groups.push({ account, entries: sorted })
  }
  return groups
})

const totalEntries = computed(() => groupedData.value.reduce((sum, g) => sum + g.entries.length, 0))

// Collapsed accounts state — all collapsed by default
const collapsedAccounts = ref<Set<string>>(new Set())
const initialCollapseApplied = ref(false)

watch(groupedData, (groups) => {
  if (!initialCollapseApplied.value && groups.length > 0) {
    collapsedAccounts.value = new Set(groups.map(g => g.account))
    initialCollapseApplied.value = true
  }
})

function toggleCollapse(account: string) {
  const s = new Set(collapsedAccounts.value)
  if (s.has(account)) s.delete(account)
  else s.add(account)
  collapsedAccounts.value = s
}

// Pagination state
const currentPage = ref(1)
const pageSize = ref(20)

// Count visible entries (excluding collapsed)
const visibleEntryCount = computed(() => {
  return groupedData.value.reduce((sum, g) => {
    return sum + (collapsedAccounts.value.has(g.account) ? 0 : g.entries.length)
  }, 0)
})

const totalPages = computed(() => Math.max(1, Math.ceil(visibleEntryCount.value / pageSize.value)))
const paginationStart = computed(() => Math.min((currentPage.value - 1) * pageSize.value + 1, visibleEntryCount.value))
const paginationEnd = computed(() => Math.min(currentPage.value * pageSize.value, visibleEntryCount.value))

// Paginate across groups, producing display items (group headers + entries)
type DisplayItem =
  | { type: 'header'; account: string; count: number; collapsed: boolean }
  | { type: 'entry'; row: AccountHistoryEntry }

const paginatedItems = computed<DisplayItem[]>(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  let idx = 0
  const items: DisplayItem[] = []
  let lastAccount = ''

  for (const group of groupedData.value) {
    const isCollapsed = collapsedAccounts.value.has(group.account)

    if (isCollapsed) {
      // Show header only, no entries count toward pagination
      if (idx >= start && idx < end) {
        // Only show if we're in range of visible items, but collapsed headers always show between visible entries
      }
      // Always inject the collapsed header when we're on a page where surrounding entries exist
      if (items.length > 0 || idx >= start) {
        items.push({ type: 'header', account: group.account, count: group.entries.length, collapsed: true })
      }
      continue
    }

    for (const entry of group.entries) {
      if (idx >= end) break
      if (idx >= start) {
        if (group.account !== lastAccount) {
          items.push({ type: 'header', account: group.account, count: group.entries.length, collapsed: false })
          lastAccount = group.account
        }
        items.push({ type: 'entry', row: entry })
      }
      idx++
    }
    if (idx >= end) break
  }
  return items
})

// Reset page when filtered data changes
watch(() => historyRef.value?.filteredRows?.length, () => {
  currentPage.value = 1
})

const allSelected = computed({
  get: () => accountSettings.value.length > 0 && accountSettings.value.every(a => a.enabled),
  set: () => {}
})

function toggleAll() {
  const newVal = !accountSettings.value.every(a => a.enabled)
  accountSettings.value.forEach(a => a.enabled = newVal)
}

const enabledAccounts = computed(() => accountSettings.value.filter(a => a.enabled))

function getDefaultRate(type: string): number {
  switch (type) {
    case 'investment': return 7
    case 'retirement': return 7
    case 'savings': return 4.5
    case 'checking': return 0.5
    case 'credit_card': return 0
    case 'cash': return 0
    default: return 2
  }
}

onMounted(async () => {
  try {
    const accounts = await getAccounts()
    accountSettings.value = accounts.map(account => ({
      account,
      enabled: true,
      annualRate: getDefaultRate(account.type),
      monthlyContribution: 0
    }))
  } catch {
    // API not available
  }
})

function projectAccount(balance: number, annualRate: number, monthlyContribution: number, months: number): number[] {
  const values: number[] = [balance]
  const monthlyRate = annualRate / 100 / 12
  let current = balance
  for (let m = 1; m <= months; m++) {
    current = current * (1 + monthlyRate) + monthlyContribution
    values.push(current)
  }
  return values
}

const totalMonths = computed(() => years.value * 12)

const projectionData = computed(() => {
  const months = totalMonths.value
  const accountProjections: { name: string; values: number[]; color: string }[] = []

  const colors = ['#38bdf8', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#f472b6', '#2dd4bf', '#fb923c']

  enabledAccounts.value.forEach((item, idx) => {
    accountProjections.push({
      name: item.account.name,
      values: projectAccount(item.account.balance, item.annualRate, item.monthlyContribution, months),
      color: colors[idx % colors.length]
    })
  })

  // Calculate total net worth line
  const totalValues: number[] = []
  for (let m = 0; m <= months; m++) {
    let total = 0
    for (const proj of accountProjections) {
      total += proj.values[m]
    }
    totalValues.push(total)
  }

  return { accountProjections, totalValues }
})

const startingNetWorth = computed(() =>
  enabledAccounts.value.reduce((sum, a) => sum + a.account.balance, 0)
)

const projectedNetWorth = computed(() => {
  const { totalValues } = projectionData.value
  return totalValues.length > 0 ? totalValues[totalValues.length - 1] : 0
})

const totalContributions = computed(() =>
  enabledAccounts.value.reduce((sum, a) => sum + a.monthlyContribution * totalMonths.value, 0)
)

// Build labels: show yearly markers
const chartLabels = computed(() => {
  const labels: string[] = []
  for (let m = 0; m <= totalMonths.value; m++) {
    if (m % 12 === 0) {
      labels.push(`Year ${m / 12}`)
    } else {
      labels.push('')
    }
  }
  return labels
})

const chartData = computed(() => {
  const { accountProjections, totalValues } = projectionData.value
  const datasets = []

  // Per-account lines
  if (enabledAccounts.value.length > 1) {
    for (const proj of accountProjections) {
      datasets.push({
        label: proj.name,
        data: proj.values,
        borderColor: proj.color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3
      })
    }
  }

  // Total net worth line
  datasets.push({
    label: 'Total Net Worth',
    data: totalValues,
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 3,
    pointRadius: 0,
    tension: 0.3,
    fill: true
  })

  return { labels: chartLabels.value, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: {
      labels: { color: '#94a3b8' }
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
      }
    }
  },
  scales: {
    x: {
      ticks: {
        color: '#64748b',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: years.value + 1
      },
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

// --- HISTORY ---

// Tag map from component's history rows (for editing)
function getHistoryTag(account: string, date: string): string {
  const rows = historyRef.value?.historyRows ?? []
  const row = rows.find((r: AccountHistoryEntry) => r.account_name === account && r.date === date)
  return row?.tag ?? ''
}

function onHistoryReloaded(_rows: AccountHistoryEntry[]) {
  // Component handles its own state; this is a hook for future use
}

// Editing functions
function startEditValue(account: string, date: string) {
  editingCell.value = { account, date }
  const val = historyRef.value?.getValue(account, date) ?? 0
  editingValue.value = val.toFixed(2)
}

async function saveEditValue() {
  if (!editingCell.value) return
  const { account, date } = editingCell.value
  const newVal = Math.round(parseFloat(editingValue.value || '0') * 100) / 100
  const tag = getHistoryTag(account, date)
  await updateHistoryEntry({ account_name: account, date, value: newVal, tag })
  // Update the component's data
  const rows = historyRef.value?.historyRows ?? []
  const row = rows.find((r: AccountHistoryEntry) => r.account_name === account && r.date === date)
  if (row) row.value = newVal
  editingCell.value = null
}

function startEditTag(account: string, date: string) {
  editingTagCell.value = { account, date }
  editingTagValue.value = getHistoryTag(account, date)
}

async function saveEditTag() {
  if (!editingTagCell.value) return
  const { account, date } = editingTagCell.value
  const value = historyRef.value?.getValue(account, date) ?? 0
  const newTag = editingTagValue.value.trim()
  await updateHistoryEntry({ account_name: account, date, value, tag: newTag })
  const rows = historyRef.value?.historyRows ?? []
  const row = rows.find((r: AccountHistoryEntry) => r.account_name === account && r.date === date)
  if (row) row.tag = newTag
  editingTagCell.value = null
}

function isEditingValue(account: string, date: string): boolean {
  return editingCell.value?.account === account && editingCell.value?.date === date
}

function isEditingTag(account: string, date: string): boolean {
  return editingTagCell.value?.account === account && editingTagCell.value?.date === date
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Clear tag for an account
async function onClearTag(account: string) {
  await clearAccountTags(account)
  // Update all rows for this account in the component's data
  const rows = historyRef.value?.historyRows ?? []
  rows.forEach((r: AccountHistoryEntry) => {
    if (r.account_name === account) r.tag = ''
  })
  toast.add({ severity: 'info', summary: 'Tag Cleared', detail: `Tag removed from ${account}`, life: 2000 })
}

// Delete entry
async function onDeleteEntry(accountName: string, date: string) {
  await deleteHistoryEntry({ account_name: accountName, date })
  await historyRef.value?.reload()
  toast.add({ severity: 'warn', summary: 'Entry Deleted', detail: `Removed ${date} from ${accountName}`, life: 2000 })
}

// Add entry
const addEntryVisible = ref(false)
const addEntryAccount = ref('')
const addEntryAccountSelect = ref('')
const addEntryDate = ref('')
const addEntryValue = ref('')
const addEntryDateError = ref('')
const addEntryValueError = ref('')
const addEntryAccountError = ref('')

function startAddEntry(account: string) {
  addEntryAccount.value = account
  addEntryAccountSelect.value = account
  addEntryDate.value = ''
  addEntryValue.value = ''
  addEntryDateError.value = ''
  addEntryValueError.value = ''
  addEntryAccountError.value = ''
  addEntryVisible.value = true
}

function validateDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return false
  const [, mm, dd, yyyy] = match
  const month = parseInt(mm), day = parseInt(dd), year = parseInt(yyyy)
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return false
  const d = new Date(year, month - 1, day)
  return d.getMonth() === month - 1 && d.getDate() === day
}

async function confirmAddEntry() {
  addEntryDateError.value = ''
  addEntryValueError.value = ''
  addEntryAccountError.value = ''
  let valid = true

  const targetAccount = addEntryAccount.value || addEntryAccountSelect.value
  if (!targetAccount) {
    addEntryAccountError.value = 'Select an account'
    valid = false
  }

  if (!validateDate(addEntryDate.value)) {
    addEntryDateError.value = 'Enter a valid date in MM-DD-YYYY format'
    valid = false
  }

  const numVal = parseFloat(addEntryValue.value)
  if (isNaN(numVal)) {
    addEntryValueError.value = 'Enter a valid number'
    valid = false
  }

  if (!valid) return

  const rounded = Math.round(numVal * 100) / 100
  await addHistoryEntry({ account_name: targetAccount, date: addEntryDate.value, value: rounded })
  await historyRef.value?.reload()
  addEntryVisible.value = false
  toast.add({ severity: 'success', summary: 'Entry Added', detail: `Added ${addEntryDate.value} to ${targetAccount}`, life: 2000 })
}
</script>

<style scoped>
.projection-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.projection-view h2 {
  color: #f1f5f9;
  font-size: 1.5rem;
  margin: 0;
}

.tab-toggle {
  display: flex;
  gap: 0;
  background-color: #1e293b;
  border-radius: 8px;
  padding: 4px;
  width: fit-content;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #e2e8f0;
}

.tab-btn.active {
  background-color: #38bdf8;
  color: #0f172a;
  font-weight: 600;
}

.text-expense {
  color: #f87171;
}

.settings-panel {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 24px;
}

.horizon-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.horizon-row label {
  color: #94a3b8;
  font-weight: 600;
  min-width: 110px;
}

.horizon-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.horizon-slider {
  flex: 1;
  accent-color: #38bdf8;
  height: 6px;
}

.horizon-value {
  color: #f1f5f9;
  font-weight: 700;
  font-size: 1.1rem;
  min-width: 80px;
}

.accounts-table-wrapper {
  overflow-x: auto;
}

.accounts-table {
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
}

.accounts-table th {
  text-align: left;
  padding: 10px 12px;
  color: #94a3b8;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #334155;
}

.accounts-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
}

.accounts-table input[type="checkbox"] {
  accent-color: #38bdf8;
  width: 16px;
  height: 16px;
}

.account-name {
  font-weight: 600;
}

.account-type-badge {
  background-color: #334155;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #94a3b8;
}

.balance-cell {
  font-weight: 600;
  color: #38bdf8;
}

.rate-input,
.contribution-input {
  width: 100px;
  padding: 6px 10px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 0.9rem;
  text-align: right;
}

.rate-input:disabled,
.contribution-input:disabled {
  opacity: 0.4;
}

.rate-input:focus,
.contribution-input:focus {
  outline: none;
  border-color: #38bdf8;
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

.chart-container {
  height: 400px;
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
/* Editable cells */
.editable-cell {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.editable-cell:hover {
  background-color: #334155;
}

.edit-input {
  width: 100%;
  padding: 4px 6px;
  background-color: #0f172a;
  border: 1px solid #38bdf8;
  border-radius: 4px;
  color: #f1f5f9;
  font-size: 0.85rem;
  text-align: right;
}

.edit-input:focus {
  outline: none;
}

.tag-input {
  text-align: left;
  min-width: 60px;
}

.tag-cell {
  min-width: 80px;
}

.history-data-table .total-row td {
  border-top: 2px solid #334155;
}

.group-header-row td {
  background-color: #1a2744;
  padding: 8px 12px !important;
  border-bottom: 1px solid #334155;
}

.group-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-account-name {
  font-weight: 700;
  color: #38bdf8;
  font-size: 0.9rem;
}

.group-entry-count {
  color: #64748b;
  font-size: 0.75rem;
}

.group-add-btn {
  background: none;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #38bdf8;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.7rem;
  transition: all 0.15s;
  margin-left: auto;
}

.group-add-btn:hover {
  background-color: #38bdf8;
  color: #0f172a;
}

.group-clear-tag-btn {
  background: none;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 0.7rem;
  transition: all 0.15s;
}

.group-clear-tag-btn:hover {
  background-color: #f87171;
  color: #0f172a;
  border-color: #f87171;
}

.entry-row td {
  padding-left: 20px !important;
}

.collapse-icon {
  font-size: 0.75rem;
  color: #64748b;
  transition: transform 0.15s;
}

.group-header-row {
  cursor: pointer;
}

.group-header-row:hover td {
  background-color: #1e3354 !important;
}

.delete-entry-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.7rem;
  transition: color 0.15s;
  margin-left: 4px;
}

.delete-entry-btn:hover {
  color: #f87171;
}

.history-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.sortable-th:hover {
  color: #38bdf8;
}

.sortable-th i {
  font-size: 0.7rem;
  margin-left: 4px;
  opacity: 0.6;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 8px 0;
  border-top: 1px solid #1e293b;
}

.pagination-info {
  color: #64748b;
  font-size: 0.8rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-label {
  color: #94a3b8;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-size-select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #f1f5f9;
  padding: 3px 6px;
  font-size: 0.8rem;
}

.page-btn {
  background: none;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background-color: #334155;
  color: #f1f5f9;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-indicator {
  color: #94a3b8;
  font-size: 0.8rem;
  min-width: 50px;
  text-align: center;
}

.clear-tag-btn {
  background: none;
  border: none;
  color: #f87171;
  font-size: 1rem;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.clear-tag-btn:hover {
  opacity: 1;
}

.actions-cell {
  text-align: center;
  white-space: nowrap;
}

.add-entry-btn {
  background: none;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #38bdf8;
  cursor: pointer;
  padding: 3px 8px;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.add-entry-btn:hover {
  background-color: #38bdf8;
  color: #0f172a;
}

.add-entry-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.add-entry-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.add-entry-field label {
  font-size: 0.8rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-entry-input {
  padding: 8px 12px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 0.9rem;
}

.add-entry-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.add-entry-input.input-error {
  border-color: #f87171;
}

.field-error {
  color: #f87171;
  font-size: 0.75rem;
}

.add-entry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.cancel-btn {
  padding: 8px 16px;
  background-color: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.85rem;
  cursor: pointer;
}

.confirm-btn {
  padding: 8px 16px;
  background-color: #38bdf8;
  border: none;
  border-radius: 6px;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.confirm-btn:hover {
  background-color: #7dd3fc;
}
</style>
