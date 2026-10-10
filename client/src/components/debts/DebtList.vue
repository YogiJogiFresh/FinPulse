<template>
  <DataTable :value="debts" :loading="loading" stripedRows dataKey="_id" paginator :rows="15" class="debt-table">
    <Column field="name" header="Name" sortable />
    <Column v-if="!creditCards" field="type" header="Type" sortable>
      <template #body="{ data }">
        <Tag :value="formatType(data.type)" :severity="typeSeverity(data.type)" />
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
    <Column field="currentBalance" header="Current Balance" sortable>
      <template #body="{ data }">
        <span class="text-expense">{{ formatCurrency(data.currentBalance) }}</span>
      </template>
    </Column>
    <Column v-if="creditCards" field="statementBalance" header="Statement Balance">
      <template #body="{ data }">
        <div class="statement-cell">
          <span>{{ data.statementBalance == null ? 'Not entered' : formatCurrency(data.statementBalance) }}</span>
          <small v-if="data.statementBalance != null" :class="{ stale: data.statementIsStale }">
            {{ data.statementIsStale ? 'Stale' : 'Current month' }}
          </small>
        </div>
      </template>
    </Column>
    <Column v-if="creditCards" field="creditLimit" header="Limit">
      <template #body="{ data }">
        {{ data.creditLimit == null ? 'Unavailable' : formatCurrency(data.creditLimit) }}
      </template>
    </Column>
    <Column v-if="creditCards" field="utilization" header="Utilization">
      <template #body="{ data }">
        <span v-if="data.utilization != null" :class="utilizationClass(data.utilization)">
          {{ data.utilization.toFixed(1) }}%
        </span>
        <span v-else>Unavailable</span>
      </template>
    </Column>
    <Column v-if="creditCards" field="plannedPayment" header="Planned Payment" sortable>
      <template #body="{ data }">
        <div class="statement-cell">
          <span>{{ formatCurrency(data.plannedPayment) }}</span>
          <small>{{ strategyLabel(data.paymentStrategy) }}</small>
        </div>
      </template>
    </Column>
    <Column v-if="!creditCards" field="monthlyPayment" header="Monthly Payment" sortable>
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
    <Column header="Actions" style="width: 15%">
      <template #body="{ data }">
        <div class="action-buttons">
          <template v-if="data.source === 'plaid'">
            <Button
              v-if="!data.hasManualMetadata"
              v-tooltip.bottom="'Add payment, APR, and notes'"
              icon="pi pi-plus"
              severity="info"
              text
              rounded
              @click="$emit('addDetails', data)"
            />
            <template v-else>
              <Button v-tooltip.bottom="'Edit manual debt details'" icon="pi pi-pencil" severity="info" text rounded @click="$emit('edit', data)" />
              <Button v-tooltip.bottom="'Unlink manual details'" icon="pi pi-times" severity="warn" text rounded @click="$emit('unlink', data)" />
            </template>
          </template>
          <template v-else>
            <Button icon="pi pi-pencil" severity="info" text rounded @click="$emit('edit', data)" />
            <Button icon="pi pi-trash" severity="danger" text rounded @click="$emit('delete', data)" />
          </template>
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
  loading?: boolean
  creditCards?: boolean
}>()

defineEmits<{
  edit: [debt: Debt]
  delete: [debt: Debt]
  addDetails: [debt: Debt]
  unlink: [debt: Debt]
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

function strategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    pay_in_full: 'Pay in full',
    custom: 'Custom target',
    exclude: 'Excluded'
  }
  return labels[strategy] || 'Pay in full'
}

function utilizationClass(utilization: number): string {
  if (utilization >= 50) return 'utilization-high'
  if (utilization >= 30) return 'utilization-warn'
  return 'utilization-good'
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

.statement-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.statement-cell small {
  color: #94a3b8;
}

.statement-cell small.stale,
.utilization-high {
  color: #f87171;
}

.utilization-warn {
  color: #fbbf24;
}

.utilization-good {
  color: #4ade80;
}
</style>
