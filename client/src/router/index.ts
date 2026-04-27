import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import AccountsView from '@/views/AccountsView.vue'
import IncomeView from '@/views/IncomeView.vue'
import DebtsView from '@/views/DebtsView.vue'
import BudgetView from '@/views/BudgetView.vue'
import ProjectionView from '@/views/ProjectionView.vue'
import PropertiesView from '@/views/PropertiesView.vue'
import SettingsView from '@/views/SettingsView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    meta: { title: 'Dashboard' }
  },
  {
    path: '/accounts',
    name: 'Accounts',
    component: AccountsView,
    meta: { title: 'Accounts' }
  },
  {
    path: '/income',
    name: 'Income',
    component: IncomeView,
    meta: { title: 'Income' }
  },
  {
    path: '/debts',
    name: 'Debts',
    component: DebtsView,
    meta: { title: 'Debts' }
  },
  {
    path: '/budget',
    name: 'Budget',
    component: BudgetView,
    meta: { title: 'Budget' }
  },
  {
    path: '/projection',
    name: 'Projection',
    component: ProjectionView,
    meta: { title: 'Projection' }
  },
  {
    path: '/properties',
    name: 'Properties',
    component: PropertiesView,
    meta: { title: 'Properties' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { title: 'Settings' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
