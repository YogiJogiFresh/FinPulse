<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Category Rules"
    :modal="true"
    :style="{ width: '700px', maxHeight: '80vh' }"
    :closable="true"
    :contentStyle="{ overflow: 'hidden' }"
  >
    <div class="rules-description">
      <p>Rules auto-categorize transactions by matching patterns in the description. Higher priority rules are checked first.</p>
      <p class="rules-hint"><i class="pi pi-info-circle"></i> Tip: The "Auto-Generate" button learns from your past categorizations — it finds merchants you've categorized 2+ times and creates rules from them.</p>
    </div>

    <!-- Add Rule Form -->
    <div class="add-rule-form">
      <InputText v-model="newPattern" placeholder="Pattern (e.g., AMAZON, STARBUCKS)" class="pattern-input" />
      <Select
        v-model="newCategory"
        :options="categoryOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Category"
        class="category-select"
      />
      <InputNumber v-model="newPriority" placeholder="Priority" :min="0" :max="100" class="priority-input" />
      <Button icon="pi pi-plus" @click="addRule" :disabled="!newPattern || !newCategory" />
    </div>

    <!-- Rules Table -->
    <DataTable :value="rules" stripedRows class="rules-table" :loading="loading">
      <Column field="pattern" header="Pattern" sortable>
        <template #body="{ data }">
          <span class="rule-pattern">{{ data.pattern }}</span>
        </template>
      </Column>
      <Column field="category" header="Category" sortable style="width: 140px">
        <template #body="{ data }">
          <span class="rule-category">{{ data.category }}</span>
        </template>
      </Column>
      <Column field="priority" header="Pri" sortable style="width: 60px" />
      <Column header="" style="width: 50px">
        <template #body="{ data }">
          <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeRule(data.id)" />
        </template>
      </Column>
      <template #empty>
        <div class="empty-rules">No rules defined yet.</div>
      </template>
    </DataTable>

    <template #footer>
      <div class="rules-footer">
        <div class="auto-generate-group">
          <Button label="Auto-Generate from History" icon="pi pi-bolt" severity="secondary" @click="autoGenerate" :loading="generating" v-tooltip.top="'Scans your categorized transactions, finds recurring merchants (2+ occurrences), and creates rules from their description patterns automatically.'" />
        </div>
        <Button label="Close" @click="$emit('update:visible', false)" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { getCategoryRules, createCategoryRule, deleteCategoryRule, autoGenerateCategoryRules } from '@/services/api'
import type { BudgetCategory, CategoryRule } from '@/types'

const props = defineProps<{
  visible: boolean
  categories: BudgetCategory[]
}>()

defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const rules = ref<CategoryRule[]>([])
const loading = ref(false)
const generating = ref(false)
const newPattern = ref('')
const newCategory = ref('')
const newPriority = ref(0)

const categoryOptions = computed(() =>
  props.categories.map(c => ({ label: c.name, value: c.name }))
)

watch(() => props.visible, (val) => {
  if (val) loadRules()
})

async function loadRules() {
  loading.value = true
  try {
    rules.value = await getCategoryRules()
  } finally {
    loading.value = false
  }
}

async function addRule() {
  if (!newPattern.value || !newCategory.value) return
  await createCategoryRule({
    pattern: newPattern.value,
    category: newCategory.value,
    priority: newPriority.value
  })
  newPattern.value = ''
  newCategory.value = ''
  newPriority.value = 0
  await loadRules()
}

async function removeRule(id: string) {
  await deleteCategoryRule(id)
  await loadRules()
}

async function autoGenerate() {
  generating.value = true
  try {
    await autoGenerateCategoryRules()
    await loadRules()
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.rules-description {
  margin-bottom: 16px;
}

.rules-description p {
  color: #94a3b8;
  font-size: 0.875rem;
  margin: 0 0 6px;
}

.rules-hint {
  color: #60a5fa;
  display: flex;
  align-items: center;
  gap: 6px;
}

.auto-generate-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-rule-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.pattern-input {
  flex: 1;
  min-width: 150px;
}

.category-select {
  width: 140px;
}

.priority-input {
  width: 80px;
}

.rules-table {
  border-radius: 6px;
  overflow: hidden;
  width: 100%;
  table-layout: fixed;
}

.rule-pattern {
  font-family: monospace;
  color: #60a5fa;
  word-break: break-all;
  font-size: 0.85rem;
}

.rule-category {
  color: #e2e8f0;
}

.empty-rules {
  text-align: center;
  padding: 24px;
  color: #64748b;
}

.rules-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}
</style>
