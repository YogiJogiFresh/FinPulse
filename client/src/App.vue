<template>
  <div class="app-layout">
    <AppSidebar v-model="sidebarCollapsed" />
    <div class="app-main" :style="{ marginLeft: sidebarCollapsed ? '4rem' : '13.75rem' }">
      <AppHeader />
      <main class="app-content">
        <router-view />
      </main>
    </div>
    <Toast position="top-right" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import Toast from 'primevue/toast'
import { getSetting } from '@/services/api'

const sidebarCollapsed = ref(false)

onMounted(async () => {
  try {
    const val = await getSetting('sidebar_collapsed')
    sidebarCollapsed.value = val === 'true'
  } catch {
    // default expanded
  }
})
</script>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Dark theme */
:root {
  --bg-primary: #0f172a;
  --bg-card: #1e293b;
  --bg-input: #0f172a;
  --border: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #e2e8f0;
  --text-muted: #94a3b8;
  --text-dimmed: #64748b;
  --sidebar-bg: #1e293b;
  --accent: #38bdf8;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-secondary);
  min-height: 100vh;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.25s ease;
}

.app-content {
  flex: 1;
  padding: 24px;
}
</style>
