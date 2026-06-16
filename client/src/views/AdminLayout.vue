<script setup>
import { ref, computed } from 'vue'
import AppSidebar from '@core/AppSidebar.vue'
import AppHeader from '@core/AppHeader.vue'
import { useAuth } from '@core/auth/useAuth.js'

const { profile } = useAuth()
// AuthGuard only renders us once a session is loaded, so profile is set here.
const isAdmin = computed(() => profile.value?.role === 'admin')

const sidebarOpen = ref(false)

// Per-profile management tabs vs. global (everyone) settings, shown as two
// distinct groups in the tab bar.
const MAIN_TABS = [
  { to: '/overview', label: 'Overview' },
  { to: '/users',    label: 'Users' },
  { to: '/groups',   label: 'Groups' },
]
const GLOBAL_TABS = [
  { to: '/apps',     label: 'Apps' },
  { to: '/widgets',  label: 'Widgets' },
]
</script>

<template>
  <!-- Non-admins are blocked entirely. -->
  <div v-if="!isAdmin" class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm rounded-2xl bg-white/70 dark:bg-white/[0.05] backdrop-blur-md border border-white/70 dark:border-white/10 p-8 flex flex-col items-center text-center gap-3">
      <div class="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
        <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
        </svg>
      </div>
      <h1 class="text-lg font-bold text-slate-900 dark:text-white">Admins only</h1>
      <p class="text-sm text-slate-500 dark:text-white/50">You don't have permission to access the admin console.</p>
      <a href="/" class="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors">Back to Nucleus</a>
    </div>
  </div>

  <div v-else class="min-h-screen">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <AppHeader>
      <template #left>
        <button
          @click="sidebarOpen = true"
          class="cursor-pointer p-2 -ml-1 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
          aria-label="Open navigation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </template>

      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6l-9-4z" />
        </svg>
        <span class="text-sm font-semibold text-slate-800 dark:text-white">Admin Console</span>
      </div>
    </AppHeader>

    <!-- Tabs — client-side navigation, no page reload -->
    <nav class="sticky top-16 z-20 px-4 pt-4 border-b border-slate-200/70 dark:border-white/10 bg-gradient-to-b from-transparent to-transparent dark:to-slate-900/55 dark:backdrop-blur-md">
      <div class="flex items-stretch gap-1 max-w-5xl mx-auto overflow-x-auto no-scrollbar">
        <RouterLink
          v-for="t in MAIN_TABS"
          :key="t.to"
          :to="t.to"
          class="shrink-0 inline-flex items-center -mb-px px-3.5 py-2.5 border-b-2 border-transparent text-[13px] font-semibold whitespace-nowrap transition-colors text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white"
          active-class="!border-indigo-500 !text-indigo-600 dark:!border-indigo-400 dark:!text-indigo-300"
        >{{ t.label }}</RouterLink>

        <!-- Global settings — set apart from the per-profile tabs -->
        <div class="flex items-stretch gap-1 shrink-0 ml-3 pl-3 border-l border-slate-200/70 dark:border-white/10">
          <span class="self-center shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Global toggles</span>
          <RouterLink
            v-for="t in GLOBAL_TABS"
            :key="t.to"
            :to="t.to"
            class="shrink-0 inline-flex items-center -mb-px px-3.5 py-2.5 border-b-2 border-transparent text-[13px] font-semibold whitespace-nowrap transition-colors text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white"
            active-class="!border-indigo-500 !text-indigo-600 dark:!border-indigo-400 dark:!text-indigo-300"
          >{{ t.label }}</RouterLink>
        </div>
      </div>
    </nav>

    <main class="px-4 md:px-6 pt-6 pb-24 max-w-5xl mx-auto">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.no-scrollbar { scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
</style>
