<template>
  <div class="debts-view">
    <div class="view-toolbar">
      <Button label="Add Debt" icon="pi pi-plus" @click="openCreate" />
    </div>

    <DebtList
      :debts="debts"
      @edit="openEdit"
      @delete="onDelete"
    />

    <Dialog v-model:visible="dialogVisible" :header="editingDebt ? 'Edit Debt' : 'New Debt'" modal :style="{ width: '500px' }">
      <DebtForm
        :debt="editingDebt"
        @save="onSave"
        @cancel="dialogVisible = false"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Debt } from '@/types'
import { getDebts, createDebt, updateDebt, deleteDebt } from '@/services/api'
import DebtList from '@/components/debts/DebtList.vue'
import DebtForm from '@/components/debts/DebtForm.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

const debts = ref<Debt[]>([])
const dialogVisible = ref(false)
const editingDebt = ref<Debt | null>(null)

async function loadData() {
  debts.value = await getDebts()
}

function openCreate() {
  editingDebt.value = null
  dialogVisible.value = true
}

function openEdit(debt: Debt) {
  editingDebt.value = debt
  dialogVisible.value = true
}

async function onSave(data: any) {
  if (editingDebt.value) {
    await updateDebt(editingDebt.value._id, data)
  } else {
    await createDebt(data)
  }
  dialogVisible.value = false
  await loadData()
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
</style>
