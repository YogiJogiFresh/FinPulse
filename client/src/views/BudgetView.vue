<template>
  <div class="budget-view">
    <div class="view-toolbar">
      <Button label="Add Category" icon="pi pi-plus" @click="openCreate" />
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
import { ref, onMounted } from 'vue'
import type { BudgetCategory, MonthlyCategorySummary } from '@/types'
import { getBudgetCategories, createBudgetCategory, updateBudgetCategory, deleteBudgetCategory, getTransactionMonthlySummary } from '@/services/api'
import BudgetCategoryForm from '@/components/budget/BudgetCategoryForm.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const categories = ref<BudgetCategory[]>([])
const dialogVisible = ref(false)
const editingCategory = ref<BudgetCategory | null>(null)
const loading = ref(true)
const monthlySummary = ref<MonthlyCategorySummary[]>([])

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

async function loadBudget() {
  loading.value = true
  try {
    const now = new Date()
    const [cats, summary] = await Promise.all([
      getBudgetCategories(),
      getTransactionMonthlySummary(now.getFullYear(), now.getMonth() + 1)
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
