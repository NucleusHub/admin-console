import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/views/AdminLayout.vue'
import { pluginAdminTabs } from '@/plugins.js'

// Routes contributed by plugins (extensions.adminTabs). The path/label/component
// all come from each plugin's own manifest — nothing here is hardcoded per-plugin.
// Routes always exist; AdminLayout hides the nav entry for a disabled plugin.
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
        { path: 'localization', component: () => import('@/views/LocalizationView.vue') },
        { path: 'maintenance', component: () => import('@/views/MaintenanceView.vue') },
        ...pluginRoutes,
      ],
    },
  ],
})
