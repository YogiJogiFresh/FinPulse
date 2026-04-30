<template>
  <div class="properties-view">
    <h2><i class="pi pi-building"></i> Properties</h2>

    <!-- Property Tabs -->
    <div class="property-tabs">
      <button
        v-for="prop in properties" :key="prop._id"
        class="property-tab" :class="{ active: selectedPropertyId === prop._id }"
        @click="selectProperty(prop._id)"
      >
        {{ prop.name }}
        <Tag :value="formatDesignation(prop.designation)" :severity="prop.designation === 'primary_residence' ? 'info' : 'success'" class="tab-tag" />
      </button>
      <button class="property-tab add-tab" @click="showAddProperty = true">
        <i class="pi pi-plus"></i> Add Property
      </button>
    </div>

    <!-- No Properties State -->
    <div v-if="properties.length === 0" class="empty-state">
      <i class="pi pi-building"></i>
      <p>No properties yet. Add your first property to get started.</p>
    </div>

    <!-- Selected Property Content -->
    <div v-if="selectedProperty" class="property-content">

      <!-- Property Info Header -->
      <div class="section-card property-header-card">
        <div class="property-header-top">
          <h3>{{ selectedProperty.name }}</h3>
          <div class="property-header-actions">
            <Button icon="pi pi-pencil" severity="secondary" text rounded @click="editPropertyInfo" />
            <Button icon="pi pi-trash" severity="danger" text rounded @click="confirmDeleteProperty" />
          </div>
        </div>
        <div class="property-meta">
          <span v-if="selectedProperty.address"><i class="pi pi-map-marker"></i> {{ selectedProperty.address }}</span>
          <span v-if="selectedProperty.purchaseDate"><i class="pi pi-calendar"></i> Purchased: {{ selectedProperty.purchaseDate }}</span>
          <span v-if="selectedProperty.purchasePrice > 0"><i class="pi pi-dollar"></i> {{ formatCurrency(selectedProperty.purchasePrice) }}</span>
        </div>
        <p v-if="selectedProperty.notes" class="property-notes">{{ selectedProperty.notes }}</p>
      </div>

      <!-- Property Details (Key-Value) -->
      <div class="section-card">
        <div class="section-header">
          <h3><i class="pi pi-list"></i> Property Details</h3>
          <Button icon="pi pi-plus" label="Add Detail" size="small" @click="showAddDetail = true" />
        </div>
        <DataTable :value="details" :loading="tabLoading" stripedRows dataKey="_id" v-if="details.length > 0 || tabLoading" size="small">
          <Column field="category" header="Category" :sortable="true" style="width: 20%">
            <template #body="{ data }">
              <Tag :value="formatCategory(data.category)" :severity="detailCategorySeverity(data.category)" />
            </template>
          </Column>
          <Column field="label" header="Label" :sortable="true" />
          <Column field="value" header="Value" :sortable="true" />
          <Column header="" style="width: 10%">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded size="small" @click="editDetail(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="doDeleteDetail(data._id)" />
            </template>
          </Column>
        </DataTable>
        <div v-if="!tabLoading && details.length === 0" class="empty-section">No details yet. Add info like HVAC, roof date, water heater, etc.</div>
      </div>

      <!-- Property Expenses -->
      <div class="section-card">
        <div class="section-header">
          <h3><i class="pi pi-money-bill"></i> Expenses</h3>
          <Button icon="pi pi-plus" label="Add Expense" size="small" @click="showAddExpense = true" />
        </div>
        <DataTable :value="expenses" :loading="tabLoading" stripedRows dataKey="_id" v-if="expenses.length > 0 || tabLoading" size="small"
          :sortField="'date'" :sortOrder="-1">
          <Column field="date" header="Date" :sortable="true" style="width: 12%" />
          <Column field="description" header="Description" :sortable="true" />
          <Column field="category" header="Category" :sortable="true" style="width: 14%">
            <template #body="{ data }">
              <Tag :value="formatCategory(data.category)" :severity="expenseCategorySeverity(data.category)" />
            </template>
          </Column>
          <Column field="amount" header="Amount" :sortable="true" style="width: 12%">
            <template #body="{ data }">
              <span class="text-expense">{{ formatCurrency(data.amount) }}</span>
            </template>
          </Column>
          <Column field="notes" header="Notes" />
          <Column field="recurring" header="Recurring" style="width: 12%">
            <template #body="{ data }">
              <Tag v-if="data.recurring === 'monthly'" value="Monthly" severity="info" />
              <Tag v-else-if="data.recurring === 'quarterly'" value="Quarterly" severity="success" />
              <Tag v-else-if="data.recurring === 'annual'" value="Annual" severity="warn" />
              <span v-else class="text-muted">—</span>
            </template>
          </Column>
          <Column header="" style="width: 8%">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded size="small" @click="editExpense(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="doDeleteExpense(data._id)" />
            </template>
          </Column>
        </DataTable>
        <div v-if="expenses.length > 0" class="expense-total">
          Total: <strong>{{ formatCurrency(totalExpenses) }}</strong>
        </div>
        <div v-if="!tabLoading && expenses.length === 0" class="empty-section">No expenses recorded yet.</div>
      </div>

      <!-- Property Contractors -->
      <div class="section-card">
        <div class="section-header">
          <h3><i class="pi pi-users"></i> Contractors</h3>
          <Button icon="pi pi-plus" label="Add Contractor" size="small" @click="showAddContractor = true" />
        </div>
        <DataTable :value="contractors" :loading="tabLoading" stripedRows dataKey="_id" v-if="contractors.length > 0 || tabLoading" size="small">
          <Column field="name" header="Name" :sortable="true" />
          <Column field="specialty" header="Specialty" :sortable="true" style="width: 16%">
            <template #body="{ data }">
              <Tag :value="formatCategory(data.specialty)" />
            </template>
          </Column>
          <Column field="phone" header="Phone" style="width: 15%" />
          <Column field="email" header="Email" />
          <Column field="notes" header="Notes" />
          <Column header="" style="width: 10%">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded size="small" @click="editContractor(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="doDeleteContractor(data._id)" />
            </template>
          </Column>
        </DataTable>
        <div v-if="!tabLoading && contractors.length === 0" class="empty-section">No contractors added yet.</div>
      </div>
    </div>

    <!-- Add Property Dialog -->
    <Dialog v-model:visible="showAddProperty" header="Add Property" modal :style="{ width: '90vw', maxWidth: '28rem' }">
      <div class="dialog-form">
        <div class="field">
          <label>Name</label>
          <InputText v-model="propForm.name" placeholder="e.g. Primary Home" class="w-full" />
        </div>
        <div class="field">
          <label>Designation</label>
          <Select v-model="propForm.designation" :options="designationOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="field">
          <label>Address</label>
          <InputText v-model="propForm.address" placeholder="123 Main St" class="w-full" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Purchase Date</label>
            <InputText v-model="propForm.purchaseDate" placeholder="MM/DD/YYYY" class="w-full" />
          </div>
          <div class="field">
            <label>Purchase Price</label>
            <InputNumber v-model="propForm.purchasePrice" mode="currency" currency="USD" class="w-full" />
          </div>
        </div>
        <div class="field">
          <label>Notes</label>
          <Textarea v-model="propForm.notes" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddProperty = false" />
        <Button :label="editingPropertyId ? 'Save' : 'Add'" icon="pi pi-check" @click="saveProperty" :disabled="!propForm.name" />
      </template>
    </Dialog>

    <!-- Add Detail Dialog -->
    <Dialog v-model:visible="showAddDetail" header="Add Detail" modal :style="{ width: '90vw', maxWidth: '25rem' }">
      <div class="dialog-form">
        <div class="field">
          <label>Category</label>
          <Select v-model="detailForm.category" :options="detailCategoryOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="field">
          <label>Label</label>
          <InputText v-model="detailForm.label" placeholder="e.g. HVAC System" class="w-full" />
        </div>
        <div class="field">
          <label>Value</label>
          <InputText v-model="detailForm.value" placeholder="e.g. Carrier 3-ton, installed 2022" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddDetail = false" />
        <Button :label="editingDetailId ? 'Save' : 'Add'" icon="pi pi-check" @click="saveDetail" :disabled="!detailForm.label" />
      </template>
    </Dialog>

    <!-- Add Expense Dialog -->
    <Dialog v-model:visible="showAddExpense" :header="editingExpenseId ? 'Edit Expense' : 'Add Expense'" modal :style="{ width: '90vw', maxWidth: '28rem' }">
      <div class="dialog-form">
        <div class="field-row">
          <div class="field">
            <label>Date</label>
            <DatePicker v-model="expenseForm.date" dateFormat="mm/dd/yy" placeholder="MM/DD/YYYY" showIcon :showOnFocus="false" class="w-full" />
          </div>
          <div class="field">
            <label>Category</label>
            <Select v-model="expenseForm.category" :options="expenseCategoryOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <InputText v-model="expenseForm.description" placeholder="e.g. Roof repair" class="w-full" />
        </div>
        <div class="field">
          <label>Amount</label>
          <InputNumber v-model="expenseForm.amount" mode="currency" currency="USD" class="w-full" />
        </div>
        <div class="field">
          <label>Notes</label>
          <Textarea v-model="expenseForm.notes" rows="2" class="w-full" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Recurring</label>
            <Select v-model="expenseForm.recurring" :options="recurringOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="field" v-if="expenseForm.recurring">
            <label>End Date <small class="text-muted">(optional, defaults to 5 years)</small></label>
            <DatePicker v-model="expenseForm.recurringEndDate" dateFormat="mm/dd/yy" placeholder="Indefinite" showIcon :showOnFocus="false" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddExpense = false" />
        <Button :label="editingExpenseId ? 'Save' : 'Add'" icon="pi pi-check" @click="saveExpense" :disabled="!expenseForm.description" />
      </template>
    </Dialog>

    <!-- Add Contractor Dialog -->
    <Dialog v-model:visible="showAddContractor" header="Add Contractor" modal :style="{ width: '90vw', maxWidth: '28rem' }">
      <div class="dialog-form">
        <div class="field">
          <label>Name</label>
          <InputText v-model="contractorForm.name" placeholder="e.g. John's Plumbing" class="w-full" />
        </div>
        <div class="field">
          <label>Specialty</label>
          <Select v-model="contractorForm.specialty" :options="specialtyOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Phone</label>
            <InputText v-model="contractorForm.phone" placeholder="555-123-4567" class="w-full" />
          </div>
          <div class="field">
            <label>Email</label>
            <InputText v-model="contractorForm.email" placeholder="john@email.com" class="w-full" />
          </div>
        </div>
        <div class="field">
          <label>Notes</label>
          <Textarea v-model="contractorForm.notes" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddContractor = false" />
        <Button :label="editingContractorId ? 'Save' : 'Add'" icon="pi pi-check" @click="saveContractor" :disabled="!contractorForm.name" />
      </template>
    </Dialog>

    <!-- Delete Property Confirmation -->
    <Dialog v-model:visible="showDeleteConfirm" header="Delete Property" modal :style="{ width: '90vw', maxWidth: '25rem' }">
      <p>Are you sure you want to delete <strong>{{ selectedProperty?.name }}</strong>? This will also delete all details, expenses, and contractors for this property.</p>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showDeleteConfirm = false" />
        <Button label="Delete" icon="pi pi-trash" severity="danger" @click="doDeleteProperty" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import type { Property, PropertyDetail, PropertyExpense, PropertyContractor } from '@/types'
import {
  getProperties, createProperty, updateProperty, deleteProperty,
  getPropertyDetails, createPropertyDetail, updatePropertyDetail, deletePropertyDetail,
  getPropertyExpenses, createPropertyExpense, updatePropertyExpense, deletePropertyExpense,
  getPropertyContractors, createPropertyContractor, updatePropertyContractor, deletePropertyContractor
} from '@/services/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import DatePicker from 'primevue/datepicker'

const toast = useToast()
const properties = ref<Property[]>([])
const selectedPropertyId = ref<string | null>(null)
const details = ref<PropertyDetail[]>([])
const expenses = ref<PropertyExpense[]>([])
const contractors = ref<PropertyContractor[]>([])

const selectedProperty = computed(() => properties.value.find(p => p._id === selectedPropertyId.value) || null)
const totalExpenses = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0))

// Dialogs
const showAddProperty = ref(false)
const showAddDetail = ref(false)
const showAddExpense = ref(false)
const showAddContractor = ref(false)
const showDeleteConfirm = ref(false)

// Editing state
const editingPropertyId = ref<string | null>(null)
const editingDetailId = ref<string | null>(null)
const editingExpenseId = ref<string | null>(null)
const editingContractorId = ref<string | null>(null)

// Form models
const propForm = ref({ name: '', designation: 'primary_residence', address: '', purchaseDate: '', purchasePrice: 0, notes: '' })
const detailForm = ref({ category: 'other', label: '', value: '' })
const expenseForm = ref({ date: null as Date | null, description: '', amount: 0, category: 'other', notes: '', recurring: '', recurringEndDate: null as Date | null })
const contractorForm = ref({ name: '', specialty: 'other', phone: '', email: '', notes: '' })

// Options
const designationOptions = [
  { label: 'Primary Residence', value: 'primary_residence' },
  { label: 'Rental', value: 'rental' }
]
const detailCategoryOptions = [
  { label: 'Systems', value: 'systems' },
  { label: 'Structure', value: 'structure' },
  { label: 'Appliances', value: 'appliances' },
  { label: 'Other', value: 'other' }
]
const expenseCategoryOptions = [
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Repair', value: 'repair' },
  { label: 'Improvement', value: 'improvement' },
  { label: 'Tax', value: 'tax' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Utility', value: 'utility' },
  { label: 'HOA', value: 'hoa' },
  { label: 'Other', value: 'other' }
]
const recurringOptions = [
  { label: 'None', value: '' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annual', value: 'annual' }
]
const specialtyOptions = [
  { label: 'Plumber', value: 'plumber' },
  { label: 'Electrician', value: 'electrician' },
  { label: 'HVAC', value: 'hvac' },
  { label: 'Roofer', value: 'roofer' },
  { label: 'General', value: 'general' },
  { label: 'Landscaper', value: 'landscaper' },
  { label: 'Painter', value: 'painter' },
  { label: 'Other', value: 'other' }
]

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDesignation(d: string): string {
  return d === 'primary_residence' ? 'Primary Residence' : 'Rental'
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function detailCategorySeverity(cat: string): 'info' | 'success' | 'warn' | 'secondary' {
  switch (cat) {
    case 'systems': return 'info'
    case 'structure': return 'warn'
    case 'appliances': return 'success'
    default: return 'secondary'
  }
}

function expenseCategorySeverity(cat: string): 'info' | 'success' | 'warn' | 'danger' | 'secondary' {
  switch (cat) {
    case 'repair': return 'danger'
    case 'improvement': return 'success'
    case 'tax': return 'warn'
    case 'insurance': return 'info'
    default: return 'secondary'
  }
}

async function loadProperties() {
  properties.value = await getProperties()
  if (properties.value.length > 0 && !selectedPropertyId.value) {
    selectedPropertyId.value = properties.value[0]._id
  }
}

const tabLoading = ref(false)

async function loadPropertyData(propId: string) {
  tabLoading.value = true
  try {
    const [d, e, c] = await Promise.all([
      getPropertyDetails(propId),
      getPropertyExpenses(propId),
      getPropertyContractors(propId)
    ])
    details.value = d
    expenses.value = e
    contractors.value = c
  } finally {
    tabLoading.value = false
  }
}

function selectProperty(id: string) {
  selectedPropertyId.value = id
}

watch(selectedPropertyId, (id) => {
  if (id) loadPropertyData(id)
  else { details.value = []; expenses.value = []; contractors.value = [] }
})

// ── Property CRUD ──
function resetPropForm() {
  propForm.value = { name: '', designation: 'primary_residence', address: '', purchaseDate: '', purchasePrice: 0, notes: '' }
  editingPropertyId.value = null
}

function editPropertyInfo() {
  const p = selectedProperty.value!
  propForm.value = { name: p.name, designation: p.designation, address: p.address, purchaseDate: p.purchaseDate, purchasePrice: p.purchasePrice, notes: p.notes }
  editingPropertyId.value = p._id
  showAddProperty.value = true
}

async function saveProperty() {
  if (editingPropertyId.value) {
    await updateProperty(editingPropertyId.value, propForm.value as any)
  } else {
    const created = await createProperty(propForm.value as any)
    selectedPropertyId.value = created._id
  }
  showAddProperty.value = false
  resetPropForm()
  await loadProperties()
}

function confirmDeleteProperty() {
  showDeleteConfirm.value = true
}

async function doDeleteProperty() {
  if (!selectedPropertyId.value) return
  await deleteProperty(selectedPropertyId.value)
  showDeleteConfirm.value = false
  selectedPropertyId.value = null
  await loadProperties()
}

// ── Detail CRUD ──
function resetDetailForm() {
  detailForm.value = { category: 'other', label: '', value: '' }
  editingDetailId.value = null
}

function editDetail(d: PropertyDetail) {
  detailForm.value = { category: d.category, label: d.label, value: d.value }
  editingDetailId.value = d._id
  showAddDetail.value = true
}

async function saveDetail() {
  if (editingDetailId.value) {
    await updatePropertyDetail(editingDetailId.value, detailForm.value as any)
  } else {
    await createPropertyDetail({ propertyId: selectedPropertyId.value!, ...detailForm.value } as any)
  }
  showAddDetail.value = false
  resetDetailForm()
  await loadPropertyData(selectedPropertyId.value!)
}

async function doDeleteDetail(id: string) {
  await deletePropertyDetail(id)
  await loadPropertyData(selectedPropertyId.value!)
}

// ── Expense CRUD ──
function formatDateStr(d: Date | null): string {
  if (!d) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function parseDateStr(s: string): Date | null {
  if (!s) return null
  const [mm, dd, yyyy] = s.split('/').map(Number)
  if (!mm || !dd || !yyyy) return null
  return new Date(yyyy, mm - 1, dd)
}

function resetExpenseForm() {
  expenseForm.value = { date: null, description: '', amount: 0, category: 'other', notes: '', recurring: '', recurringEndDate: null }
  editingExpenseId.value = null
}

function editExpense(e: PropertyExpense) {
  expenseForm.value = {
    date: parseDateStr(e.date),
    description: e.description,
    amount: e.amount,
    category: e.category,
    notes: e.notes,
    recurring: (e as any).recurring || '',
    recurringEndDate: parseDateStr((e as any).recurringEndDate || '')
  }
  editingExpenseId.value = e._id
  showAddExpense.value = true
}

async function saveExpense() {
  const dateStr = formatDateStr(expenseForm.value.date)
  const recurring = expenseForm.value.recurring
  let endDateStr = formatDateStr(expenseForm.value.recurringEndDate)

  // If recurring but no end date, default to 5 years from start (or today)
  if (recurring && !endDateStr) {
    const base = expenseForm.value.date || new Date()
    const defaultEnd = new Date(base.getFullYear() + 5, base.getMonth(), base.getDate())
    endDateStr = formatDateStr(defaultEnd)
  }

  // Validate: end date must be after start date if both specified
  if (recurring && dateStr && endDateStr) {
    const startTs = (expenseForm.value.date || new Date()).getTime()
    const endTs = expenseForm.value.recurringEndDate
      ? expenseForm.value.recurringEndDate.getTime()
      : new Date((expenseForm.value.date || new Date()).getFullYear() + 5, (expenseForm.value.date || new Date()).getMonth(), (expenseForm.value.date || new Date()).getDate()).getTime()
    if (endTs <= startTs) {
      toast.add({ severity: 'error', summary: 'Invalid Dates', detail: 'End date must be after the start date', life: 3000 })
      return
    }
  }

  if (editingExpenseId.value) {
    await updatePropertyExpense(editingExpenseId.value, {
      date: dateStr,
      description: expenseForm.value.description,
      amount: expenseForm.value.amount,
      category: expenseForm.value.category,
      notes: expenseForm.value.notes,
      recurring,
      recurringEndDate: endDateStr
    } as any)
  } else {
    await createPropertyExpense({
      propertyId: selectedPropertyId.value!,
      date: dateStr,
      description: expenseForm.value.description,
      amount: expenseForm.value.amount,
      category: expenseForm.value.category,
      notes: expenseForm.value.notes,
      recurring,
      recurringEndDate: endDateStr
    } as any)
  }
  showAddExpense.value = false
  resetExpenseForm()
  await loadPropertyData(selectedPropertyId.value!)
}

async function doDeleteExpense(id: string) {
  await deletePropertyExpense(id)
  await loadPropertyData(selectedPropertyId.value!)
}

// ── Contractor CRUD ──
function resetContractorForm() {
  contractorForm.value = { name: '', specialty: 'other', phone: '', email: '', notes: '' }
  editingContractorId.value = null
}

function editContractor(c: PropertyContractor) {
  contractorForm.value = { name: c.name, specialty: c.specialty, phone: c.phone, email: c.email, notes: c.notes }
  editingContractorId.value = c._id
  showAddContractor.value = true
}

async function saveContractor() {
  if (editingContractorId.value) {
    await updatePropertyContractor(editingContractorId.value, contractorForm.value as any)
  } else {
    await createPropertyContractor({ propertyId: selectedPropertyId.value!, ...contractorForm.value } as any)
  }
  showAddContractor.value = false
  resetContractorForm()
  await loadPropertyData(selectedPropertyId.value!)
}

async function doDeleteContractor(id: string) {
  await deletePropertyContractor(id)
  await loadPropertyData(selectedPropertyId.value!)
}

// Reset forms when dialogs close
watch(showAddProperty, (v) => { if (!v) resetPropForm() })
watch(showAddDetail, (v) => { if (!v) resetDetailForm() })
watch(showAddExpense, (v) => { if (!v) resetExpenseForm() })
watch(showAddContractor, (v) => { if (!v) resetContractorForm() })

onMounted(loadProperties)
</script>

<style scoped>
.properties-view {
  max-width: 70rem;
  margin: 0 auto;
  padding: 24px;
}

.properties-view > h2 {
  color: #e2e8f0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.property-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.property-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.property-tab:hover {
  background-color: #334155;
  color: #e2e8f0;
}

.property-tab.active {
  background-color: #38bdf8;
  color: #0f172a;
  border-color: #38bdf8;
  font-weight: 600;
}

.property-tab.active .tab-tag {
  opacity: 0.8;
}

.property-tab.add-tab {
  border-style: dashed;
  color: #64748b;
}

.property-tab.add-tab:hover {
  color: #38bdf8;
  border-color: #38bdf8;
}

.tab-tag {
  font-size: 0.7rem;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 12px;
  display: block;
}

.property-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-card {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h3 {
  color: #e2e8f0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
}

.property-header-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.property-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.property-header-top h3 {
  color: #e2e8f0;
  margin: 0;
  font-size: 1.2rem;
}

.property-header-actions {
  display: flex;
  gap: 4px;
}

.property-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #94a3b8;
  font-size: 0.85rem;
}

.property-meta i {
  margin-right: 4px;
  color: #64748b;
}

.property-notes {
  margin-top: 8px;
  color: #64748b;
  font-size: 0.85rem;
  font-style: italic;
}

.empty-section {
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
  padding: 20px;
}

.expense-total {
  text-align: right;
  margin-top: 12px;
  color: #94a3b8;
  font-size: 0.9rem;
  padding-right: 8px;
}

.expense-total strong {
  color: #f87171;
}

.text-expense {
  color: #f87171;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
}

.field-row {
  display: flex;
  gap: 12px;
}

.w-full {
  width: 100%;
}
</style>
