<template>
  <form class="budget-form" @submit.prevent="onSubmit">
    <div class="form-field">
      <label for="name">Category Name</label>
      <InputText id="name" v-model="form.name" placeholder="e.g. Groceries" class="w-full" :invalid="nameError" @input="nameError = false" />
      <small v-if="nameError" class="error-text">Category name is required.</small>
    </div>
    <div class="form-field">
      <label for="monthlyLimit">Monthly Limit</label>
      <InputNumber id="monthlyLimit" v-model="form.monthlyLimit" mode="currency" currency="USD" class="w-full" />
    </div>
    <div class="form-field">
      <label for="color">Color</label>
      <div class="color-row">
        <ColorPicker v-model="form.color" />
        <InputText v-model="form.colorHex" placeholder="#4ade80" class="color-input" @input="onColorHexInput" />
      </div>
    </div>
    <div class="form-actions">
      <Button label="Cancel" severity="secondary" text @click="$emit('cancel')" />
      <Button type="submit" label="Save" icon="pi pi-check" />
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, watch, watchEffect } from 'vue'
import type { BudgetCategory } from '@/types'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ColorPicker from 'primevue/colorpicker'
import Button from 'primevue/button'

const props = defineProps<{
  category?: BudgetCategory | null
}>()

const emit = defineEmits<{
  save: [data: { name: string; monthlyLimit: number; color: string }]
  cancel: []
}>()

const nameError = ref(false)

const form = reactive({
  name: '',
  monthlyLimit: 0,
  color: '4ade80',
  colorHex: '#4ade80'
})

watchEffect(() => {
  if (props.category) {
    form.name = props.category.name
    form.monthlyLimit = props.category.monthlyLimit
    form.color = props.category.color.replace('#', '')
    form.colorHex = props.category.color.startsWith('#') ? props.category.color : `#${props.category.color}`
  }
})

watch(() => form.color, (val) => {
  if (/^[0-9a-fA-F]{6}$/.test(val)) {
    form.colorHex = `#${val}`
  }
})

function onColorHexInput() {
  const hex = form.colorHex.replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    form.color = hex
  }
}

function onSubmit() {
  if (!form.name.trim()) {
    nameError.value = true
    return
  }
  emit('save', {
    name: form.name,
    monthlyLimit: form.monthlyLimit,
    color: `#${form.color}`
  })
}
</script>

<style scoped>
.budget-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-weight: 600;
  font-size: 0.875rem;
  color: #cbd5e1;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 7.5rem;
}

.error-text {
  color: #f87171;
  font-size: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.w-full {
  width: 100%;
}
</style>
