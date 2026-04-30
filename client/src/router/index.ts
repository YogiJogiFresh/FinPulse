import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard' }
  },
  {
    path: '/accounts',
    name: 'Accounts',
    component: () => import('@/views/AccountsView.vue'),
    meta: { title: 'Accounts' }
  },
  {
    path: '/income',
    name: 'Income',
    component: () => import('@/views/IncomeView.vue'),
    meta: { title: 'Income' }
  },
  {
    path: '/debts',
    name: 'Debts',
    component: () => import('@/views/DebtsView.vue'),
    meta: { title: 'Debts' }
  },
  {
    path: '/budget',
    name: 'Budget',
    component: () => import('@/views/BudgetView.vue'),
    meta: { title: 'Budget' }
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('@/views/TransactionsView.vue'),
    meta: { title: 'Transactions' }
  },
  {
    path: '/projection',
    name: 'Projection',
    component: () => import('@/views/ProjectionView.vue'),
    meta: { title: 'Projection' }
  },
  {
    path: '/properties',
    name: 'Properties',
    component: () => import('@/views/PropertiesView.vue'),
    meta: { title: 'Properties' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
