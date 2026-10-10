<template>
  <DataTable :value="accounts" :loading="loading" stripedRows dataKey="_id" class="account-table">
    <Column field="name" header="Name" sortable />
    <Column field="type" header="Type" sortable>
      <template #body="{ data }">
        <Tag
          :value="formatType(liability ? data.liabilityType || data.type : data.type)"
          :severity="typeSeverity(liability ? data.liabilityType || data.type : data.type)"
        />
      </template>
    </Column>
    <Column header="Source">
      <template #body="{ data }">
        <div class="source-cell">
          <Tag :value="data.source === 'plaid' ? 'Plaid' : 'Manual'" :severity="data.source === 'plaid' ? 'info' : 'secondary'" />
          <small v-if="data.institutionName">{{ data.institutionName }}</small>
          <small v-if="data.source === 'plaid' && !data.plaidConnected" class="disconnected">Disconnected</small>
        </div>
      </template>
    </Column>
    <Column field="balance" :header="liability ? 'Amount Owed' : 'Balance'" sortable>
      <template #body="{ data }">
        <span :class="liability ? 'text-negative' : { 'text-positive': data.balance >= 0, 'text-negative': data.balance < 0 }">
          {{ formatCurrency(Math.abs(data.balance), data.currency) }}
        </span>
      </template>
    </Column>
    <Column field="updatedAt" header="Last Updated" sortable>
      <template #body="{ data }">
        <span class="text-muted">{{ formatDate(data.updatedAt) }}</span>
      </template>
    </Column>
    <Column header="Actions" style="width: 15%">
      <template #body="{ data }">
        <div class="action-buttons">
          <template v-if="data.source !== 'plaid'">
            <Button icon="pi pi-pencil" severity="info" text rounded @click="$emit('edit', data)" />
            <Button icon="pi pi-trash" severity="danger" text rounded @click="$emit('delete', data)" />
          </template>
          <span v-else v-tooltip.bottom="'Plaid manages this account. Use Settings to disconnect the institution.'" class="managed-icon">
            <i class="pi pi-lock"></i>
          </span>
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
  liability?: boolean
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
    mortgage: 'info',
    student_loan: 'warn',
    car_loan: 'secondary',
    personal_loan: 'info',
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

.source-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.source-cell small {
  color: #94a3b8;
}

.source-cell .disconnected {
  color: #fbbf24;
}

.managed-icon {
  color: #64748b;
  padding: 8px;
}
</style>
