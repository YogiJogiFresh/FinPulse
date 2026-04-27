<template>
  <div class="transactions-view">
    <div class="view-toolbar">
      <Button label="Add Transaction" icon="pi pi-plus" @click="openCreate" />
    </div>

    <TransactionList
      :transactions="transactions"
      :accounts="accounts"
      @edit="openEdit"
      @delete="onDelete"
    />

    <Dialog v-model:visible="dialogVisible" :header="editingTransaction ? 'Edit Transaction' : 'New Transaction'" modal :style="{ width: '500px' }">
      <TransactionForm
        :transaction="editingTransaction"
        :accounts="accounts"
        @save="onSave"
        @cancel="dialogVisible = false"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Transaction, Account } from '@/types'
import { getTransactions, createTransaction, updateTransaction, deleteTransaction, getAccounts } from '@/services/api'
import TransactionList from '@/components/transactions/TransactionList.vue'
import TransactionForm from '@/components/transactions/TransactionForm.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const transactions = ref<Transaction[]>([])
const accounts = ref<Account[]>([])
const dialogVisible = ref(false)
const editingTransaction = ref<Transaction | null>(null)

async function loadData() {
  const [txns, accts] = await Promise.all([getTransactions(), getAccounts()])
  transactions.value = txns
  accounts.value = accts
}

function openCreate() {
  editingTransaction.value = null
  dialogVisible.value = true
}

function openEdit(transaction: Transaction) {
  editingTransaction.value = transaction
  dialogVisible.value = true
}

async function onSave(data: { accountId: string; date: string; description: string; amount: number; category: string; type: string; notes: string }) {
  const payload = data as Pick<Transaction, 'accountId' | 'date' | 'description' | 'amount' | 'category' | 'type' | 'notes'>
  if (editingTransaction.value) {
    await updateTransaction(editingTransaction.value._id, payload)
  } else {
    await createTransaction(payload)
  }
  dialogVisible.value = false
  await loadData()
}

async function onDelete(transaction: Transaction) {
  await deleteTransaction(transaction._id)
  await loadData()
}

onMounted(loadData)
</script>

<style scoped>
.transactions-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
