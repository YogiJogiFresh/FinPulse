<template>
  <DataTable :value="debts" stripedRows dataKey="_id" paginator :rows="15" class="debt-table">
    <Column field="name" header="Name" sortable />
    <Column field="type" header="Type" sortable>
      <template #body="{ data }">
        <Tag :value="formatType(data.type)" :severity="typeSeverity(data.type)" />
      </template>
    </Column>
    <Column field="currentBalance" header="Current Balance" sortable>
      <template #body="{ data }">
        <span class="text-expense">{{ formatCurrency(data.currentBalance) }}</span>
      </template>
    </Column>
    <Column field="monthlyPayment" header="Monthly Payment" sortable>
      <template #body="{ data }">
        {{ formatCurrency(data.monthlyPayment) }}
      </template>
    </Column>
    <Column field="interestRate" header="Rate" sortable>
      <template #body="{ data }">
        {{ data.interestRate }}%
      </template>
    </Column>
    <Column field="notes" header="Notes" />
    <Column header="Actions" style="width: 140px">
      <template #body="{ data }">
        <div class="action-buttons">
          <Button icon="pi pi-pencil" severity="info" text rounded @click="$emit('edit', data)" />
          <Button icon="pi pi-trash" severity="danger" text rounded @click="$emit('delete', data)" />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import type { Debt } from '@/types'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

defineProps<{
  debts: Debt[]
}>()

defineEmits<{
  edit: [debt: Debt]
  delete: [debt: Debt]
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function typeSeverity(type: string): 'success' | 'danger' | 'info' | 'warn' | 'secondary' {
  switch (type) {
    case 'mortgage': return 'info'
    case 'student_loan': return 'warn'
    case 'car_loan': return 'secondary'
    case 'credit_card': return 'danger'
    case 'personal_loan': return 'info'
    case 'medical': return 'warn'
    default: return 'secondary'
  }
}
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 4px;
}

.text-expense {
  color: #f87171;
  font-weight: 600;
}
</style>
