<template>
  <div class="debts-view">
    <div class="view-toolbar">
      <Button label="Add Debt" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div v-for="suggestion in suggestions" :key="`${suggestion.accountId}:${suggestion.debtId}`" class="match-suggestion">
      <div>
        <strong>Possible duplicate:</strong>
        {{ suggestion.debtName }} may match {{ suggestion.institutionName }} {{ suggestion.accountName }}.
      </div>
      <div class="suggestion-actions">
        <Button label="Link & Merge" icon="pi pi-link" size="small" @click="linkSuggestion(suggestion)" />
        <Button label="Keep Separate" severity="secondary" outlined size="small" @click="dismissSuggestion(suggestion, true)" />
        <Button icon="pi pi-times" severity="secondary" text rounded size="small" aria-label="Dismiss for now" @click="dismissSuggestion(suggestion, false)" />
      </div>
    </div>

    <section class="debt-section">
      <div class="section-heading">
        <h3>Credit Cards</h3>
        <small>Revolving balances with flexible monthly payment strategies.</small>
      </div>
      <DebtList
        :debts="creditCards"
        :loading="loading"
        credit-cards
        @edit="openEdit"
        @delete="onDelete"
        @add-details="openAddDetails"
        @unlink="onUnlink"
      />
    </section>

    <section class="debt-section">
      <div class="section-heading">
        <h3>Loans & Fixed Debt</h3>
        <small>Installment liabilities with fixed monthly payments.</small>
      </div>
      <DebtList
        :debts="fixedDebts"
        :loading="loading"
        @edit="openEdit"
        @delete="onDelete"
        @add-details="openAddDetails"
        @unlink="onUnlink"
      />
    </section>

    <Dialog v-model:visible="dialogVisible" :header="editingDebtId ? 'Edit Debt Details' : linkingAccountId ? 'Add Debt Details' : 'New Debt'" modal :style="{ width: '90vw', maxWidth: '32rem' }">
      <DebtForm
        :debt="editingDebt"
        @save="onSave"
        @cancel="dialogVisible = false"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Debt, LiabilityMatchSuggestion } from '@/types'
import { getDebts, createDebt, updateDebt, deleteDebt, getLiabilityLinkSuggestions, linkDebtAccount, unlinkDebtAccount, dismissLiabilityLinkSuggestion } from '@/services/api'
import DebtList from '@/components/debts/DebtList.vue'
import DebtForm from '@/components/debts/DebtForm.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const debts = ref<Debt[]>([])
const dialogVisible = ref(false)
const editingDebt = ref<Debt | null>(null)
const editingDebtId = ref<string | null>(null)
const linkingAccountId = ref<string | null>(null)
const suggestions = ref<LiabilityMatchSuggestion[]>([])
const creditCards = computed(() => debts.value.filter(debt => debt.type === 'credit_card'))
const fixedDebts = computed(() => debts.value.filter(debt => debt.type !== 'credit_card'))
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    const [debtRows, matches] = await Promise.all([getDebts(), getLiabilityLinkSuggestions()])
    debts.value = debtRows
    suggestions.value = matches
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingDebt.value = null
  editingDebtId.value = null
  linkingAccountId.value = null
  dialogVisible.value = true
}

function openEdit(debt: Debt) {
  editingDebt.value = debt
  editingDebtId.value = debt._id
  linkingAccountId.value = debt.linkedAccountId || null
  dialogVisible.value = true
}

function openAddDetails(debt: Debt) {
  editingDebt.value = debt
  editingDebtId.value = null
  linkingAccountId.value = debt.linkedAccountId || null
  dialogVisible.value = true
}

async function onSave(data: any) {
  if (editingDebtId.value) {
    await updateDebt(editingDebtId.value, data)
  } else {
    await createDebt({ ...data, linkedAccountId: linkingAccountId.value || undefined })
  }
  dialogVisible.value = false
  await loadData()
}

async function onUnlink(debt: Debt) {
  if (!debt.hasManualMetadata) return
  await unlinkDebtAccount(debt._id)
  await loadData()
}

async function linkSuggestion(suggestion: LiabilityMatchSuggestion) {
  await linkDebtAccount(suggestion.debtId, suggestion.accountId)
  await loadData()
}

async function dismissSuggestion(suggestion: LiabilityMatchSuggestion, persist: boolean) {
  if (persist) {
    await dismissLiabilityLinkSuggestion(suggestion.debtId, suggestion.accountId)
  }
  suggestions.value = suggestions.value.filter(
    item => item.accountId !== suggestion.accountId || item.debtId !== suggestion.debtId
  )
}

async function onDelete(debt: Debt) {
  await deleteDebt(debt._id)
  await loadData()
}

onMounted(loadData)
</script>

<style scoped>
.debts-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.view-toolbar {
  display: flex;
  justify-content: flex-start;
}

.match-suggestion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  color: #fde68a;
  background: rgb(120 53 15 / 25%);
  border: 1px solid #92400e;
  border-radius: 8px;
}

.suggestion-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.debt-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.section-heading h3 {
  color: #f1f5f9;
}

.section-heading small {
  color: #94a3b8;
}
</style>
