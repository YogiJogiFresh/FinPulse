<template>
  <DataTable :value="accounts" :loading="loading" stripedRows dataKey="_id" class="account-table">
    <Column field="name" header="Name" sortable />
    <Column field="type" header="Type" sortable>
      <template #body="{ data }">
        <Tag :value="formatType(data.type)" :severity="typeSeverity(data.type)" />
      </template>
    </Column>
    <Column field="balance" header="Balance" sortable>
      <template #body="{ data }">
        <span :class="{ 'text-positive': data.balance >= 0, 'text-negative': data.balance < 0 }">
          {{ formatCurrency(data.balance, data.currency) }}
        </span>
      </template>
    </Column>
    <Column field="updatedAt" header="Last Updated" sortable>
      <template #body="{ data }">
        <span class="text-muted">{{ formatDate(data.updatedAt) }}</span>
      </template>
    </Column>
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
import type { Account } from '@/types'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

defineProps<{
  accounts: Account[]
  loading?: boolean
}>()

defineEmits<{
  edit: [account: Account]
  delete: [account: Account]
}>()

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function typeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
    checking: 'info',
    savings: 'success',
    credit_card: 'warn',
    investment: 'success',
    retirement: 'info',
    cash: 'success',
    other: 'secondary'
  }
  return map[type] || 'secondary'
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 4px;
}

.text-positive {
  color: #4ade80;
  font-weight: 600;
}

.text-negative {
  color: #f87171;
  font-weight: 600;
}

.text-muted {
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
