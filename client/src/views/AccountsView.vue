<template>
  <div class="accounts-view">
    <div class="view-toolbar">
      <Button label="Add Account" icon="pi pi-plus" @click="openCreate" />
    </div>

    <AccountList :accounts="accounts" @edit="openEdit" @delete="onDelete" />

    <Dialog v-model:visible="dialogVisible" :header="editingAccount ? 'Edit Account' : 'New Account'" modal :style="{ width: '450px' }">
      <AccountForm :account="editingAccount" @save="onSave" @cancel="dialogVisible = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Account } from '@/types'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '@/services/api'
import AccountList from '@/components/accounts/AccountList.vue'
import AccountForm from '@/components/accounts/AccountForm.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const accounts = ref<Account[]>([])
const dialogVisible = ref(false)
const editingAccount = ref<Account | null>(null)

async function loadAccounts() {
  accounts.value = await getAccounts()
}

function openCreate() {
  editingAccount.value = null
  dialogVisible.value = true
}

function openEdit(account: Account) {
  editingAccount.value = account
  dialogVisible.value = true
}

async function onSave(data: { name: string; type: string; balance: number }) {
  const payload = data as Pick<Account, 'name' | 'type' | 'balance' | 'currency'>
  if (editingAccount.value) {
    await updateAccount(editingAccount.value._id, payload)
  } else {
    await createAccount(payload)
  }
  dialogVisible.value = false
  await loadAccounts()
}

async function onDelete(account: Account) {
  await deleteAccount(account._id)
  await loadAccounts()
}

onMounted(loadAccounts)
</script>

<style scoped>
.accounts-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-toolbar {
  display: flex;
  justify-content: flex-start;
}
</style>
