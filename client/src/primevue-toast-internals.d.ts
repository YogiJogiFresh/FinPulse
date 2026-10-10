declare module 'primevue/toasteventbus' {
  const ToastEventBus: {
    emit(event: string, payload?: unknown): void
  }
  export default ToastEventBus
}

declare module 'primevue/usetoast' {
  import type { InjectionKey } from 'vue'
  import type { ToastServiceMethods } from 'primevue/toastservice'

  export const PrimeVueToastSymbol: InjectionKey<ToastServiceMethods>
  export function useToast(): ToastServiceMethods
}
