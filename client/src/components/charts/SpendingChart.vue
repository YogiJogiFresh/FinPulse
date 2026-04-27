<template>
  <div class="chart-container">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  data: Record<string, number>
}>()

const defaultColors = [
  '#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#2dd4bf', '#e879f9', '#818cf8', '#34d399'
]

const chartData = computed(() => {
  const labels = Object.keys(props.data)
  const values = Object.values(props.data)
  return {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => defaultColors[i % defaultColors.length]),
      borderWidth: 0
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
        padding: 16
      }
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
