<template>
  <div class="transactions-page">
    <div class="page-header">
      <div class="header-actions">
        <Button label="Add Transaction" icon="pi pi-plus" severity="success" @click="openManualAdd" />
        <Button label="Import CSV" icon="pi pi-upload" @click="showImportDialog = true" />
        <Button label="Manage Rules" icon="pi pi-cog" severity="secondary" @click="showRulesDialog = true" />
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <InputText v-model="searchText" placeholder="Search transactions..." class="search-input" @input="debouncedLoad" />
      </div>
      <div class="filter-group">
        <Select v-model="filterCategory" :options="categoryOptions" optionLabel="label" optionValue="value" placeholder="All Categories" showClear class="filter-select" @change="loadTransactions" />
      </div>
      <div class="filter-group">
        <Select v-model="filterBank" :options="bankOptions" optionLabel="label" optionValue="value" placeholder="All Banks" showClear class="filter-select" @change="loadTransactions" />
      </div>
      <div class="filter-group">
        <DatePicker v-model="filterStartDate" placeholder="Start Date" dateFormat="yy-mm-dd" showIcon class="date-filter" @date-select="loadTransactions" />
      </div>
      <div class="filter-group">
        <DatePicker v-model="filterEndDate" placeholder="End Date" dateFormat="yy-mm-dd" showIcon class="date-filter" @date-select="loadTransactions" />
      </div>
      <div class="quick-date-filters">
        <Button label="7d" size="small" :severity="quickDateActive === 7 ? 'primary' : 'secondary'" text @click="setQuickDate(7)" />
        <Button label="14d" size="small" :severity="quickDateActive === 14 ? 'primary' : 'secondary'" text @click="setQuickDate(14)" />
        <Button label="30d" size="small" :severity="quickDateActive === 30 ? 'primary' : 'secondary'" text @click="setQuickDate(30)" />
      </div>
      <Button v-if="hasActiveFilters" label="Clear Filters" icon="pi pi-times" severity="secondary" text @click="clearFilters" />
    </div>

    <!-- Bulk actions -->
    <div v-if="selectedTransactions.length > 0" class="bulk-actions">
      <span>{{ selectedTransactions.length }} selected</span>
      <Select v-model="bulkCategory" :options="categoryOptions.filter(c => c.value)" optionLabel="label" optionValue="value" placeholder="Assign Category" class="bulk-select" />
      <Button label="Apply" icon="pi pi-check" size="small" :disabled="!bulkCategory" @click="applyBulkCategory" />
      <Button label="Delete" icon="pi pi-trash" size="small" severity="danger" @click="deleteSelected" />
    </div>

    <!-- Data Table -->
    <DataTable
      :value="transactions"
      v-model:selection="selectedTransactions"
      dataKey="id"
      :loading="loading"
      stripedRows
      class="transactions-table"
    >
      <Column selectionMode="multiple" headerStyle="width: 3rem" />
      <Column field="bank" header="Bank Name" sortable style="width: 12%" />
      <Column field="date" header="Date" sortable style="width: 10%">
        <template #body="{ data }">
          {{ formatDate(data.date) }}
        </template>
      </Column>
      <Column field="description" header="Description" sortable>
        <template #body="{ data }">
          <span class="txn-description">{{ data.description }}</span>
        </template>
      </Column>
      <Column v-for="colName in customColumnNames" :key="colName" :header="colName" style="width: 10%">
        <template #body="{ data }">
          {{ data.customData?.[colName] || '' }}
        </template>
      </Column>
      <Column field="category" header="Category" sortable style="width: 16%">
        <template #body="{ data }">
          <Select
            :modelValue="data.category"
            :options="allCategoryOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Uncategorized"
            class="category-inline-select"
            v-tooltip.top="'Categories are added from the Budget page'"
            @change="(e: any) => updateCategory(data.id, e.value)"
          />
        </template>
      </Column>
      <Column field="amount" header="Amount" sortable style="width: 10%">
        <template #body="{ data }">
          <span :class="data.amount > 0 ? 'amount-debit' : 'amount-credit'">
            {{ formatCurrency(data.amount) }}
          </span>
        </template>
      </Column>
      <Column header="Actions" style="width: 6%">
        <template #body="{ data }">
          <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteSingle(data.id)" />
        </template>
      </Column>
      <template #empty>
        <div class="empty-state">
          <i class="pi pi-inbox"></i>
          <p>No transactions yet. Import a CSV or add one manually.</p>
        </div>
      </template>
    </DataTable>

    <!-- Pagination -->
    <div v-if="transactions.length > 0" class="pagination-bar">
      <span class="pagination-info">Showing {{ (currentPage - 1) * pageSize + 1 }}–{{ Math.min(currentPage * pageSize, totalCount) }} of {{ totalCount }}</span>
      <div class="pagination-controls">
        <Select v-model="pageSize" :options="pageSizeOptions" optionLabel="label" optionValue="value" class="page-size-select" @change="onPageSizeChange" />
        <Button icon="pi pi-angle-left" text :disabled="currentPage <= 1" @click="prevPage" />
        <span class="page-number">Page {{ currentPage }} of {{ totalPages }}</span>
        <Button icon="pi pi-angle-right" text :disabled="currentPage >= totalPages" @click="nextPage" />
      </div>
    </div>

    <!-- Import Dialog -->
    <ImportDialog v-model:visible="showImportDialog" :categories="budgetCategories" @imported="onImported" />

    <!-- Rules Dialog -->
    <CategoryRulesDialog v-model:visible="showRulesDialog" :categories="budgetCategories" @rulesApplied="loadTransactions" />

    <!-- Manual Add Dialog -->
    <Dialog v-model:visible="showAddDialog" header="Add Transaction" modal :style="{ width: '90vw', maxWidth: '32rem' }">
      <div class="add-form">
        <div class="form-field">
          <label>Date</label>
          <DatePicker v-model="manualDate" dateFormat="yy-mm-dd" showIcon class="w-full" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <InputText v-model="manualDescription" placeholder="e.g., Grocery Store" class="w-full" />
        </div>
        <div class="form-field">
          <label>Amount</label>
          <InputNumber v-model="manualAmount" mode="currency" currency="USD" class="w-full" />
        </div>
        <div class="form-field">
          <label>Category</label>
          <Select v-model="manualCategory" :options="allCategoryOptions" optionLabel="label" optionValue="value" placeholder="Select Category" class="w-full" />
        </div>
        <div class="form-field">
          <label>Account Label</label>
          <InputText v-model="manualAccountLabel" placeholder="e.g., Chase Freedom" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showAddDialog = false" />
        <Button label="Add" icon="pi pi-check" :disabled="!manualDescription || manualAmount === null" @click="saveManualTransaction" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import ImportDialog from '@/components/transactions/ImportDialog.vue'
import CategoryRulesDialog from '@/components/transactions/CategoryRulesDialog.vue'
import {
  getTransactions, getTransactionCount, updateTransaction,
  deleteTransaction, bulkCategorizeTransactions, getTransactionBanks,
  getBudgetCategories, importTransactions, getBankConfigs
} from '@/services/api'
import type { Transaction, BudgetCategory, BankConfig } from '@/types'

const transactions = ref<Transaction[]>([])
const selectedTransactions = ref<Transaction[]>([])
const loading = ref(false)
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const pageSizeOptions = [
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 }
]

const searchText = ref('')
const filterCategory = ref('')
const filterBank = ref('')
const filterStartDate = ref<Date | null>(null)
const filterEndDate = ref<Date | null>(null)
const bulkCategory = ref('')
const quickDateActive = ref<number | null>(null)

const budgetCategories = ref<BudgetCategory[]>([])
const bankList = ref<Array<{ bank: string; accountLabel: string }>>([])
const bankConfigs = ref<BankConfig[]>([])

const showImportDialog = ref(false)
const showRulesDialog = ref(false)
const showAddDialog = ref(false)

// Manual add form
const manualDate = ref<Date | null>(new Date())
const manualDescription = ref('')
const manualAmount = ref<number | null>(null)
const manualCategory = ref('')
const manualAccountLabel = ref('')

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

const customColumnNames = computed(() => {
  const keys = new Set<string>()
  // From transaction data
  for (const txn of transactions.value) {
    if (txn.customData && typeof txn.customData === 'object') {
      for (const k of Object.keys(txn.customData)) {
        keys.add(k)
      }
    }
  }
  // From bank configs (ensures new mappings appear even before re-import)
  for (const config of bankConfigs.value) {
    if (config.customColumns) {
      for (const col of config.customColumns) {
        if (col.displayName) keys.add(col.displayName)
      }
    }
  }
  // Exclude columns already shown as dedicated table columns
  keys.delete('Category')
  keys.delete('Date')
  keys.delete('Description')
  keys.delete('Amount')
  keys.delete('Debit')
  keys.delete('Credit')
  keys.delete('Post Date')
  return Array.from(keys)
})

const hasActiveFilters = computed(() =>
  searchText.value || filterCategory.value || filterBank.value || filterStartDate.value || filterEndDate.value
)

const categoryOptions = computed(() => {
  const opts = [{ label: 'All Categories', value: '' }]
  for (const cat of budgetCategories.value) {
    opts.push({ label: cat.name, value: cat.name })
  }
  opts.push({ label: 'Uncategorized', value: '__uncategorized' })
  return opts
})

const allCategoryOptions = computed(() => {
  return [
    { label: 'Uncategorized', value: '' },
    ...budgetCategories.value.map(c => ({ label: c.name, value: c.name }))
  ]
})

const bankOptions = computed(() => {
  const opts = [{ label: 'All Banks', value: '' }]
  const seen = new Set<string>()
  for (const b of bankList.value) {
    const label = b.accountLabel || b.bank
    if (!seen.has(label)) {
      seen.add(label)
      opts.push({ label, value: b.accountLabel || b.bank })
    }
  }
  return opts
})

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${m}/${d}/${y}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount))
}

function setQuickDate(days: number) {
  if (quickDateActive.value === days) {
    // Toggle off
    quickDateActive.value = null
    filterStartDate.value = null
    filterEndDate.value = null
  } else {
    quickDateActive.value = days
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    filterStartDate.value = start
    filterEndDate.value = end
  }
  currentPage.value = 1
  loadTransactions()
}

function buildFilters() {
  const filters: any = { limit: pageSize.value, offset: (currentPage.value - 1) * pageSize.value }
  if (searchText.value) filters.search = searchText.value
  if (filterCategory.value === '__uncategorized') {
    filters.category = ''
  } else if (filterCategory.value) {
    filters.category = filterCategory.value
  }
  if (filterBank.value) filters.bank = filterBank.value
  if (filterStartDate.value) {
    filters.startDate = filterStartDate.value.toISOString().slice(0, 10)
  }
  if (filterEndDate.value) {
    filters.endDate = filterEndDate.value.toISOString().slice(0, 10)
  }
  return filters
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadTransactions(), 300)
}

async function loadTransactions() {
  loading.value = true
  try {
    const filters = buildFilters()
    const [txns, count] = await Promise.all([
      getTransactions(filters),
      getTransactionCount(filters)
    ])
    transactions.value = txns
    totalCount.value = count
  } finally {
    loading.value = false
  }
}

async function updateCategory(id: string, category: string) {
  await updateTransaction(id, { category })
  const txn = transactions.value.find(t => t.id === id)
  if (txn) txn.category = category
}

async function deleteSingle(id: string) {
  await deleteTransaction(id)
  await loadTransactions()
}

async function deleteSelected() {
  for (const txn of selectedTransactions.value) {
    await deleteTransaction(txn.id)
  }
  selectedTransactions.value = []
  await loadTransactions()
}

async function applyBulkCategory() {
  if (!bulkCategory.value) return
  const ids = selectedTransactions.value.map(t => t.id)
  await bulkCategorizeTransactions(ids, bulkCategory.value)
  selectedTransactions.value = []
  bulkCategory.value = ''
  await loadTransactions()
}

function clearFilters() {
  searchText.value = ''
  filterCategory.value = ''
  filterBank.value = ''
  filterStartDate.value = null
  filterEndDate.value = null
  quickDateActive.value = null
  currentPage.value = 1
  loadTransactions()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTransactions()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTransactions()
  }
}

function onPageSizeChange() {
  currentPage.value = 1
  loadTransactions()
}

function onImported() {
  showImportDialog.value = false
  loadTransactions()
  loadBanks()
  loadCategories()
}

function openManualAdd() {
  manualDate.value = new Date()
  manualDescription.value = ''
  manualAmount.value = null
  manualCategory.value = ''
  manualAccountLabel.value = ''
  showAddDialog.value = true
}

async function saveManualTransaction() {
  if (!manualDescription.value || manualAmount.value === null) return

  const date = manualDate.value
    ? manualDate.value.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  await importTransactions({
    transactions: [{
      date,
      description: manualDescription.value,
      amount: manualAmount.value,
      category: manualCategory.value
    }],
    bank: 'manual',
    accountLabel: manualAccountLabel.value
  })

  showAddDialog.value = false
  await loadTransactions()
}

async function loadBanks() {
  bankList.value = await getTransactionBanks()
}

async function loadCategories() {
  budgetCategories.value = await getBudgetCategories()
}

onMounted(async () => {
  await loadCategories()
  await loadBanks()
  bankConfigs.value = await getBankConfigs()
  await loadTransactions()
})
</script>

<style scoped>
.transactions-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filters-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 8px;
}

.filter-group {
  flex-shrink: 0;
}

.search-input {
  width: 14rem;
}

.filter-select {
  width: 10rem;
}

.date-filter {
  width: 9.5rem;
}

.quick-date-filters {
  display: flex;
  gap: 2px;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 2px;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1e3a5f;
  border-radius: 8px;
  margin-bottom: 12px;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.bulk-select {
  width: 11rem;
}

.transactions-table {
  border-radius: 8px;
  overflow: hidden;
}

.txn-description {
  font-size: 0.9rem;
  color: #e2e8f0;
}

.category-inline-select {
  width: 100%;
  font-size: 0.85rem;
}

.amount-debit {
  color: #f87171;
  font-weight: 600;
}

.amount-credit {
  color: #4ade80;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: #64748b;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 12px;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 8px;
}

.pagination-info {
  color: #94a3b8;
  font-size: 0.875rem;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-select {
  width: 5.5rem;
}

.page-number {
  color: #e2e8f0;
  font-size: 0.875rem;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 0.875rem;
  color: #94a3b8;
  font-weight: 500;
}

.w-full {
  width: 100%;
}
</style>
