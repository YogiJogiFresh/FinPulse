<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <i class="pi pi-chart-line brand-icon"></i>
      <span v-if="!collapsed" class="brand-text">FinPulse</span>
    </div>
    <nav class="sidebar-nav">
      <router-link to="/" class="nav-link" exact-active-class="active">
        <i class="pi pi-home"></i>
        <span v-if="!collapsed">Dashboard</span>
      </router-link>
      <router-link to="/accounts" class="nav-link" active-class="active">
        <i class="pi pi-wallet"></i>
        <span v-if="!collapsed">Accounts</span>
      </router-link>
      <router-link to="/income" class="nav-link" active-class="active">
        <i class="pi pi-money-bill"></i>
        <span v-if="!collapsed">Income</span>
      </router-link>
      <router-link to="/debts" class="nav-link" active-class="active">
        <i class="pi pi-credit-card"></i>
        <span v-if="!collapsed">Debts</span>
      </router-link>
      <router-link to="/budget" class="nav-link" active-class="active">
        <i class="pi pi-chart-pie"></i>
        <span v-if="!collapsed">Budget</span>
      </router-link>
      <router-link to="/transactions" class="nav-link" active-class="active">
        <i class="pi pi-list"></i>
        <span v-if="!collapsed">Transactions</span>
      </router-link>
      <router-link to="/projection" class="nav-link" active-class="active">
        <i class="pi pi-chart-line"></i>
        <span v-if="!collapsed">Projection</span>
      </router-link>
      <router-link to="/properties" class="nav-link" active-class="active">
        <i class="pi pi-building"></i>
        <span v-if="!collapsed">Properties</span>
      </router-link>
      <router-link to="/settings" class="nav-link" active-class="active">
        <i class="pi pi-cog"></i>
        <span v-if="!collapsed">Settings</span>
      </router-link>
    </nav>
    <div class="sidebar-footer">
      <button class="collapse-btn" @click="toggle" :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'">
        <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"></i>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getSetting, setSetting } from '@/services/api'

const props = defineProps<{ modelValue?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: boolean): void }>()

const collapsed = ref(props.modelValue ?? false)

watch(() => props.modelValue, (val) => {
  if (val !== undefined) collapsed.value = val
})

function toggle() {
  collapsed.value = !collapsed.value
  emit('update:modelValue', collapsed.value)
  setSetting('sidebar_collapsed', collapsed.value ? 'true' : 'false')
}
</script>

<style scoped>
.sidebar {
  width: 220px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background-color: #1e293b;
  display: flex;
  flex-direction: column;
  padding: 0;
  z-index: 100;
  transition: width 0.25s ease;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 24px;
  border-bottom: 1px solid #334155;
  overflow: hidden;
  white-space: nowrap;
}

.collapsed .sidebar-brand {
  justify-content: center;
  padding: 20px 0 24px;
}

.brand-icon {
  font-size: 1.5rem;
  color: #38bdf8;
  flex-shrink: 0;
}

.brand-text {
  font-size: 1.3rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 0.5px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 4px;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background-color 0.2s, color 0.2s;
  overflow: hidden;
  white-space: nowrap;
}

.collapsed .nav-link {
  justify-content: center;
  padding: 12px;
}

.nav-link:hover {
  background-color: #334155;
  color: #e2e8f0;
}

.nav-link.active {
  background-color: #38bdf8;
  color: #0f172a;
}

.nav-link i {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid #334155;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px;
  background: none;
  border: none;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background-color 0.2s, color 0.2s;
}

.collapse-btn:hover {
  background-color: #334155;
  color: #e2e8f0;
}
</style>
