<template>
  <div class="settings-view">
    <!-- App Version -->
    <div class="version-badge">
      <i class="pi pi-box"></i> FinPulse v{{ appVersion }}
    </div>

    <!-- Plaid -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-building-columns"></i> Plaid Bank Sync</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">
      <p class="settings-hint">
        Standalone mode uses your own Plaid developer credentials. Credentials and bank access
        tokens are encrypted by your operating system and never exposed to the browser UI after setup.
      </p>

      <div v-if="!plaidStatus.secureStorageAvailable" class="plaid-warning">
        <i class="pi pi-exclamation-triangle"></i>
        Secure credential storage is unavailable on this device, so Plaid cannot be configured.
      </div>

      <div v-else class="plaid-setup">
        <template v-if="!plaidStatus.configured">
          <div class="plaid-steps">
            <div><strong>1.</strong> Create or sign in to your Plaid developer account.</div>
            <div><strong>2.</strong> Open <b>Team Settings → Keys</b> and copy your Client ID and Sandbox secret.</div>
            <div><strong>3.</strong> Save them here, then connect a Sandbox institution.</div>
          </div>

          <div class="plaid-actions">
            <Button label="Open Plaid Dashboard" icon="pi pi-external-link" severity="secondary" outlined @click="openPlaidDashboard" />
          </div>

          <div class="plaid-credentials">
            <div class="form-field">
              <label>Client ID</label>
              <InputText v-model="plaidForm.clientId" autocomplete="off" placeholder="Plaid Client ID" />
            </div>
            <div class="form-field">
              <label>{{ plaidForm.environment === 'production' ? 'Production' : 'Sandbox' }} Secret</label>
              <input
                v-model="plaidForm.secret"
                class="plaid-secret-input"
                type="password"
                autocomplete="new-password"
                placeholder="Plaid secret"
              />
            </div>
            <div class="form-field">
              <label>Environment</label>
              <Select v-model="plaidForm.environment" :options="plaidEnvironments" optionLabel="label" optionValue="value" />
            </div>
            <Button
              label="Save & Verify"
              icon="pi pi-shield"
              :loading="plaidBusy"
              :disabled="!plaidForm.clientId.trim() || !plaidForm.secret.trim()"
              @click="savePlaidConfig"
            />
          </div>

          <div v-if="plaidForm.environment === 'production'" class="plaid-warning">
            Production requires Plaid approval. A local desktop app offers weaker secret protection than a hosted backend.
          </div>
        </template>

        <div v-else class="plaid-configured-header">
          <span class="saved-badge">
            <i class="pi pi-check-circle"></i>
            Configured for {{ plaidStatus.environment }}
          </span>
          <Button
            v-if="!confirmingPlaidClear"
            label="Clear Plaid Bank API Sync"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmingPlaidClear = true"
          />
          <div v-else class="confirm-group">
            <span class="confirm-warning">Disconnect all banks and clear Plaid credentials?</span>
            <Button label="Clear Plaid Sync" icon="pi pi-trash" severity="danger" :loading="plaidClearing" @click="clearPlaidConfig" />
            <Button label="Cancel" severity="secondary" outlined @click="confirmingPlaidClear = false" />
          </div>
        </div>

        <div v-if="plaidStatus.configured" class="plaid-connections">
          <div class="plaid-connection-toolbar">
            <Button label="Connect Institution" icon="pi pi-plus" :loading="plaidLinking" @click="connectPlaid" />
            <Button
              label="Sync All"
              icon="pi pi-sync"
              severity="secondary"
              outlined
              :loading="plaidSyncing"
              :disabled="plaidStatus.items.length === 0"
              @click="syncAllPlaid"
            />
          </div>

          <div v-if="plaidStatus.environment === 'sandbox'" class="sandbox-hint">
            In Plaid Link, choose a Sandbox institution and use <code>user_good</code> /
            <code>pass_good</code>.
          </div>

          <div class="plaid-schedule">
            <div class="plaid-schedule-heading">
              <div>
                <h3>Automatic Sync</h3>
                <p>
                  FinPulse syncs balances and transactions while the app is open. A missed run
                  captures current data as a catch-up the next time the app opens.
                </p>
              </div>
              <Button
                label="Save Schedule"
                icon="pi pi-check"
                size="small"
                :loading="plaidScheduleSaving"
                @click="savePlaidSchedule"
              />
            </div>
            <div class="plaid-schedule-controls">
              <label class="schedule-toggle">
                <input v-model="plaidSchedule.firstDayEnabled" type="checkbox" />
                <span>First day of each month</span>
              </label>
              <label class="schedule-toggle">
                <input v-model="plaidSchedule.lastDayEnabled" type="checkbox" />
                <span>Last day of each month</span>
              </label>
              <label class="schedule-time">
                <span>Local sync time</span>
                <input v-model="plaidSchedule.localTime" type="time" />
              </label>
            </div>
            <div class="plaid-schedule-status">
              <span>
                <strong>Next run:</strong>
                {{ plaidSchedule.nextRunAt ? formatScheduleDate(plaidSchedule.nextRunAt) : 'Automatic sync disabled' }}
              </span>
              <span>
                <strong>Last automatic success:</strong>
                {{ plaidSchedule.lastSuccessAt ? formatScheduleDate(plaidSchedule.lastSuccessAt) : 'Not run yet' }}
                <template v-if="plaidSchedule.lastTrigger">
                  ({{ formatSyncTrigger(plaidSchedule.lastTrigger) }})
                </template>
              </span>
            </div>
            <div v-if="plaidSchedule.lastError" class="plaid-warning">
              <i class="pi pi-exclamation-triangle"></i>
              Last automatic sync failed: {{ plaidSchedule.lastError }}
            </div>
          </div>

          <div v-if="plaidStatus.items.length === 0" class="empty-connections">
            No institutions connected yet.
          </div>
          <div v-for="item in plaidStatus.items" :key="item.itemId" class="plaid-item">
            <div class="setting-info">
              <label>{{ item.institutionName }}</label>
              <small>
                {{ item.lastSyncedAt ? `Last synced ${formatPlaidDate(item.lastSyncedAt)}` : 'Not synced yet' }}
              </small>
            </div>
            <div class="plaid-item-actions">
              <template v-if="confirmingPlaidRemoval !== item.itemId">
                <Button
                  v-tooltip.bottom="'Sync institution'"
                  icon="pi pi-sync"
                  severity="secondary"
                  text
                  rounded
                  aria-label="Sync institution"
                  @click="syncOnePlaid(item.itemId)"
                />
                <Button
                  v-tooltip.bottom="'Remove institution'"
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Remove institution"
                  @click="confirmingPlaidRemoval = item.itemId"
                />
              </template>
              <template v-else>
                <span class="confirm-warning">Remove institution?</span>
                <Button label="Remove" icon="pi pi-trash" severity="danger" size="small" @click="removePlaid(item.itemId)" />
                <Button label="Cancel" severity="secondary" outlined size="small" @click="confirmingPlaidRemoval = ''" />
              </template>
            </div>
          </div>
        </div>
      </div>
      </div>
    </details>

    <!-- Local Backups -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-save"></i> Local Backup & Restore</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">
        <p class="settings-hint">
          FinPulse automatically saves one local backup per day and retains 30 daily versions,
          10 manual versions, and 5 pre-restore safety versions. Each version contains the SQLite
          database and, when configured, the encrypted Plaid credential file.
        </p>
        <div class="plaid-warning">
          <i class="pi pi-shield"></i>
          Plaid credentials remain encrypted for this operating-system account and may not decrypt
          if copied to another computer or user account.
        </div>
        <div class="backup-toolbar">
          <Button
            label="Back Up Now"
            icon="pi pi-save"
            :loading="backupBusy"
            @click="doCreateBackup"
          />
          <Button
            label="Open Backup Folder"
            icon="pi pi-folder-open"
            severity="secondary"
            outlined
            @click="doOpenBackupFolder"
          />
        </div>
        <div v-if="backups.length === 0" class="empty-connections">
          No backups yet.
        </div>
        <div v-else class="backup-list">
          <div v-for="backup in backups" :key="backup.id" class="backup-row">
            <div class="setting-info">
              <label>{{ formatBackupDate(backup.createdAt) }}</label>
              <small>
                {{ formatBackupReason(backup.reason) }} · {{ formatBytes(backup.sizeBytes) }} ·
                {{ backup.includesPlaidSecrets ? 'Includes encrypted Plaid credentials' : 'No Plaid credentials' }}
              </small>
            </div>
            <template v-if="confirmingBackupRestore !== backup.id">
              <Button
                label="Restore"
                icon="pi pi-history"
                severity="warn"
                outlined
                size="small"
                :disabled="backupBusy"
                @click="confirmingBackupRestore = backup.id"
              />
            </template>
            <div v-else class="confirm-group">
              <span class="confirm-warning">Replace current data and restart?</span>
              <Button
                label="Restore & Restart"
                icon="pi pi-history"
                severity="danger"
                size="small"
                :loading="backupBusy"
                @click="doRestoreBackup(backup.id)"
              />
              <Button
                label="Cancel"
                severity="secondary"
                outlined
                size="small"
                @click="confirmingBackupRestore = ''"
              />
            </div>
          </div>
        </div>
      </div>
    </details>

    <!-- Data Management -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-database"></i> Data Management</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">

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
    </details>

    <!-- Data Import / Export -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-file-excel"></i> Data Import / Export</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">
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
    </details>

    <!-- Budget / Tax Settings -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-percentage"></i> Tax Settings</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">
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
          <small>Your effective state income tax rate (Virginia default: 5.75%)</small>
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

      <div class="setting-row">
        <div class="setting-info">
          <label>FICA (Social Security + Medicare)</label>
          <small>Payroll tax: Social Security (6.2%) + Medicare (1.45%)</small>
        </div>
        <div class="setting-input-group">
          <input
            type="number"
            v-model.number="ficaRate"
            step="0.05"
            min="0"
            max="15"
            class="setting-input"
          />
          <span class="input-suffix">%</span>
        </div>
      </div>

      <div class="setting-row total-row">
        <div class="setting-info">
          <label>Total Effective Tax Rate</label>
        </div>
        <span class="total-rate">{{ (federalTaxRate + stateTaxRate + ficaRate).toFixed(1) }}%</span>
      </div>

      <div class="save-row">
        <Button label="Save Tax Settings" icon="pi pi-check" @click="saveTaxSettings" :disabled="!taxDirty" />
        <span v-if="taxSaved" class="saved-badge"><i class="pi pi-check-circle"></i> Saved</span>
      </div>
      </div>
    </details>

    <!-- Supported Banks -->
    <details class="settings-card">
      <summary class="settings-card-header">
        <span><i class="pi pi-credit-card"></i> Supported Banks (CSV Import)</span>
        <i class="pi pi-chevron-down collapse-icon"></i>
      </summary>
      <div class="settings-card-content">
      <p class="settings-hint">Add your banks and map custom CSV columns to display in the Transactions table.</p>

      <DataTable :value="bankConfigs" stripedRows dataKey="id" class="bank-configs-table">
        <Column field="name" header="Bank Name" />
        <Column header="Custom Columns" style="width: 45%">
          <template #body="{ data }">
            <span v-if="data.customColumns && data.customColumns.length" class="detection-chips">
              {{ data.customColumns.map((c: any) => c.displayName).join(', ') }}
            </span>
            <span v-else class="form-hint">None configured</span>
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
            <InputText v-model="bankForm.name" placeholder="e.g., Chase, Capital One" class="w-full" />
          </div>
          <div class="form-field">
            <label>Custom Column Mappings</label>
            <small class="form-hint">Map CSV headers to custom display columns shown in the Transactions table. If a CSV is missing a mapped column, it will be skipped with a warning.</small>
            <div class="custom-columns-list">
              <div v-for="(col, idx) in bankForm.customColumns" :key="idx" class="custom-col-row">
                <InputText v-model="col.csvHeader" placeholder="CSV Header" class="custom-col-input" />
                <span class="custom-col-arrow">→</span>
                <InputText v-model="col.displayName" placeholder="Display Name" class="custom-col-input" />
                <Button icon="pi pi-times" severity="danger" text rounded size="small" @click="bankForm.customColumns.splice(idx, 1)" />
              </div>
              <Button label="Add Column Mapping" icon="pi pi-plus" size="small" severity="secondary" @click="bankForm.customColumns.push({ csvHeader: '', displayName: '' })" />
            </div>
          </div>
        </div>
        <template #footer>
          <Button label="Cancel" severity="secondary" @click="bankDialogVisible = false" />
          <Button :label="editingBank ? 'Save' : 'Add'" icon="pi pi-check" :disabled="!bankForm.name" @click="saveBankConfig" />
        </template>
      </Dialog>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getSettings, setSettingsBatch, clearAllData, clearByPage, exportHistory, getAppVersion, getBankConfigs, createBankConfig, updateBankConfig, deleteBankConfig, getPlaidStatus, configurePlaid, openPlaidLink, syncPlaid, getPlaidSchedule, setPlaidSchedule, onPlaidScheduleChanged, disconnectPlaid, clearPlaid, openPlaidDashboard, getBackups, createBackup, openBackupFolder, restoreBackup } from '@/services/api'
import type { BackupRecord, BankConfig, PlaidScheduleStatus, PlaidStatus, PlaidSyncResult } from '@/types'
import type { ToastMessageOptions } from 'primevue/toast'
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
const stateTaxRate = ref(5.75)
const ficaRate = ref(7.65)
const taxDirty = ref(false)
const taxSaved = ref(false)
const confirmingClear = ref(false)
const confirmingPage = ref('')
const backups = ref<BackupRecord[]>([])
const backupBusy = ref(false)
const confirmingBackupRestore = ref('')
const loading = ref(true)
const appVersion = ref('...')
const plaidStatus = ref<PlaidStatus>({
  configured: false,
  environment: null,
  secureStorageAvailable: true,
  items: []
})
const plaidForm = ref({
  clientId: '',
  secret: '',
  environment: 'sandbox' as 'sandbox' | 'production'
})
const plaidEnvironments = [
  { label: 'Sandbox', value: 'sandbox' },
  { label: 'Production', value: 'production' }
]
const plaidBusy = ref(false)
const plaidLinking = ref(false)
const plaidSyncing = ref(false)
const plaidClearing = ref(false)
const confirmingPlaidClear = ref(false)
const confirmingPlaidRemoval = ref('')
const plaidScheduleSaving = ref(false)
const plaidSchedule = ref<PlaidScheduleStatus>({
  firstDayEnabled: true,
  lastDayEnabled: true,
  localTime: '09:00',
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastTrigger: null,
  lastError: null,
  lastCompletedSlot: null,
  nextRunAt: null
})
let removePlaidScheduleListener: (() => void) | null = null

const clearOptions = [
  { key: 'accounts', label: 'Accounts', description: 'Delete all accounts' },
  { key: 'income', label: 'Income', description: 'Delete all income sources' },
  { key: 'debts', label: 'Debts', description: 'Delete all debt records' },
  { key: 'budget', label: 'Budget', description: 'Delete all budget records' },
  { key: 'transactions', label: 'Transactions', description: 'Delete all transactions and category rules' },
  { key: 'history', label: 'Account History', description: 'Delete all account history data' },
  { key: 'properties', label: 'Properties', description: 'Delete all properties, details, expenses, and contractors' },
]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Unexpected error'
}

async function refreshBackups() {
  backups.value = await getBackups()
}

async function doCreateBackup() {
  backupBusy.value = true
  try {
    const backup = await createBackup()
    await refreshBackups()
    toast.add({
      severity: 'success',
      summary: 'Backup Created',
      detail: `${formatBackupDate(backup.createdAt)} · ${formatBytes(backup.sizeBytes)}`,
      life: 4000
    })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Backup Failed', detail: errorMessage(error), life: 6000 })
  } finally {
    backupBusy.value = false
  }
}

async function doOpenBackupFolder() {
  try {
    await openBackupFolder()
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Unable to Open Backups', detail: errorMessage(error), life: 6000 })
  }
}

async function doRestoreBackup(id: string) {
  backupBusy.value = true
  try {
    await restoreBackup(id)
  } catch (error) {
    backupBusy.value = false
    toast.add({ severity: 'error', summary: 'Restore Failed', detail: errorMessage(error), life: 6000 })
  }
}

function formatBackupDate(value: string): string {
  return new Date(value).toLocaleString()
}

function formatBackupReason(reason: BackupRecord['reason']): string {
  if (reason === 'pre_restore') return 'Pre-restore safety backup'
  return reason === 'automatic' ? 'Automatic backup' : 'Manual backup'
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

async function refreshPlaidStatus() {
  plaidStatus.value = await getPlaidStatus()
  if (plaidStatus.value.environment) plaidForm.value.environment = plaidStatus.value.environment
}

async function refreshPlaidSchedule() {
  plaidSchedule.value = await getPlaidSchedule()
}

async function savePlaidSchedule() {
  plaidScheduleSaving.value = true
  try {
    plaidSchedule.value = await setPlaidSchedule({
      firstDayEnabled: plaidSchedule.value.firstDayEnabled,
      lastDayEnabled: plaidSchedule.value.lastDayEnabled,
      localTime: plaidSchedule.value.localTime
    })
    toast.add({
      severity: 'success',
      summary: 'Automatic Sync Saved',
      detail: 'The first-day, last-day, and local-time schedule was updated.',
      life: 4000
    })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Unable to Save Schedule', detail: errorMessage(error), life: 6000 })
  } finally {
    plaidScheduleSaving.value = false
  }
}

async function savePlaidConfig() {
  plaidBusy.value = true
  try {
    await configurePlaid({ ...plaidForm.value })
    plaidForm.value.clientId = ''
    plaidForm.value.secret = ''
    await refreshPlaidStatus()
    toast.add({ severity: 'success', summary: 'Plaid Configured', detail: 'Credentials were verified and encrypted locally.', life: 4000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Plaid Setup Failed', detail: errorMessage(error), life: 6000 })
  } finally {
    plaidBusy.value = false
  }
}

async function connectPlaid() {
  plaidLinking.value = true
  try {
    const result = await openPlaidLink()
    if (!result) return
    await refreshPlaidStatus()
    showSyncResult('Institution Connected', result)
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Unable to Open Plaid', detail: errorMessage(error), life: 6000 })
  } finally {
    plaidLinking.value = false
  }
}

function showSyncResult(summary: string, result: PlaidSyncResult) {
  const institutionNames = result.institutions.map(item => item.institutionName)
  const institutionLabel = institutionNames.length === 1
    ? institutionNames[0]
    : `${institutionNames.length} institutions`
  const totals = result.institutions.reduce((counts, item) => {
    counts.accountsAdded += item.accountsAddedCount
    counts.accountsUpdated += item.accountsUpdatedCount
    counts.transactionsAdded += item.transactionsAddedCount
    counts.transactionsUpdated += item.transactionsModifiedCount
    counts.transactionsDeleted += item.transactionsRemovedCount
    return counts
  }, {
    accountsAdded: 0,
    accountsUpdated: 0,
    transactionsAdded: 0,
    transactionsUpdated: 0,
    transactionsDeleted: 0
  })
  const summaryParts = [
    ['account added', 'accounts added', totals.accountsAdded],
    ['account updated', 'accounts updated', totals.accountsUpdated],
    ['transaction added', 'transactions added', totals.transactionsAdded],
    ['transaction updated', 'transactions updated', totals.transactionsUpdated],
    ['transaction deleted', 'transactions deleted', totals.transactionsDeleted]
  ].flatMap(([singular, plural, count]) => {
    const value = Number(count)
    return value > 0 ? [`${value} ${value === 1 ? singular : plural}`] : []
  })
  const expandedLines = result.institutions.flatMap(item => {
    const lines = [`${item.institutionName}:`]
    const changes = [
      ['Accounts added', item.accountsAddedCount, item.accountsAdded],
      ['Accounts updated', item.accountsUpdatedCount, item.accountsUpdated],
      ['Transactions added', item.transactionsAddedCount, item.transactionsAdded],
      ['Transactions updated', item.transactionsModifiedCount, item.transactionsModified],
      ['Transactions deleted', item.transactionsRemovedCount, item.transactionsRemoved]
    ] as const
    for (const [label, count, values] of changes) {
      if (count > 0) lines.push(`${label} (${count}):\n- ${values.join('\n- ')}${count > values.length ? `\n- And ${count - values.length} more` : ''}`)
    }
    if (lines.length === 1) lines.push('No account or transaction changes.')
    return lines
  })
  const expandedDetail = expandedLines.join('\n\n')
  const boundedExpandedDetail = expandedDetail.length > 7800
    ? `${expandedDetail.slice(0, 7750).replace(/\n[^\n]*$/, '')}\n\nAdditional details omitted.`
    : expandedDetail
  const message: ToastMessageOptions & { expandedDetail: string } = {
    severity: 'success',
    summary: `${summary}: ${institutionLabel}`,
    detail: summaryParts.length > 0 ? summaryParts.join(', ') : 'No account or transaction changes.',
    expandedDetail: boundedExpandedDetail,
    life: 4000
  }
  toast.add(message)
}

async function syncAllPlaid() {
  plaidSyncing.value = true
  try {
    const result = await syncPlaid()
    await refreshPlaidStatus()
    showSyncResult('Plaid Sync Complete', result)
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Plaid Sync Failed', detail: errorMessage(error), life: 6000 })
  } finally {
    plaidSyncing.value = false
  }
}

async function syncOnePlaid(itemId: string) {
  try {
    const result = await syncPlaid(itemId)
    await refreshPlaidStatus()
    showSyncResult('Institution Synced', result)
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Plaid Sync Failed', detail: errorMessage(error), life: 6000 })
  }
}

async function removePlaid(itemId: string) {
  try {
    await disconnectPlaid(itemId)
    confirmingPlaidRemoval.value = ''
    await refreshPlaidStatus()
    toast.add({ severity: 'info', summary: 'Institution Disconnected', detail: 'Imported accounts and transactions were kept.', life: 4000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Disconnect Failed', detail: errorMessage(error), life: 6000 })
  }
}

async function clearPlaidConfig() {
  plaidClearing.value = true
  try {
    const result = await clearPlaid()
    confirmingPlaidClear.value = false
    await refreshPlaidStatus()
    if (result.revocationErrors.length === 0) {
      plaidForm.value = { clientId: '', secret: '', environment: 'sandbox' }
    }
    toast.add({
      severity: result.revocationErrors.length > 0 ? 'warn' : 'success',
      summary: result.revocationErrors.length > 0 ? 'Plaid Revocation Incomplete' : 'Plaid Sync Cleared',
      detail: result.revocationErrors.length > 0
        ? `${result.revocationErrors.length} Plaid connection(s) could not be revoked. Their encrypted tokens were retained so you can retry.`
        : 'Plaid credentials and connections were removed. Imported data was kept.',
      life: 6000
    })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Unable to Clear Plaid', detail: errorMessage(error), life: 6000 })
  } finally {
    plaidClearing.value = false
  }
}

function formatPlaidDate(value: string): string {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleString()
}

function formatScheduleDate(value: string): string {
  return new Date(value).toLocaleString()
}

function formatSyncTrigger(trigger: PlaidScheduleStatus['lastTrigger']): string {
  return trigger === 'catch_up' ? 'catch-up' : trigger || ''
}

async function doClearPage(page: string) {
  await clearByPage(page)
  confirmingPage.value = ''
  const label = clearOptions.find(o => o.key === page)?.label ?? page
  toast.add({ severity: 'info', summary: 'Data Cleared', detail: `${label} data has been deleted`, life: 3000 })
}

let originalFederal = 22
let originalState = 5.75
let originalFica = 7.65

watch([federalTaxRate, stateTaxRate, ficaRate], () => {
  taxDirty.value = federalTaxRate.value !== originalFederal || stateTaxRate.value !== originalState || ficaRate.value !== originalFica
  taxSaved.value = false
})

async function saveTaxSettings() {
  await setSettingsBatch({
    federal_tax_rate: String(federalTaxRate.value),
    state_tax_rate: String(stateTaxRate.value),
    fica_rate: String(ficaRate.value)
  })
  originalFederal = federalTaxRate.value
  originalState = stateTaxRate.value
  originalFica = ficaRate.value
  taxDirty.value = false
  taxSaved.value = true
}

async function doClearAll() {
  try {
    await clearAllData()
    confirmingClear.value = false
    router.push('/')
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Unable to Clear Data', detail: errorMessage(error), life: 6000 })
  }
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
  detectionFields: '',
  customColumns: [] as { csvHeader: string; displayName: string }[]
})

async function loadBankConfigs() {
  bankConfigs.value = await getBankConfigs()
}

function openAddBank() {
  editingBank.value = null
  bankForm.value = { name: '', dateColumn: '', postDateColumn: '', descriptionColumn: '', amountType: 'signed', amountColumn: '', debitColumn: '', creditColumn: '', detectionFields: '', customColumns: [] }
  bankDialogVisible.value = true
}

function editBank(config: BankConfig) {
  editingBank.value = config
  bankForm.value = {
    name: config.name,
    dateColumn: config.dateColumn || '',
    postDateColumn: config.postDateColumn || '',
    descriptionColumn: config.descriptionColumn || '',
    amountType: config.amountType || 'signed',
    amountColumn: config.amountColumn || '',
    debitColumn: config.debitColumn || '',
    creditColumn: config.creditColumn || '',
    detectionFields: config.detectionFields || '',
    customColumns: config.customColumns ? [...config.customColumns] : []
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
    const [settings, version, plaid, schedule, savedBackups] = await Promise.all([
      getSettings(),
      getAppVersion(),
      getPlaidStatus(),
      getPlaidSchedule(),
      getBackups()
    ])
    federalTaxRate.value = parseFloat(settings.federal_tax_rate || '22')
    stateTaxRate.value = parseFloat(settings.state_tax_rate || '5.75')
    ficaRate.value = parseFloat(settings.fica_rate || '7.65')
    originalFederal = federalTaxRate.value
    originalState = stateTaxRate.value
    originalFica = ficaRate.value
    appVersion.value = version
    plaidStatus.value = plaid
    plaidSchedule.value = schedule
    backups.value = savedBackups
    if (plaid.environment) plaidForm.value.environment = plaid.environment
    await loadBankConfigs()
    removePlaidScheduleListener = onPlaidScheduleChanged(() => {
      void refreshPlaidSchedule()
      void refreshPlaidStatus()
    })
  } catch {
    // defaults
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  removePlaidScheduleListener?.()
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
  overflow: hidden;
}

.settings-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  color: #f1f5f9;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.settings-card-header::-webkit-details-marker {
  display: none;
}

.settings-card-header > span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-card-header:hover {
  background-color: rgb(51 65 85 / 35%);
}

.backup-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 1rem 0;
}

.backup-list {
  display: grid;
  gap: 0.75rem;
}

.backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
}

.collapse-icon {
  color: #94a3b8;
  transition: transform 0.2s ease;
}

.settings-card[open] .collapse-icon {
  transform: rotate(180deg);
}

.settings-card-content {
  padding: 0 24px 24px;
  border-top: 1px solid #334155;
  padding-top: 20px;
}

.settings-hint {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0 0 16px 0;
}

.plaid-setup {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plaid-steps {
  display: grid;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.plaid-actions,
.plaid-connection-toolbar,
.plaid-item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plaid-configured-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.plaid-credentials {
  display: grid;
  grid-template-columns: minmax(10rem, 1fr) minmax(10rem, 1fr) 10rem auto;
  align-items: end;
  gap: 12px;
  padding: 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
}

.plaid-secret-input {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  color: #f1f5f9;
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  font-size: 1rem;
}

.plaid-secret-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.plaid-warning,
.sandbox-hint {
  padding: 10px 12px;
  color: #fbbf24;
  background: rgb(120 53 15 / 20%);
  border: 1px solid #92400e;
  border-radius: 6px;
  font-size: 0.85rem;
}

.sandbox-hint code {
  color: #7dd3fc;
}

.plaid-connections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #334155;
}

.plaid-schedule {
  display: grid;
  gap: 14px;
  padding: 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
}

.plaid-schedule-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.plaid-schedule-heading h3 {
  margin: 0 0 4px;
  color: #f1f5f9;
  font-size: 1rem;
}

.plaid-schedule-heading p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.82rem;
}

.plaid-schedule-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.schedule-toggle,
.schedule-time {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.schedule-toggle input {
  width: 1rem;
  height: 1rem;
  accent-color: #38bdf8;
}

.schedule-time input {
  padding: 6px 8px;
  color: #f1f5f9;
  color-scheme: dark;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 6px;
}

.plaid-schedule-status {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  color: #94a3b8;
  font-size: 0.8rem;
}

.plaid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #0f172a;
  border-radius: 6px;
}

.empty-connections {
  color: #64748b;
  font-size: 0.85rem;
}

@media (max-width: 900px) {
  .plaid-credentials {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .plaid-schedule-heading {
    align-items: stretch;
    flex-direction: column;
  }
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

.custom-columns-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.custom-col-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-col-input {
  flex: 1;
  min-width: 0;
}

.custom-col-arrow {
  color: #60a5fa;
  font-size: 1.1rem;
  flex-shrink: 0;
}

</style>
