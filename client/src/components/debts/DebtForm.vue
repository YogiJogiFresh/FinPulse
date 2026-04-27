<template>
  <form class="debt-form" @submit.prevent="onSubmit">
    <div class="form-field">
      <label for="name">Name</label>
      <InputText id="name" v-model="form.name" placeholder="e.g. Student Loan, Car Payment" class="w-full" />
    </div>
    <div class="form-field">
      <label for="type">Type</label>
      <Select
        id="type"
        v-model="form.type"
        :options="debtTypes"
        optionLabel="label"
        optionValue="value"
        placeholder="Select type"
        class="w-full"
      />
    </div>
    <div class="form-field">
      <label for="totalDebt">Total Debt</label>
      <InputNumber id="totalDebt" v-model="form.totalDebt" mode="currency" currency="USD" class="w-full" />
    </div>
    <div class="form-field">
      <label for="monthlyPayment">Monthly Payment</label>
      <InputNumber id="monthlyPayment" v-model="form.monthlyPayment" mode="currency" currency="USD" class="w-full" />
    </div>
    <div class="form-field">
      <label for="interestRate">Interest Rate (%)</label>
      <InputNumber id="interestRate" v-model="form.interestRate" :minFractionDigits="1" :maxFractionDigits="2" suffix="%" class="w-full" />
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
import type { Debt } from '@/types'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Button from 'primevue/button'

const props = defineProps<{
  debt?: Debt | null
}>()

const emit = defineEmits<{
  save: [data: { name: string; type: string; totalDebt: number; monthlyPayment: number; interestRate: number; notes: string }]
  cancel: []
}>()

const debtTypes = [
  { label: 'Student Loan', value: 'student_loan' },
  { label: 'Car Loan', value: 'car_loan' },
  { label: 'Mortgage', value: 'mortgage' },
  { label: 'Credit Card', value: 'credit_card' },
  { label: 'Personal Loan', value: 'personal_loan' },
  { label: 'Medical', value: 'medical' },
  { label: 'Other', value: 'other' }
]

const form = reactive({
  name: '',
  type: 'other',
  totalDebt: 0,
  monthlyPayment: 0,
  interestRate: 0,
  notes: ''
})

watchEffect(() => {
  if (props.debt) {
    form.name = props.debt.name
    form.type = props.debt.type
    form.totalDebt = props.debt.totalDebt
    form.monthlyPayment = props.debt.monthlyPayment
    form.interestRate = props.debt.interestRate
    form.notes = props.debt.notes || ''
  }
})

function onSubmit() {
  emit('save', {
    name: form.name,
    type: form.type,
    totalDebt: form.totalDebt,
    monthlyPayment: form.monthlyPayment,
    interestRate: form.interestRate,
    notes: form.notes
  })
}
</script>

<style scoped>
.debt-form {
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
