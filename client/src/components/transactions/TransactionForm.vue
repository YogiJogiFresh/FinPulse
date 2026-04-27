<template>
  <form class="transaction-form" @submit.prevent="onSubmit">
    <div class="form-field">
      <label for="accountId">Account</label>
      <Select
        id="accountId"
        v-model="form.accountId"
        :options="accounts"
        optionLabel="name"
        optionValue="_id"
        placeholder="Select account"
        class="w-full"
      />
    </div>
    <div class="form-field">
      <label for="date">Date</label>
      <DatePicker id="date" v-model="form.date" dateFormat="yy-mm-dd" class="w-full" />
    </div>
    <div class="form-field">
      <label for="description">Description</label>
      <InputText id="description" v-model="form.description" placeholder="Transaction description" class="w-full" />
    </div>
    <div class="form-field">
      <label for="amount">Amount</label>
      <InputNumber id="amount" v-model="form.amount" mode="currency" currency="USD" class="w-full" />
    </div>
    <div class="form-field">
      <label for="category">Category</label>
      <InputText id="category" v-model="form.category" placeholder="e.g. Food, Rent, Salary" class="w-full" />
    </div>
    <div class="form-field">
      <label for="type">Type</label>
      <Select
        id="type"
        v-model="form.type"
        :options="transactionTypes"
        optionLabel="label"
        optionValue="value"
        placeholder="Select type"
        class="w-full"
      />
    </div>
    <div class="form-field">
      <label for="notes">Notes</label>
      <InputText id="notes" v-model="form.notes" placeholder="Optional notes" class="w-full" />
    </div>
    <div class="form-actions">
      <Button label="Cancel" severity="secondary" text @click="$emit('cancel')" />
      <Button type="submit" label="Save" icon="pi pi-check" />
    </div>
  </form>
</template>

<script setup lang="ts">
import { reactive, watchEffect } from 'vue'
import type { Transaction, Account } from '@/types'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'

const props = defineProps<{
  transaction?: Transaction | null
  accounts: Account[]
}>()

const emit = defineEmits<{
  save: [data: { accountId: string; date: string; description: string; amount: number; category: string; type: string; notes: string }]
  cancel: []
}>()

const transactionTypes = [
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
  { label: 'Transfer', value: 'transfer' }
]

const form = reactive({
  accountId: '',
  date: null as Date | null,
  description: '',
  amount: 0,
  category: '',
  type: 'expense',
  notes: ''
})

watchEffect(() => {
  if (props.transaction) {
    form.accountId = props.transaction.accountId
    form.date = new Date(props.transaction.date)
    form.description = props.transaction.description
    form.amount = props.transaction.amount
    form.category = props.transaction.category
    form.type = props.transaction.type
    form.notes = props.transaction.notes || ''
  }
})

function onSubmit() {
  emit('save', {
    accountId: form.accountId,
    date: form.date ? form.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    description: form.description,
    amount: form.amount,
    category: form.category,
    type: form.type,
    notes: form.notes
  })
}
</script>

<style scoped>
.transaction-form {
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
