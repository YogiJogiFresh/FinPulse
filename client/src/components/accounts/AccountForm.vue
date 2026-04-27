<template>
  <form class="account-form" @submit.prevent="onSubmit">
    <div class="form-field">
      <label for="name">Name</label>
      <InputText id="name" v-model="form.name" placeholder="Account name" class="w-full" />
    </div>
    <div class="form-field">
      <label for="type">Type</label>
      <Select
        id="type"
        v-model="form.type"
        :options="accountTypes"
        optionLabel="label"
        optionValue="value"
        placeholder="Select type"
        class="w-full"
      />
    </div>
    <div class="form-field">
      <label for="balance">Balance</label>
      <InputNumber id="balance" v-model="form.balance" mode="currency" currency="USD" class="w-full" />
    </div>
    <div class="form-actions">
      <Button label="Cancel" severity="secondary" text @click="$emit('cancel')" />
      <Button type="submit" label="Save" icon="pi pi-check" />
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, watchEffect } from 'vue'
import type { Account } from '@/types'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'

const props = defineProps<{
  account?: Account | null
}>()

const emit = defineEmits<{
  save: [data: { name: string; type: string; balance: number }]
  cancel: []
}>()

const accountTypes = [
  { label: 'Checking', value: 'checking' },
  { label: 'Savings', value: 'savings' },
  { label: 'Investment', value: 'investment' },
  { label: 'Retirement', value: 'retirement' },
  { label: 'Cash', value: 'cash' },
  { label: 'Other', value: 'other' }
]

const form = reactive({
  name: '',
  type: 'checking',
  balance: 0
})

watchEffect(() => {
  if (props.account) {
    form.name = props.account.name
    form.type = props.account.type
    form.balance = props.account.balance
  }
})

function onSubmit() {
  emit('save', { ...form })
}
</script>

<style scoped>
.account-form {
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
