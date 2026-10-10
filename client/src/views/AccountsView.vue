<template>
  <div class="accounts-view">
    <div class="view-toolbar">
      <Button label="Add Account" icon="pi pi-plus" @click="openCreate" />
    </div>

    <section class="account-section">
      <h3>Assets</h3>
      <AccountList :accounts="assetAccounts" :loading="loading" @edit="openEdit" @delete="onDelete" />
    </section>

    <section class="account-section">
      <div class="section-heading">
        <h3>Liabilities</h3>
        <small>Balances shown are amounts owed and reduce net worth.</small>
      </div>
      <AccountList :accounts="liabilityAccounts" :loading="loading" liability @edit="openEdit" @delete="onDelete" />
    </section>

    <Dialog v-model:visible="dialogVisible" :header="editingAccount ? 'Edit Account' : 'New Account'" modal :style="{ width: '90vw', maxWidth: '28rem' }">
      <AccountForm :account="editingAccount" @save="onSave" @cancel="dialogVisible = false" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Account } from '@/types'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '@/services/api'
import AccountList from '@/components/accounts/AccountList.vue'
import AccountForm from '@/components/accounts/AccountForm.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const accounts = ref<Account[]>([])
const dialogVisible = ref(false)
const editingAccount = ref<Account | null>(null)
const loading = ref(true)
const assetAccounts = computed(() => accounts.value.filter(account => !account.isLiability))
const liabilityAccounts = computed(() => accounts.value.filter(account => Boolean(account.isLiability)))

async function loadAccounts() {
  loading.value = true
  try {
    accounts.value = await getAccounts()
  } finally {
    loading.value = false
  }
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

.account-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-section h3 {
  color: #f1f5f9;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section-heading small {
  color: #94a3b8;
}
</style>
