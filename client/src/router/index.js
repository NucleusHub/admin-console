import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/views/AdminLayout.vue'
import { pluginAdminTabs } from '@/plugins.js'

const pluginRoutes = pluginAdminTabs.map(t => ({ path: t.path, component: t.loader }))

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
        { path: 'plugins',  component: () => import('@/views/PluginsView.vue') },
        ...pluginRoutes,
      ],
    },
  ],
})
