<template>
  <div class="chart-container">
    <Pie v-if="hasData" :data="chartData" :options="chartOptions" />
    <div v-else class="empty-chart">
      <i class="pi pi-chart-pie"></i>
      <span>No accounts to display</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Pie } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import type { Account } from '@/types'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  accounts: Account[]
}>()

const typeColors: Record<string, string> = {
  checking: '#38bdf8',
  savings: '#4ade80',
  investment: '#a78bfa',
  retirement: '#fbbf24',
  credit_card: '#f87171',
  cash: '#2dd4bf',
  other: '#64748b'
}

const typeLabels: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  investment: 'Investment',
  retirement: 'Retirement',
  credit_card: 'Credit Card',
  cash: 'Cash',
  other: 'Other'
}

const hasData = computed(() => props.accounts.length > 0)

const groupedByType = computed(() => {
  const groups: Record<string, number> = {}
  for (const acct of props.accounts) {
    const type = acct.type || 'other'
    groups[type] = (groups[type] || 0) + acct.balance
  }
  return groups
})

const chartData = computed(() => {
  const types = Object.keys(groupedByType.value).sort()
  const labels = types.map(t => typeLabels[t] || t)
  const values = types.map(t => groupedByType.value[t])
  const colors = types.map(t => typeColors[t] || '#64748b')

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
