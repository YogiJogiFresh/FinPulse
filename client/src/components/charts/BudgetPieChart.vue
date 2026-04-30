<template>
  <div class="chart-container">
    <Pie v-if="hasData" :data="chartData" :options="chartOptions" />
    <div v-else class="empty-chart">
      <i class="pi pi-chart-pie"></i>
      <span>No budget data to display</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import type { BudgetCategory } from '@/types'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  categories: BudgetCategory[]
  monthlyIncome: number
}>()

const hasData = computed(() => props.categories.length > 0 && props.monthlyIncome > 0)

const chartData = computed(() => {
  const labels = props.categories.map(c => c.name)
  const values = props.categories.map(c => c.monthlyLimit)
  const colors = props.categories.map(c => c.color)

  const totalBudgeted = values.reduce((sum, v) => sum + v, 0)
  const remaining = props.monthlyIncome - totalBudgeted

  if (remaining > 0) {
    labels.push('Unbudgeted')
    values.push(remaining)
    colors.push('#334155')
  }

  return {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 2,
      borderColor: '#1e293b'
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#cbd5e1',
        padding: 12,
        usePointStyle: true,
        pointStyle: 'rectRounded'
      }
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const value = ctx.parsed
          const total = ctx.dataset.data.reduce((s: number, v: number) => s + v, 0)
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
          const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
          return `${ctx.label}: ${formatted} (${pct}%)`
        }
      }
    }
  }
}
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 18.75rem;
}

.empty-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: #64748b;
  font-size: 0.9rem;
}

.empty-chart i {
  font-size: 2rem;
}
</style>
