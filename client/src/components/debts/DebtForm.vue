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
      <label for="currentBalance">Current Balance</label>
      <InputNumber
        id="currentBalance"
        v-model="form.currentBalance"
        mode="currency"
        currency="USD"
        class="w-full"
        :disabled="debt?.source === 'plaid'"
      />
      <small v-if="debt?.source === 'plaid'" class="form-hint">Updated automatically by Plaid.</small>
    </div>

    <template v-if="form.type === 'credit_card'">
      <div class="form-field">
        <label for="paymentStrategy">Payment Strategy</label>
        <Select
          id="paymentStrategy"
          v-model="form.paymentStrategy"
          :options="paymentStrategies"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
      <div class="form-field">
        <label for="statementBalance">Statement Balance</label>
        <InputNumber
          id="statementBalance"
          v-model="form.statementBalance"
          mode="currency"
          currency="USD"
          class="w-full"
          placeholder="Not entered"
        />
        <small class="form-hint">
          Enter manually from your latest statement. Saving a changed value marks it current for this month.
        </small>
      </div>
      <div v-if="form.paymentStrategy === 'custom'" class="form-field">
        <label for="monthlyPayment">Custom Monthly Target</label>
        <InputNumber id="monthlyPayment" v-model="form.monthlyPayment" mode="currency" currency="USD" class="w-full" />
      </div>
    </template>

    <div v-else class="form-field">
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
  save: [data: {
    name: string
    type: string
    currentBalance: number
    monthlyPayment: number
    interestRate: number
    notes: string
    paymentStrategy: string
    statementBalance: number | null
  }]
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

const paymentStrategies = [
  { label: 'Pay in full', value: 'pay_in_full' },
  { label: 'Custom monthly target', value: 'custom' },
  { label: 'Exclude from monthly payment budget', value: 'exclude' }
]

const form = reactive({
  name: '',
  type: 'other',
  currentBalance: 0,
  monthlyPayment: 0,
  interestRate: 0,
  notes: '',
  paymentStrategy: 'pay_in_full',
  statementBalance: null as number | null
})

watchEffect(() => {
  if (props.debt) {
    form.name = props.debt.name
    form.type = props.debt.type
    form.currentBalance = props.debt.currentBalance
    form.monthlyPayment = props.debt.monthlyPayment
    form.interestRate = props.debt.interestRate
    form.notes = props.debt.notes || ''
    form.paymentStrategy = props.debt.paymentStrategy || 'pay_in_full'
    form.statementBalance = props.debt.statementBalance ?? null
  }
})

function onSubmit() {
  emit('save', {
    name: form.name,
    type: form.type,
    currentBalance: form.currentBalance,
    monthlyPayment: form.monthlyPayment,
    interestRate: form.interestRate,
    notes: form.notes,
    paymentStrategy: form.type === 'credit_card' ? form.paymentStrategy : 'fixed',
    statementBalance: form.type === 'credit_card' ? form.statementBalance : null
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

.form-hint {
  color: #64748b;
  font-size: 0.75rem;
}
</style>
