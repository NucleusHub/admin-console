import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/views/AdminLayout.vue'

export default createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', redirect: '/users' },
        { path: 'overview', component: () => import('@/views/OverviewView.vue') },
        { path: 'users',    component: () => import('@/views/UsersView.vue') },
        { path: 'groups',   component: () => import('@/views/GroupsView.vue') },
        { path: 'apps',     component: () => import('@/views/AppsView.vue') },
        { path: 'widgets',  component: () => import('@/views/WidgetsView.vue') },
        { path: 'localization', component: () => import('@/views/LocalizationView.vue') },
        { path: 'maintenance', component: () => import('@/views/MaintenanceView.vue') },
      ],
    },
  ],
})
