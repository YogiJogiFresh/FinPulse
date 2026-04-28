<template>
  <DataTable :value="transactions" :loading="loading" stripedRows dataKey="_id" paginator :rows="15" class="transaction-table">
    <Column field="date" header="Date" sortable>
      <template #body="{ data }">
        {{ formatDate(data.date) }}
      </template>
    </Column>
    <Column field="description" header="Description" sortable />
    <Column field="amount" header="Amount" sortable>
      <template #body="{ data }">
        <span :class="amountClass(data.type)">
          {{ data.type === 'expense' ? '-' : '' }}{{ formatCurrency(data.amount) }}
        </span>
      </template>
    </Column>
    <Column field="category" header="Category" sortable />
    <Column field="type" header="Type" sortable>
      <template #body="{ data }">
        <Tag :value="data.type" :severity="typeSeverity(data.type)" />
      </template>
    </Column>
    <Column field="accountId" header="Account">
      <template #body="{ data }">
        {{ accountName(data.accountId) }}
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
import { computed } from 'vue'
import type { Transaction, Account } from '@/types'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const props = defineProps<{
  transactions: Transaction[]
  accounts: Account[]
  loading?: boolean
}>()

defineEmits<{
  edit: [transaction: Transaction]
  delete: [transaction: Transaction]
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function amountClass(type: string): string {
  if (type === 'income') return 'text-income'
  if (type === 'expense') return 'text-expense'
  return 'text-transfer'
}

function typeSeverity(type: string): 'success' | 'danger' | 'info' {
  if (type === 'income') return 'success'
  if (type === 'expense') return 'danger'
  return 'info'
}

const accountMap = computed(() =>
  Object.fromEntries(props.accounts.map(a => [a._id, a.name]))
)

function accountName(accountId: string): string {
  return accountMap.value[accountId] || accountId
}
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 4px;
}

.text-income {
  color: #4ade80;
  font-weight: 600;
}

.text-expense {
  color: #f87171;
  font-weight: 600;
}

.text-transfer {
  color: #38bdf8;
  font-weight: 600;
}
</style>
