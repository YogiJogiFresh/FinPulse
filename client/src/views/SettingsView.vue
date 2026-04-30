<template>
  <div class="settings-view">
    <!-- App Version -->
    <div class="version-badge">
      <i class="pi pi-box"></i> FinPulse v{{ appVersion }}
    </div>

    <!-- Data Management -->
    <div class="settings-card">
      <h3><i class="pi pi-database"></i> Data Management</h3>

      <div class="setting-row" v-for="item in clearOptions" :key="item.key">
        <div class="setting-info">
          <label>{{ item.label }}</label>
          <small>{{ item.description }}</small>
        </div>
        <Button
          v-if="confirmingPage !== item.key"
          label="Clear"
          icon="pi pi-trash"
          severity="danger"
          outlined
          size="small"
          @click="confirmingPage = item.key"
        />
        <div v-else class="confirm-group">
          <span class="confirm-warning">Are you sure?</span>
          <Button label="Delete" icon="pi pi-exclamation-triangle" severity="danger" size="small" @click="doClearPage(item.key)" />
          <Button label="Cancel" severity="secondary" outlined size="small" @click="confirmingPage = ''" />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label>Clear All Data</label>
          <small>Delete everything and reset settings to defaults</small>
        </div>
        <Button
          v-if="!confirmingClear"
          label="Clear All"
          icon="pi pi-trash"
          severity="danger"
          @click="confirmingClear = true"
        />
        <div v-else class="confirm-group">
          <span class="confirm-warning">This cannot be undone!</span>
          <Button label="Yes, Delete Everything" icon="pi pi-exclamation-triangle" severity="danger" @click="doClearAll" />
          <Button label="Cancel" severity="secondary" outlined @click="confirmingClear = false" />
        </div>
      </div>
    </div>

    <!-- Data Import / Export -->
    <div class="settings-card">
      <h3><i class="pi pi-file-excel"></i> Data Import / Export</h3>
      <small>
        Import an Excel file with account names in column A and dates across row 1
        <table class="example-table">
          <thead>
            <tr>
              <th></th>
              <th>2026-01</th>
              <th>2026-02</th>
              <th>2026-03</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Checking</td>
              <td>4,250.00</td>
              <td>4,830.50</td>
              <td>5,120.75</td>
            </tr>
            <tr>
              <td>Savings</td>
              <td>12,000.00</td>
              <td>12,500.00</td>
              <td>13,100.00</td>
            </tr>
          </tbody>
        </table>
      </small>
      <div class="import-export-row">
        <ExcelImport />
        <button class="export-btn" @click="doExport">
          <i class="pi pi-file-export"></i> Export History
        </button>
      </div>
    </div>

    <!-- Budget / Tax Settings -->
    <div class="settings-card">
      <h3><i class="pi pi-percentage"></i> Tax Settings</h3>
      <p class="settings-hint">These rates are used to estimate your monthly take-home pay on the Income page.</p>

      <div class="setting-row">
        <div class="setting-info">
          <label>Federal Tax Rate</label>
          <small>Your effective federal income tax rate</small>
        </div>
        <div class="setting-input-group">
          <input
            type="number"
            v-model.number="federalTaxRate"
            step="0.5"
            min="0"
            max="50"
            class="setting-input"
          />
          <span class="input-suffix">%</span>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <label>State Tax Rate</label>
          <small>Your effective state income tax rate</small>
        </div>
        <div class="setting-input-group">
          <input
            type="number"
            v-model.number="stateTaxRate"
            step="0.5"
            min="0"
            max="20"
            class="setting-input"
          />
          <span class="input-suffix">%</span>
        </div>
      </div>

      <div class="setting-row total-row">
        <div class="setting-info">
          <label>Total Effective Tax Rate</label>
        </div>
        <span class="total-rate">{{ (federalTaxRate + stateTaxRate).toFixed(1) }}%</span>
      </div>

      <div class="save-row">
        <Button label="Save Tax Settings" icon="pi pi-check" @click="saveTaxSettings" :disabled="!taxDirty" />
        <span v-if="taxSaved" class="saved-badge"><i class="pi pi-check-circle"></i> Saved</span>
      </div>
    </div>

    <!-- Supported Banks -->
    <div class="settings-card">
      <h3><i class="pi pi-credit-card"></i> Supported Banks (CSV Import)</h3>
      <p class="settings-hint">Configure which banks are supported for CSV transaction imports and how their columns are parsed.</p>

      <DataTable :value="bankConfigs" stripedRows dataKey="id" class="bank-configs-table">
        <Column field="name" header="Bank Name" />
        <Column field="dateColumn" header="Date Column" />
        <Column field="descriptionColumn" header="Description Column" />
        <Column header="Amount" style="width: 20%">
          <template #body="{ data }">
            <span v-if="data.amountType === 'signed'">{{ data.amountColumn }} (signed)</span>
            <span v-else>{{ data.debitColumn }} / {{ data.creditColumn }}</span>
          </template>
        </Column>
        <Column field="detectionFields" header="Detection Fields" style="width: 25%">
          <template #body="{ data }">
            <span class="detection-chips">{{ data.detectionFields }}</span>
          </template>
        </Column>
        <Column header="Actions" style="width: 12%">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button icon="pi pi-pencil" severity="info" text rounded size="small" @click="editBank(data)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteBank(data.id)" />
            </div>
          </template>
        </Column>
      </DataTable>

      <div class="add-bank-row">
        <Button label="Add Bank" icon="pi pi-plus" size="small" @click="openAddBank" />
      </div>

      <!-- Bank Config Dialog -->
      <Dialog v-model:visible="bankDialogVisible" :header="editingBank ? 'Edit Bank' : 'Add Bank'" modal :style="{ width: '90vw', maxWidth: '35rem' }">
        <div class="bank-form">
          <div class="form-field">
            <label>Bank Name</label>
            <InputText v-model="bankForm.name" placeholder="e.g., Wells Fargo" class="w-full" />
          </div>
          <div class="form-field">
            <label>Date Column Header</label>
            <InputText v-model="bankForm.dateColumn" placeholder="e.g., Transaction Date" class="w-full" />
          </div>
          <div class="form-field">
            <label>Post Date Column (optional)</label>
            <InputText v-model="bankForm.postDateColumn" placeholder="e.g., Post Date" class="w-full" />
          </div>
          <div class="form-field">
            <label>Description Column Header</label>
            <InputText v-model="bankForm.descriptionColumn" placeholder="e.g., Description" class="w-full" />
          </div>
          <div class="form-field">
            <label>Amount Type</label>
            <Select v-model="bankForm.amountType" :options="[{label: 'Single signed column (negative=charge)', value: 'signed'}, {label: 'Separate Debit/Credit columns', value: 'split'}]" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div v-if="bankForm.amountType === 'signed'" class="form-field">
            <label>Amount Column Header</label>
            <InputText v-model="bankForm.amountColumn" placeholder="e.g., Amount" class="w-full" />
          </div>
          <div v-if="bankForm.amountType === 'split'" class="form-row">
            <div class="form-field flex-1">
              <label>Debit Column</label>
              <InputText v-model="bankForm.debitColumn" placeholder="e.g., Debit" class="w-full" />
            </div>
            <div class="form-field flex-1">
              <label>Credit Column</label>
              <InputText v-model="bankForm.creditColumn" placeholder="e.g., Credit" class="w-full" />
            </div>
          </div>
          <div class="form-field">
            <label>Detection Fields</label>
            <InputText v-model="bankForm.detectionFields" placeholder="Comma-separated headers that identify this bank" class="w-full" />
            <small class="form-hint">CSV headers unique to this bank, used to auto-detect format on import</small>
          </div>
        </div>
        <template #footer>
          <Button label="Cancel" severity="secondary" @click="bankDialogVisible = false" />
          <Button :label="editingBank ? 'Save' : 'Add'" icon="pi pi-check" :disabled="!bankForm.name || !bankForm.dateColumn || !bankForm.descriptionColumn" @click="saveBankConfig" />
        </template>
      </Dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getSettings, setSettingsBatch, clearAllData, clearByPage, exportHistory, getAppVersion, getBankConfigs, createBankConfig, updateBankConfig, deleteBankConfig } from '@/services/api'
import type { BankConfig } from '@/types'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ExcelImport from '@/components/ExcelImport.vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const router = useRouter()
const federalTaxRate = ref(22)
const stateTaxRate = ref(5)
const taxDirty = ref(false)
const taxSaved = ref(false)
const confirmingClear = ref(false)
const confirmingPage = ref('')
const loading = ref(true)
const appVersion = ref('...')

const clearOptions = [
  { key: 'accounts', label: 'Accounts', description: 'Delete all accounts' },
  { key: 'income', label: 'Income', description: 'Delete all income sources' },
  { key: 'debts', label: 'Debts', description: 'Delete all debt records' },
  { key: 'budget', label: 'Budget', description: 'Delete all budget records' },
  { key: 'history', label: 'Account History', description: 'Delete all account history data' },
  { key: 'properties', label: 'Properties', description: 'Delete all properties, details, expenses, and contractors' },
]

async function doClearPage(page: string) {
  await clearByPage(page)
  confirmingPage.value = ''
  const label = clearOptions.find(o => o.key === page)?.label ?? page
  toast.add({ severity: 'info', summary: 'Data Cleared', detail: `${label} data has been deleted`, life: 3000 })
}

let originalFederal = 22
let originalState = 5

watch([federalTaxRate, stateTaxRate], () => {
  taxDirty.value = federalTaxRate.value !== originalFederal || stateTaxRate.value !== originalState
  taxSaved.value = false
})

async function saveTaxSettings() {
  await setSettingsBatch({
    federal_tax_rate: String(federalTaxRate.value),
    state_tax_rate: String(stateTaxRate.value)
  })
  originalFederal = federalTaxRate.value
  originalState = stateTaxRate.value
  taxDirty.value = false
  taxSaved.value = true
}

async function doClearAll() {
  await clearAllData()
  confirmingClear.value = false
  router.push('/')
}

async function doExport() {
  const result = await exportHistory()
  if (result) {
    toast.add({ severity: 'success', summary: 'Exported', detail: 'Account history saved to Excel', life: 3000 })
  } else {
    toast.add({ severity: 'warn', summary: 'No Data', detail: 'No account history to export', life: 3000 })
  }
}

// Bank Configs
const bankConfigs = ref<BankConfig[]>([])
const bankDialogVisible = ref(false)
const editingBank = ref<BankConfig | null>(null)
const bankForm = ref({
  name: '',
  dateColumn: '',
  postDateColumn: '',
  descriptionColumn: '',
  amountType: 'signed',
  amountColumn: '',
  debitColumn: '',
  creditColumn: '',
  detectionFields: ''
})

async function loadBankConfigs() {
  bankConfigs.value = await getBankConfigs()
}

function openAddBank() {
  editingBank.value = null
  bankForm.value = { name: '', dateColumn: 'Transaction Date', postDateColumn: '', descriptionColumn: 'Description', amountType: 'signed', amountColumn: 'Amount', debitColumn: '', creditColumn: '', detectionFields: '' }
  bankDialogVisible.value = true
}

function editBank(config: BankConfig) {
  editingBank.value = config
  bankForm.value = {
    name: config.name,
    dateColumn: config.dateColumn,
    postDateColumn: config.postDateColumn,
    descriptionColumn: config.descriptionColumn,
    amountType: config.amountType,
    amountColumn: config.amountColumn,
    debitColumn: config.debitColumn,
    creditColumn: config.creditColumn,
    detectionFields: config.detectionFields
  }
  bankDialogVisible.value = true
}

async function saveBankConfig() {
  if (editingBank.value) {
    await updateBankConfig(editingBank.value.id, bankForm.value)
  } else {
    await createBankConfig(bankForm.value)
  }
  bankDialogVisible.value = false
  await loadBankConfigs()
  toast.add({ severity: 'success', summary: 'Saved', detail: `Bank config ${editingBank.value ? 'updated' : 'added'}`, life: 3000 })
}

async function deleteBank(id: string) {
  await deleteBankConfig(id)
  await loadBankConfigs()
  toast.add({ severity: 'info', summary: 'Deleted', detail: 'Bank config removed', life: 3000 })
}

onMounted(async () => {
  loading.value = true
  try {
    const [settings, version] = await Promise.all([getSettings(), getAppVersion()])
    federalTaxRate.value = parseFloat(settings.federal_tax_rate || '22')
    stateTaxRate.value = parseFloat(settings.state_tax_rate || '5')
    originalFederal = federalTaxRate.value
    originalState = stateTaxRate.value
    appVersion.value = version
    await loadBankConfigs()
  } catch {
    // defaults
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 8px 16px;
  background-color: #1e293b;
  border-radius: 8px;
  width: fit-content;
}

.settings-view h2 {
  color: #f1f5f9;
  font-size: 1.5rem;
  margin: 0;
}

.settings-card {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 24px;
}

.settings-card h3 {
  color: #f1f5f9;
  font-size: 1.1rem;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-hint {
  color: #64748b;
  font-size: 0.85rem;
  margin: -8px 0 16px 0;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #334155;
}

.setting-row:last-of-type {
  border-bottom: none;
}

.total-row {
  border-bottom: none;
  padding-top: 16px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-info label {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 0.95rem;
}

.setting-info small {
  color: #64748b;
  font-size: 0.8rem;
}

.settings-card > small {
  display: block;
  color: #64748b;
  font-size: 0.8rem;
  margin-bottom: 12px;
}

.import-export-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: #4ade80;
  border: none;
  border-radius: 8px;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.export-btn:hover {
  background-color: #86efac;
}

.example-table {
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 0.75rem;
  color: #cbd5e1;
}

.example-table th,
.example-table td {
  padding: 3px 10px;
  border: 1px solid #334155;
  text-align: right;
}

.example-table th {
  background-color: #0f172a;
  color: #64748b;
  font-weight: 600;
}

.example-table td:first-child {
  text-align: left;
  font-weight: 500;
  color: #e2e8f0;
}

.confirm-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.confirm-warning {
  color: #f87171;
  font-size: 0.85rem;
  font-weight: 600;
}

.setting-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.setting-input {
  width: 5rem;
  padding: 6px 10px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 0.9rem;
  text-align: right;
}

.setting-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.input-suffix {
  color: #94a3b8;
  font-weight: 600;
}

.total-rate {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fbbf24;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #334155;
}

.saved-badge {
  color: #4ade80;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: #38bdf8;
  border: none;
  border-radius: 8px;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.export-btn:hover {
  background-color: #7dd3fc;
}

.bank-configs-table {
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
}

.detection-chips {
  font-size: 0.8rem;
  color: #60a5fa;
  font-family: monospace;
}

.action-buttons {
  display: flex;
  gap: 2px;
}

.add-bank-row {
  margin-top: 12px;
}

.bank-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.w-full {
  width: 100%;
}

.form-hint {
  font-size: 0.75rem;
  color: #64748b;
}

</style>
