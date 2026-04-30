<template>
  <div class="budget-overview">
    <div v-for="item in progress" :key="item._id" class="budget-row">
      <div class="budget-info">
        <span class="color-swatch" :style="{ backgroundColor: item.color }"></span>
        <span class="category-name">{{ item.name }}</span>
        <span class="budget-amounts">
          {{ formatCurrency(item.spent) }} / {{ formatCurrency(item.monthlyLimit) }}
        </span>
      </div>
      <div class="budget-bar-container">
        <ProgressBar :value="Math.min(item.percentage, 100)" :class="progressClass(item.percentage)" />
      </div>
      <span class="budget-pct">{{ item.percentage.toFixed(0) }}%</span>
    </div>
    <div v-if="progress.length === 0" class="empty-state">
      No budget categories yet. Add one to start tracking.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BudgetProgress } from '@/types'
import ProgressBar from 'primevue/progressbar'

defineProps<{
  progress: BudgetProgress[]
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function progressClass(percentage: number): string {
  if (percentage > 90) return 'progress-danger'
  if (percentage > 75) return 'progress-warn'
  return 'progress-ok'
}
</script>

<style scoped>
.budget-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.budget-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.budget-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 16rem;
}

.color-swatch {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.category-name {
  font-weight: 600;
  color: #f1f5f9;
  min-width: 6.25rem;
}

.budget-amounts {
  font-size: 0.85rem;
  color: #94a3b8;
  white-space: nowrap;
}

.budget-bar-container {
  flex: 1;
}

.budget-pct {
  font-weight: 600;
  min-width: 3rem;
  text-align: right;
  color: #cbd5e1;
}

:deep(.progress-ok .p-progressbar-value) {
  background-color: #4ade80;
}

:deep(.progress-warn .p-progressbar-value) {
  background-color: #fbbf24;
}

:deep(.progress-danger .p-progressbar-value) {
  background-color: #f87171;
}

.empty-state {
  text-align: center;
  color: #64748b;
  padding: 40px;
}
</style>
