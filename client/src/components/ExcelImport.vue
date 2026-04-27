<template>
  <div class="excel-import">
    <div class="import-row">
      <div class="import-btn-wrapper">
        <button class="import-btn" @click="onSelectFile">
          <i class="pi pi-file-import"></i> Import Excel
        </button>
        <div class="import-tooltip">
          <slot name="description">
            <p class="tooltip-text">Import an Excel file with account names in column A and dates across row 1</p>
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
          </slot>
        </div>
      </div>
    </div>

    <div v-if="importError" class="import-error">
      <i class="pi pi-exclamation-triangle"></i> {{ importError }}
    </div>

    <!-- Import Preview Dialog -->
    <Dialog v-model:visible="previewVisible" header="Import Preview" modal :style="{ width: '90vw', maxWidth: '1000px' }" :closable="true">
      <p class="preview-hint">Review and edit the data before importing. Account names, dates, and values can be modified.</p>

      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Account</th>
              <th v-for="(date, di) in previewData.dates" :key="di">
                <input type="text" v-model="previewData.dates[di]" class="preview-date-input" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(account, ai) in previewData.accounts" :key="ai">
              <td>
                <input type="text" v-model="previewData.accounts[ai]" class="preview-name-input" />
              </td>
              <td v-for="(_, di) in previewData.dates" :key="di">
                <input type="text" :value="formatValue(previewData.values[ai][di])" @change="onValueChange($event, ai, di)" class="preview-value-input" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="preview-summary">
        <span>{{ previewData.accounts.length }} accounts × {{ previewData.dates.length }} dates</span>
      </div>

      <div class="preview-actions">
        <Button label="Cancel" severity="secondary" text @click="previewVisible = false" />
        <Button label="Confirm Import" icon="pi pi-check" @click="confirmImport" />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToast } from 'primevue/usetoast'
import { openAndParseExcel, importHistory } from '@/services/api'
import type { ParsedExcelData } from '@/types'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const emit = defineEmits<{ (e: 'imported'): void }>()
const toast = useToast()

const previewVisible = ref(false)
const importError = ref('')
const previewData = reactive<ParsedExcelData>({ accounts: [], dates: [], values: [] })

async function onSelectFile() {
  importError.value = ''
  try {
    const parsed = await openAndParseExcel()
    if (!parsed) return
    previewData.accounts = parsed.accounts
    previewData.dates = parsed.dates
    previewData.values = parsed.values
    previewVisible.value = true
  } catch (err: any) {
    importError.value = err.message || 'Failed to parse file'
  }
}

function formatValue(v: number): string {
  return v.toFixed(2)
}

function onValueChange(event: Event, ai: number, di: number) {
  const raw = (event.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, '')
  const num = parseFloat(raw)
  previewData.values[ai][di] = isNaN(num) ? 0 : Math.round(num * 100) / 100
}

async function confirmImport() {
  try {
    const payload = {
      accounts: [...previewData.accounts],
      dates: [...previewData.dates],
      values: previewData.values.map((row: number[]) => [...row])
    }
    await importHistory(payload)
    previewVisible.value = false
    importError.value = ''
    toast.add({ severity: 'success', summary: 'Import Successful', detail: `Imported ${payload.accounts.length} accounts across ${payload.dates.length} dates`, life: 4000 })
    emit('imported')
  } catch (err: any) {
    importError.value = err.message || 'Failed to import data'
  }
}
</script>

<style scoped>
.excel-import {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.import-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
}

.import-btn-wrapper {
  position: relative;
}

.import-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 14px;
  color: #94a3b8;
  font-size: 0.8rem;
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-text {
  margin: 0 0 8px 0;
  color: #94a3b8;
  font-size: 0.8rem;
}

.example-table {
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

.import-btn-wrapper:hover .import-tooltip {
  display: block;
}

.import-hint {
  margin: 0;
}

.import-btn {
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

.import-btn:hover {
  background-color: #7dd3fc;
}

.import-error {
  color: #f87171;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-hint {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 16px;
}

.preview-table-wrapper {
  max-height: 400px;
  overflow: auto;
  border: 1px solid #334155;
  border-radius: 8px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  font-size: 0.85rem;
}

.preview-table th {
  position: sticky;
  top: 0;
  background-color: #1e293b;
  padding: 8px;
  border-bottom: 1px solid #334155;
  text-align: center;
  z-index: 1;
}

.preview-table td {
  padding: 4px 6px;
  border-bottom: 1px solid #334155;
}

.preview-date-input,
.preview-name-input,
.preview-value-input {
  width: 100%;
  padding: 4px 8px;
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #f1f5f9;
  font-size: 0.85rem;
}

.preview-date-input {
  min-width: 90px;
  text-align: center;
}

.preview-name-input {
  min-width: 120px;
}

.preview-value-input {
  min-width: 80px;
  text-align: right;
}

.preview-date-input:focus,
.preview-name-input:focus,
.preview-value-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.preview-summary {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-top: 12px;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
