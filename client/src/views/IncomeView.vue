<template>
  <div class="income-view">
    <div class="view-toolbar">
      <Button label="Add Income Source" icon="pi pi-plus" @click="openCreate" />
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="income-card" v-for="i in 2" :key="'skel-' + i">
      <div class="income-header">
        <div class="income-info">
          <Skeleton width="180px" height="22px" class="mb-2" />
          <div class="income-amounts">
            <Skeleton width="140px" height="18px" />
            <Skeleton width="180px" height="18px" />
          </div>
        </div>
      </div>
    </div>

    <!-- Income Sources List -->
    <div v-if="!loading && sources.length === 0" class="empty-state">
      <i class="pi pi-info-circle"></i>
      <span>No income sources yet. Add your salary to get started.</span>
    </div>

    <div v-if="!loading" v-for="source in sources" :key="source._id" class="income-card">
      <div class="income-header">
        <div class="income-info">
          <h3>{{ source.name }}</h3>
          <div class="income-amounts">
            <span class="salary-badge">
              <i class="pi pi-calendar"></i>
              {{ formatCurrency(source.yearlySalary) }}/yr
            </span>
            <span class="takehome-badge">
              <i class="pi pi-wallet"></i>
              {{ formatCurrency(source.monthlyTakeHome) }}/mo take-home
            </span>
          </div>
          <p v-if="source.notes" class="income-notes">{{ source.notes }}</p>
        </div>
        <div class="income-actions">
          <Button icon="pi pi-pencil" severity="info" text rounded @click="openEdit(source)" />
          <Button icon="pi pi-trash" severity="danger" text rounded @click="onDeleteSource(source)" />
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:visible="dialogVisible" :header="editingSource ? 'Edit Income Source' : 'New Income Source'" modal :style="{ width: '90vw', maxWidth: '32rem' }">
      <form class="income-form" @submit.prevent="onSave">
        <div class="form-field">
          <label for="name">Name</label>
          <InputText id="name" v-model="form.name" placeholder="e.g. Full-Time Job, Freelance" class="w-full" />
        </div>
        <div class="form-field">
          <label for="yearlySalary">Yearly Salary</label>
          <InputNumber id="yearlySalary" v-model="form.yearlySalary" mode="currency" currency="USD" class="w-full" />
        </div>

        <!-- Tax estimate -->
        <div v-if="form.yearlySalary > 0" class="estimate-box">
          <div class="estimate-header">
            <i class="pi pi-calculator"></i>
            <span>Estimated Monthly Take-Home</span>
          </div>
          <div class="estimate-details">
            <div class="estimate-line">
              <span>Federal tax ({{ federalTaxRate }}%)</span>
              <span class="estimate-deduction">-{{ formatCurrency(form.yearlySalary * federalTaxRate / 100 / 12) }}/mo</span>
            </div>
            <div class="estimate-line">
              <span>State tax ({{ stateTaxRate }}%)</span>
              <span class="estimate-deduction">-{{ formatCurrency(form.yearlySalary * stateTaxRate / 100 / 12) }}/mo</span>
            </div>
            <div class="estimate-line">
              <span>FICA ({{ ficaRate }}%)</span>
              <span class="estimate-deduction">-{{ formatCurrency(form.yearlySalary * ficaRate / 100 / 12) }}/mo</span>
            </div>
            <div class="estimate-line estimate-total">
              <span>Estimated take-home</span>
              <span class="estimate-value">{{ formatCurrency(estimatedTakeHome) }}/mo</span>
            </div>
          </div>
          <Button
            label="Use Estimate"
            icon="pi pi-arrow-down"
            size="small"
            text
            @click="form.monthlyTakeHome = Math.round(estimatedTakeHome)"
          />
        </div>

        <div class="form-field">
          <label for="monthlyTakeHome">Monthly Take-Home</label>
          <InputNumber id="monthlyTakeHome" v-model="form.monthlyTakeHome" mode="currency" currency="USD" class="w-full" />
          <small class="field-hint">Your actual monthly pay after taxes and deductions</small>
          <small v-if="takeHomeWarning" class="field-warning">
            <i class="pi pi-exclamation-triangle"></i> {{ takeHomeWarning }}
          </small>
        </div>
        <div class="form-field">
          <label for="notes">Notes</label>
          <InputText id="notes" v-model="form.notes" placeholder="Optional notes" class="w-full" />
        </div>
        <div class="form-actions">
          <Button label="Cancel" severity="secondary" text @click="dialogVisible = false" />
          <Button type="submit" label="Save" icon="pi pi-check" :disabled="!!formError" />
        </div>
        <small v-if="formError" class="form-error">
          <i class="pi pi-times-circle"></i> {{ formError }}
        </small>
      </form>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { IncomeSource } from '@/types'
import {
  getIncomeSources, createIncomeSource, updateIncomeSource, deleteIncomeSource,
  getSettings
} from '@/services/api'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Skeleton from 'primevue/skeleton'

const sources = ref<IncomeSource[]>([])
const loading = ref(true)
const dialogVisible = ref(false)
const editingSource = ref<IncomeSource | null>(null)
const federalTaxRate = ref(22)
const stateTaxRate = ref(5.75)
const ficaRate = ref(7.65)

const form = reactive({
  name: '',
  yearlySalary: 0,
  monthlyTakeHome: 0,
  notes: ''
})

const estimatedTakeHome = computed(() => {
  const totalTaxRate = (federalTaxRate.value + stateTaxRate.value + ficaRate.value) / 100
  return form.yearlySalary * (1 - totalTaxRate) / 12
})

const takeHomeWarning = computed(() => {
  if (form.yearlySalary > 0 && form.monthlyTakeHome > form.yearlySalary / 12) {
    return `Monthly take-home exceeds gross monthly salary (${formatCurrency(form.yearlySalary / 12)}/mo)`
  }
  return ''
})

const formError = computed(() => {
  if (!form.name.trim()) return 'Name is required'
  if (form.yearlySalary <= 0) return 'Yearly salary must be greater than 0'
  if (form.monthlyTakeHome <= 0) return 'Monthly take-home must be greater than 0'
  if (form.monthlyTakeHome > form.yearlySalary / 12) return 'Monthly take-home cannot exceed gross monthly salary'
  return ''
})

function openCreate() {
  editingSource.value = null
  form.name = ''
  form.yearlySalary = 0
  form.monthlyTakeHome = 0
  form.notes = ''
  dialogVisible.value = true
}

function openEdit(source: IncomeSource) {
  editingSource.value = source
  form.name = source.name
  form.yearlySalary = source.yearlySalary
  form.monthlyTakeHome = source.monthlyTakeHome
  form.notes = source.notes || ''
  dialogVisible.value = true
}

async function onSave() {
  if (formError.value) return

  if (editingSource.value) {
    await updateIncomeSource(editingSource.value._id, {
      name: form.name,
      yearlySalary: form.yearlySalary,
      monthlyTakeHome: form.monthlyTakeHome,
      notes: form.notes
    })
  } else {
    await createIncomeSource({
      name: form.name,
      yearlySalary: form.yearlySalary,
      monthlyTakeHome: form.monthlyTakeHome,
      notes: form.notes
    })
  }
  dialogVisible.value = false
  await loadData()
}

async function onDeleteSource(source: IncomeSource) {
  await deleteIncomeSource(source._id)
  await loadData()
}

async function loadData() {
  sources.value = await getIncomeSources()
}

async function loadSettings() {
  try {
    const settings = await getSettings()
    federalTaxRate.value = parseFloat(settings.federal_tax_rate || '22')
    stateTaxRate.value = parseFloat(settings.state_tax_rate || '5.75')
    ficaRate.value = parseFloat(settings.fica_rate || '7.65')
  } catch {
    // defaults
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadData(), loadSettings()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.income-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-toolbar h2 {
  color: #f1f5f9;
  font-size: 1.5rem;
  margin: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #94a3b8;
  font-size: 0.95rem;
  background-color: #1e293b;
  border-radius: 12px;
}

.income-card {
  background-color: #1e293b;
  border-radius: 12px;
  padding: 24px;
}

.income-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.income-info h3 {
  color: #f1f5f9;
  font-size: 1.2rem;
  margin: 0 0 8px 0;
}

.income-amounts {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.salary-badge,
.takehome-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
}

.salary-badge {
  background-color: #334155;
  color: #94a3b8;
}

.takehome-badge {
  background-color: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.income-notes {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 6px;
}

.income-actions {
  display: flex;
  gap: 4px;
}

.estimate-box {
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 14px;
}

.estimate-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.estimate-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.estimate-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #94a3b8;
}

.estimate-line.estimate-total {
  border-top: 1px solid #334155;
  padding-top: 6px;
  margin-top: 4px;
  font-weight: 600;
  color: #e2e8f0;
}

.estimate-deduction {
  color: #f87171;
}

.estimate-value {
  color: #4ade80;
  font-weight: 700;
}

.field-warning {
  color: #fbbf24;
  display: flex;
  align-items: center;
  gap: 4px;
}

.form-error {
  color: #f87171;
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.income-form {
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
  font-weight: 600;
  font-size: 0.875rem;
  color: #cbd5e1;
}

.field-hint {
  color: #64748b;
  font-size: 0.8rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.w-full {
  width: 100%;
}
</style>
