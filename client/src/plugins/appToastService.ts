import type { Plugin } from 'vue'
import type { ToastMessageOptions } from 'primevue/toast'
import type { ToastServiceMethods } from 'primevue/toastservice'
import ToastEventBus from 'primevue/toasteventbus'
import { PrimeVueToastSymbol } from 'primevue/usetoast'
import { createAppNotification } from '@/services/api'
import type { AppNotificationSeverity } from '@/types'

type PersistedToastMessage = ToastMessageOptions & {
  expandedDetail?: string
}

function severity(value: ToastMessageOptions['severity']): AppNotificationSeverity {
  if (value === 'success') return 'success'
  if (value === 'warn') return 'warn'
  if (value === 'error') return 'error'
  return 'info'
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

const AppToastService: Plugin = {
  install(app) {
    const service: ToastServiceMethods = {
      add(message) {
        ToastEventBus.emit('add', message)
        const persistedMessage = message as PersistedToastMessage
        void createAppNotification({
          severity: severity(message.severity),
          summary: text(message.summary) || 'Notification',
          detail: text(message.detail),
          expandedDetail: text(persistedMessage.expandedDetail)
        }).catch(error => {
          console.error('Unable to persist app notification:', error)
        })
      },
      remove(message) {
        ToastEventBus.emit('remove', message)
      },
      removeGroup(group) {
        ToastEventBus.emit('remove-group', group)
      },
      removeAllGroups() {
        ToastEventBus.emit('remove-all-groups')
      }
    }

    app.config.globalProperties.$toast = service
    app.provide(PrimeVueToastSymbol, service)
  }
}

export default AppToastService
