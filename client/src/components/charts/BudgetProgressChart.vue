<template>
  <div class="chart-container">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { BudgetProgress } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  data: BudgetProgress[]
}>()

const chartData = computed(() => {
  const labels = props.data.map(b => b.name)
  return {
    labels,
    datasets: [
      {
        label: 'Spent',
        data: props.data.map(b => b.spent),
        backgroundColor: '#f87171'
      },
      {
        label: 'Limit',
        data: props.data.map(b => b.monthlyLimit),
        backgroundColor: '#334155'
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#cbd5e1',
        padding: 16
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#1e293b' }
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#1e293b' }
    }
  }
}
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
}
</style>
