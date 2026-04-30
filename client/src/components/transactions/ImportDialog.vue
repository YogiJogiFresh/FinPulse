<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Import Transactions"
    :modal="true"
    :style="{ width: '900px', maxHeight: '85vh' }"
    :closable="true"
  >
    <!-- Step 1: File selection -->
    <div v-if="step === 'select'" class="import-step">
      <div class="import-instructions">
        <h3>Import CSV from your bank</h3>
        <p>Supported banks: <strong>Capital One</strong>, <strong>Chase</strong>, <strong>Citi</strong>, <strong>Synchrony</strong></p>
        <p>Download your statement as CSV from your bank's website, then select the file below.</p>
      </div>

      <div class="file-input-area">
        <input type="file" ref="fileInput" accept=".csv" @change="onFileSelected" style="display: none" />
        <Button label="Select CSV File" icon="pi pi-file" size="large" @click="($refs.fileInput as HTMLInputElement).click()" />
      </div>

      <div class="account-label-input">
        <label>Account Label (e.g., "Chase Freedom", "Cap One Savor")</label>
        <InputText v-model="accountLabel" placeholder="My Credit Card" class="w-full" />
      </div>

      <div v-if="parseError" class="parse-error">
        <i class="pi pi-exclamation-triangle"></i>
        {{ parseError }}
      </div>
    </div>

    <!-- Step 2: Preview -->
    <div v-if="step === 'preview'" class="import-step">
      <div class="preview-header">
        <div class="preview-info">
          <span class="bank-badge">{{ bankLabel }}</span>
          <span>{{ parsedTransactions.length }} transactions found</span>
          <span v-if="parseErrors.length > 0" class="error-count">{{ parseErrors.length }} errors</span>
        </div>
        <Button label="Apply Rules" icon="pi pi-bolt" size="small" severity="secondary" @click="applyRulesToPreview" />
      </div>

      <DataTable
        :value="parsedTransactions"
        scrollable
        scrollHeight="400px"
        stripedRows
        class="preview-table"
      >
        <Column field="date" header="Date" style="width: 100px" />
        <Column field="description" header="Description" />
        <Column field="category" header="Category" style="width: 170px">
          <template #body="{ data, index }">
            <Select
              :modelValue="data.category"
              :options="categorySelectOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Uncategorized"
              class="preview-category-select"
              @change="(e: any) => parsedTransactions[index].category = e.value"
            />
          </template>
        </Column>
        <Column field="amount" header="Amount" style="width: 100px">
          <template #body="{ data }">
            <span :class="data.amount > 0 ? 'amount-debit' : 'amount-credit'">
              {{ formatCurrency(data.amount) }}
            </span>
          </template>
        </Column>
      </DataTable>

      <div v-if="parseErrors.length > 0" class="parse-errors-list">
        <details>
          <summary>{{ parseErrors.length }} parsing errors</summary>
          <ul>
            <li v-for="err in parseErrors" :key="err">{{ err }}</li>
          </ul>
        </details>
      </div>
    </div>

    <!-- Step 3: Result -->
    <div v-if="step === 'result'" class="import-step">
      <div class="import-result">
        <i class="pi pi-check-circle result-icon"></i>
        <h3>Import Complete</h3>
        <p>{{ importResult?.imported }} transactions imported, {{ importResult?.skipped }} duplicates skipped.</p>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button v-if="step === 'preview'" label="Back" icon="pi pi-arrow-left" severity="secondary" @click="step = 'select'" />
        <div class="footer-right">
          <Button label="Cancel" severity="secondary" @click="close" />
          <Button
            v-if="step === 'preview'"
            label="Import"
            icon="pi pi-check"
            :loading="importing"
            @click="doImport"
          />
          <Button v-if="step === 'result'" label="Done" icon="pi pi-check" @click="close(); $emit('imported')" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { parseTransactionCSV, importTransactions, getCategoryRules } from '@/services/api'
import type { BudgetCategory, TransactionImportResult } from '@/types'

const props = defineProps<{
  visible: boolean
  categories: BudgetCategory[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'imported'): void
}>()

type PreviewTransaction = { date: string; postDate: string; description: string; amount: number; category: string }

const step = ref<'select' | 'preview' | 'result'>('select')
const accountLabel = ref('')
const parseError = ref('')
const parseErrors = ref<string[]>([])
const parsedTransactions = ref<PreviewTransaction[]>([])
const detectedBank = ref('')
const importing = ref(false)
const importResult = ref<TransactionImportResult | null>(null)

const bankLabel = computed(() => {
  const labels: Record<string, string> = {
    capital_one: 'Capital One',
    chase: 'Chase',
    citi: 'Citi',
    synchrony: 'Synchrony'
  }
  return labels[detectedBank.value] || detectedBank.value
})

const categorySelectOptions = computed(() => {
  return [
    { label: 'Uncategorized', value: '' },
    ...props.categories.map(c => ({ label: c.name, value: c.name }))
  ]
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount))
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  parseError.value = ''
  parseErrors.value = []

  try {
    const content = await file.text()
    const result = await parseTransactionCSV(content)

    if (result.bank === 'unknown' || result.transactions.length === 0) {
      parseError.value = result.errors?.[0] || 'Could not parse CSV. Ensure it is from a supported bank.'
      return
    }

    detectedBank.value = result.bank
    parseErrors.value = result.errors || []
    parsedTransactions.value = result.transactions.map(t => ({
      ...t,
      category: ''
    }))

    // Auto-apply rules
    await applyRulesToPreview()
    step.value = 'preview'
  } catch (err: any) {
    parseError.value = err.message || 'Failed to parse file'
  }
}

async function applyRulesToPreview() {
  const rules = await getCategoryRules()
  // Sort by priority descending
  rules.sort((a, b) => b.priority - a.priority)

  for (const txn of parsedTransactions.value) {
    if (txn.category) continue // Don't overwrite manual assignments
    for (const rule of rules) {
      if (txn.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
        txn.category = rule.category
        break
      }
    }
  }
}

async function doImport() {
  importing.value = true
  try {
    const result = await importTransactions({
      transactions: parsedTransactions.value.map(t => ({
        date: t.date,
        postDate: t.postDate,
        description: t.description,
        amount: t.amount,
        category: t.category
      })),
      bank: detectedBank.value,
      accountLabel: accountLabel.value
    })
    importResult.value = result
    step.value = 'result'
  } finally {
    importing.value = false
  }
}

function close() {
  emit('update:visible', false)
  // Reset state after short delay
  setTimeout(() => {
    step.value = 'select'
    parsedTransactions.value = []
    parseError.value = ''
    parseErrors.value = []
    importResult.value = null
    detectedBank.value = ''
  }, 300)
}
</script>

<style scoped>
.import-step {
  min-height: 200px;
}

.import-instructions {
  margin-bottom: 24px;
}

.import-instructions h3 {
  color: #f1f5f9;
  margin: 0 0 8px;
}

.import-instructions p {
  color: #94a3b8;
  margin: 4px 0;
}

.file-input-area {
  display: flex;
  justify-content: center;
  padding: 32px;
  border: 2px dashed #334155;
  border-radius: 8px;
  margin-bottom: 20px;
}

.account-label-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.account-label-input label {
  font-size: 0.875rem;
  color: #94a3b8;
}

.parse-error {
  margin-top: 16px;
  padding: 12px;
  background: #451a1a;
  border-radius: 6px;
  color: #fca5a5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 0.9rem;
}

.bank-badge {
  background: #1e3a5f;
  color: #60a5fa;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
}

.error-count {
  color: #fca5a5;
}

.preview-table {
  border-radius: 6px;
  overflow: hidden;
}

.preview-category-select {
  width: 100%;
  font-size: 0.8rem;
}

.amount-debit {
  color: #f87171;
  font-weight: 600;
}

.amount-credit {
  color: #4ade80;
  font-weight: 600;
}

.parse-errors-list {
  margin-top: 12px;
  color: #fca5a5;
  font-size: 0.85rem;
}

.parse-errors-list ul {
  max-height: 100px;
  overflow-y: auto;
  padding-left: 20px;
}

.import-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  text-align: center;
}

.result-icon {
  font-size: 3rem;
  color: #4ade80;
  margin-bottom: 16px;
}

.import-result h3 {
  color: #f1f5f9;
  margin: 0 0 8px;
}

.import-result p {
  color: #94a3b8;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.footer-right {
  display: flex;
  gap: 8px;
}
</style>
