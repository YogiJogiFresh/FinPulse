<template>
  <header class="app-header">
    <div class="title-group">
      <h1 class="page-title">{{ pageTitle }}</h1>
      <span
        v-if="runtimeProfile"
        class="profile-badge"
        :class="runtimeProfile.kind"
      >
        {{ runtimeProfile.displayName }}
      </span>
    </div>
    <NotificationCenter />
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import NotificationCenter from './NotificationCenter.vue'
import { getRuntimeProfile } from '@/services/api'
import type { RuntimeProfileInfo } from '@/types'

const route = useRoute()
const runtimeProfile = ref<RuntimeProfileInfo | null>(null)

const pageTitle = computed(() => {
  return (route.meta?.title as string) || route.name?.toString() || 'FinPulse'
})

onMounted(async () => {
  try {
    runtimeProfile.value = await getRuntimeProfile()
  } catch {
    runtimeProfile.value = null
  }
})
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.profile-badge {
  padding: 0.25rem 0.55rem;
  color: #e2e8f0;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 999px;
}

.profile-badge.development {
  color: #fde68a;
  background: rgb(146 64 14 / 35%);
  border-color: #b45309;
}

.profile-badge.production {
  color: #bbf7d0;
  background: rgb(20 83 45 / 35%);
  border-color: #15803d;
}
</style>
