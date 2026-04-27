<template>
  <header class="app-header">
    <h1 class="page-title">{{ pageTitle }}</h1>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const pageTitle = computed(() => {
  return (route.meta?.title as string) || route.name?.toString() || 'FinPulse'
})
</script>

<style scoped>
.app-header {
  padding: 20px 24px 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}
</style>
