<template>
  <div class="notification-center">
    <button
      class="notification-bell"
      type="button"
      aria-label="Open notification history"
      @click="drawerVisible = true"
    >
      <i class="pi pi-bell"></i>
      <span v-if="unreadCount > 0" class="notification-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <Drawer
      v-model:visible="drawerVisible"
      header="Notifications"
      position="right"
      :style="{ width: 'min(28rem, 92vw)' }"
    >
      <div class="notification-toolbar">
        <span>{{ notifications.length }} saved</span>
        <template v-if="confirmingClear">
          <span class="clear-warning">Clear all history?</span>
          <Button label="Clear All" severity="danger" size="small" @click="clearAll" />
          <Button label="Cancel" severity="secondary" outlined size="small" @click="confirmingClear = false" />
        </template>
        <Button
          v-else
          label="Clear All"
          icon="pi pi-trash"
          severity="danger"
          text
          size="small"
          :disabled="notifications.length === 0"
          @click="confirmingClear = true"
        />
      </div>

      <div v-if="loadError" class="notification-error">
        {{ loadError }}
      </div>
      <template v-else>
        <div v-if="actionError" class="notification-error">
          {{ actionError }}
        </div>
        <div v-if="loading" class="notification-empty">
          Loading notifications...
        </div>
        <div v-else-if="notifications.length === 0" class="notification-empty">
          <i class="pi pi-bell-slash"></i>
          <span>No notifications yet.</span>
        </div>
        <div v-else class="notification-list">
          <article
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-item"
            :class="[`severity-${notification.severity}`, { unread: newlyReadIds.has(notification.id) }]"
          >
          <div class="notification-icon">
            <i :class="severityIcon(notification.severity)"></i>
          </div>
          <div class="notification-content">
            <div class="notification-title-row">
              <strong>{{ notification.summary }}</strong>
              <button
                class="dismiss-button"
                type="button"
                :aria-label="`Dismiss ${notification.summary}`"
                title="Dismiss notification"
                @click="dismiss(notification.id)"
              >
                <i class="pi pi-times"></i>
              </button>
            </div>
            <p v-if="notification.detail">{{ notification.detail }}</p>
            <button
              v-if="notification.expandedDetail"
              class="details-button"
              type="button"
              :aria-expanded="expandedIds.has(notification.id)"
              @click="toggleDetails(notification.id)"
            >
              <i :class="expandedIds.has(notification.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
              Details
            </button>
            <p v-if="notification.expandedDetail && expandedIds.has(notification.id)" class="notification-detail">
              {{ notification.expandedDetail }}
            </p>
            <div class="notification-meta">
              <span>{{ formatDate(notification.createdAt) }}</span>
              <span v-if="sourceLabel(notification.source)">{{ sourceLabel(notification.source) }}</span>
            </div>
          </div>
          </article>
        </div>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import {
  clearAppNotifications,
  dismissAppNotification,
  getAppNotifications,
  markAllAppNotificationsRead,
  onAppNotificationsChanged
} from '@/services/api'
import type { AppNotification, AppNotificationSeverity } from '@/types'

const notifications = ref<AppNotification[]>([])
const drawerVisible = ref(false)
const confirmingClear = ref(false)
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const newlyReadIds = ref<Set<string>>(new Set())
const expandedIds = ref<Set<string>>(new Set())
let removeChangeListener: (() => void) | null = null
let refreshRequest = 0

const unreadCount = computed(() => notifications.value.filter(notification => !notification.readAt).length)

async function refresh() {
  const request = ++refreshRequest
  try {
    const result = await getAppNotifications()
    if (request !== refreshRequest) return
    notifications.value = result
    loadError.value = ''
  } catch (error) {
    if (request !== refreshRequest) return
    loadError.value = error instanceof Error ? error.message : 'Unable to load notification history.'
  } finally {
    if (request === refreshRequest) loading.value = false
  }
}

async function markVisibleNotificationsRead() {
  const unreadIds = notifications.value
    .filter(notification => !notification.readAt)
    .map(notification => notification.id)
  if (unreadIds.length === 0) return

  newlyReadIds.value = new Set([...newlyReadIds.value, ...unreadIds])
  actionError.value = ''
  try {
    await markAllAppNotificationsRead()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to update notification read status.'
  }
}

async function dismiss(id: string) {
  actionError.value = ''
  try {
    await dismissAppNotification(id)
    notifications.value = notifications.value.filter(notification => notification.id !== id)
    newlyReadIds.value.delete(id)
    expandedIds.value.delete(id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to dismiss notification.'
  }
}

function toggleDetails(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

async function clearAll() {
  actionError.value = ''
  try {
    await clearAppNotifications()
    confirmingClear.value = false
    notifications.value = []
    newlyReadIds.value = new Set()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to clear notification history.'
  }
}

function severityIcon(severity: AppNotificationSeverity): string {
  if (severity === 'success') return 'pi pi-check-circle'
  if (severity === 'warn') return 'pi pi-exclamation-triangle'
  if (severity === 'error') return 'pi pi-times-circle'
  return 'pi pi-info-circle'
}

function sourceLabel(source: string): string {
  if (source === 'plaid_scheduler') return 'Plaid scheduler'
  if (source === 'renderer' || source === 'app') return ''
  return source.replace(/_/g, ' ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

watch(drawerVisible, async visible => {
  if (!visible) {
    confirmingClear.value = false
    newlyReadIds.value = new Set()
    actionError.value = ''
    return
  }
  await refresh()
  await markVisibleNotificationsRead()
})

onMounted(async () => {
  await refresh()
  removeChangeListener = onAppNotificationsChanged(() => {
    void (async () => {
      await refresh()
      if (drawerVisible.value) await markVisibleNotificationsRead()
    })()
  })
})

onUnmounted(() => {
  removeChangeListener?.()
})
</script>

<style scoped>
.notification-center {
  position: relative;
}

.notification-bell {
  position: relative;
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  color: #cbd5e1;
  cursor: pointer;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 50%;
}

.notification-bell:hover {
  color: #f1f5f9;
  border-color: #38bdf8;
}

.notification-badge {
  position: absolute;
  top: -0.3rem;
  right: -0.4rem;
  min-width: 1.25rem;
  padding: 0.1rem 0.3rem;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: center;
  background: #ef4444;
  border: 2px solid #0f172a;
  border-radius: 999px;
}

.notification-toolbar {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.notification-toolbar > span:first-child {
  margin-right: auto;
}

.clear-warning {
  color: #fca5a5;
}

.notification-list {
  display: grid;
  gap: 0.75rem;
}

.notification-item {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  gap: 0.75rem;
  padding: 0.85rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-left-width: 3px;
  border-radius: 8px;
}

.notification-item.unread {
  background: #172033;
}

.severity-success {
  border-left-color: #22c55e;
}

.severity-info {
  border-left-color: #38bdf8;
}

.severity-warn {
  border-left-color: #f59e0b;
}

.severity-error {
  border-left-color: #ef4444;
}

.severity-success .notification-icon {
  color: #4ade80;
}

.severity-info .notification-icon {
  color: #7dd3fc;
}

.severity-warn .notification-icon {
  color: #fbbf24;
}

.severity-error .notification-icon {
  color: #f87171;
}

.notification-title-row {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.5rem;
  color: #f1f5f9;
}

.notification-content p {
  margin: 0.35rem 0 0;
  color: #cbd5e1;
  font-size: 0.85rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.notification-detail {
  white-space: pre-line;
}

.details-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0 0;
  color: #7dd3fc;
  font-size: 0.8rem;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.details-button:hover {
  color: #bae6fd;
}

.details-button i {
  font-size: 0.7rem;
}

.dismiss-button {
  padding: 0.15rem;
  color: #94a3b8;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.dismiss-button:hover {
  color: #f1f5f9;
}

.notification-meta {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.5rem;
  color: #64748b;
  font-size: 0.72rem;
  text-transform: capitalize;
}

.notification-empty {
  display: grid;
  min-height: 12rem;
  place-items: center;
  align-content: center;
  gap: 0.75rem;
  color: #64748b;
}

.notification-empty i {
  font-size: 2rem;
}

.notification-error {
  padding: 0.75rem;
  color: #fecaca;
  background: rgb(127 29 29 / 25%);
  border: 1px solid #991b1b;
  border-radius: 6px;
}
</style>
