<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@core/AppSidebar.vue'
import AppHeader from '@core/AppHeader.vue'
import { useAuth } from '@core/auth/useAuth.js'
import { pluginAdminTabs } from '@/plugins.js'
import { usePluginOverrides } from '@/pluginOverrides.js'

const { profile } = useAuth()
// AuthGuard only renders us once a session is loaded, so profile is set here.
const isAdmin = computed(() => profile.value?.role === 'admin')

const sidebarOpen = ref(false)

// Per-profile management tabs vs. global (everyone) settings. The per-profile
// tabs sit inline; the global toggles live behind a chevron dropdown after them,
// so the bar stays single-row on phones (no horizontal scroll).
const MAIN_TABS = [
  { to: '/overview', label: 'Overview' },
  { to: '/users',    label: 'Users' },
  { to: '/groups',   label: 'Groups' },
]
const GLOBAL_TABS = [
  { to: '/apps',     label: 'Apps' },
  { to: '/widgets',  label: 'Widgets' },
  { to: '/plugins',  label: 'Plugins' },
  { to: '/localization', label: 'Localization' },
]

// ── Plugin-contributed tabs ───────────────────────────────────────────────────
// Tabs declared by plugins (extensions.adminTabs), shown in their own "Plugins"
// category. A globally-disabled plugin's tabs are hidden. Nothing here is
// hardcoded per-plugin — the metadata comes from each plugin's manifest.
// Shared with the Plugins page, so a toggle there updates these tabs instantly.
const { disabled: disabledPlugins, load: loadDisabledPlugins } = usePluginOverrides()
const PLUGIN_TABS = computed(() =>
  pluginAdminTabs
    .filter(t => !disabledPlugins.value.has(t.pluginId))
    .map(t => ({ to: '/' + t.path, label: t.label })),
)

// ── Global-toggles dropdown ───────────────────────────────────────────────────
const route = useRoute()
const globalOpen = ref(false)
const globalMenu = ref(null)
// Highlight the chevron while a global OR plugin tab is the active route.
const globalActive = computed(() =>
  [...GLOBAL_TABS, ...PLUGIN_TABS.value].some(t => route.path.startsWith(t.to)),
)

// Close on outside click and whenever the route changes.
function onDocClick(e) {
  if (globalOpen.value && globalMenu.value && !globalMenu.value.contains(e.target)) globalOpen.value = false
}
watch(() => route.path, () => { globalOpen.value = false })
onMounted(() => {
  document.addEventListener('click', onDocClick)
  loadDisabledPlugins()
})
onUnmounted(() => document.removeEventListener('click', onDocClick))
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
          class="nuc-press cursor-pointer p-2 -ml-1 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
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

    <!-- Tabs — client-side navigation, no page reload. Per-profile tabs sit inline;
         the global toggles open from a chevron after Groups, so the bar stays a
         single non-scrolling row on phones. -->
    <nav class="sticky top-16 z-20 px-4 pt-4 border-b border-slate-200/70 dark:border-white/10 bg-gradient-to-b from-transparent to-transparent dark:to-slate-900/55 dark:backdrop-blur-md">
      <div class="flex items-stretch gap-1 max-w-5xl mx-auto">
        <RouterLink
          v-for="t in MAIN_TABS"
          :key="t.to"
          :to="t.to"
          class="shrink-0 inline-flex items-center -mb-px px-3.5 py-2.5 border-b-2 border-transparent text-[13px] font-semibold whitespace-nowrap transition-colors text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white"
          active-class="!border-indigo-500 !text-indigo-600 dark:!border-indigo-400 dark:!text-indigo-300"
        >{{ t.label }}</RouterLink>

        <!-- Desktop: global tabs inline, set apart by a divider -->
        <div class="hidden sm:flex items-stretch gap-1 ml-3 pl-3 border-l border-slate-200/70 dark:border-white/10">
          <span class="self-center shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Global toggles</span>
          <RouterLink
            v-for="t in GLOBAL_TABS"
            :key="t.to"
            :to="t.to"
            class="shrink-0 inline-flex items-center -mb-px px-3.5 py-2.5 border-b-2 border-transparent text-[13px] font-semibold whitespace-nowrap transition-colors text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white"
            active-class="!border-indigo-500 !text-indigo-600 dark:!border-indigo-400 dark:!text-indigo-300"
          >{{ t.label }}</RouterLink>
        </div>

        <!-- Desktop: plugin-contributed tabs, their own category (mirrors Global toggles) -->
        <div v-if="PLUGIN_TABS.length" class="hidden sm:flex items-stretch gap-1 ml-3 pl-3 border-l border-slate-200/70 dark:border-white/10">
          <span class="self-center shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Plugins</span>
          <RouterLink
            v-for="t in PLUGIN_TABS"
            :key="t.to"
            :to="t.to"
            class="shrink-0 inline-flex items-center -mb-px px-3.5 py-2.5 border-b-2 border-transparent text-[13px] font-semibold whitespace-nowrap transition-colors text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white"
            active-class="!border-indigo-500 !text-indigo-600 dark:!border-indigo-400 dark:!text-indigo-300"
          >{{ t.label }}</RouterLink>
        </div>

        <!-- Mobile: global toggles open from the chevron after Groups -->
        <div ref="globalMenu" class="relative flex items-stretch sm:hidden">
          <button
            type="button"
            aria-label="Global toggles"
            :aria-expanded="globalOpen"
            class="inline-flex items-center gap-0.5 -mb-px px-2 py-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer"
            :class="globalActive || globalOpen
              ? '!border-indigo-500 text-indigo-600 dark:!border-indigo-400 dark:text-indigo-300'
              : 'border-transparent text-slate-400 dark:text-white/45 hover:text-slate-700 dark:hover:text-white'"
            @click.stop="globalOpen = !globalOpen"
          >
            <svg class="w-4 h-4 transition-transform duration-200" :class="globalOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <Transition name="gt">
            <div
              v-if="globalOpen"
              class="absolute left-0 top-full mt-1.5 z-30 min-w-[11rem] p-1 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl shadow-slate-900/10 dark:shadow-black/40"
            >
              <p class="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Global toggles</p>
              <RouterLink
                v-for="t in GLOBAL_TABS"
                :key="t.to"
                :to="t.to"
                class="block px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/8 transition-colors"
                active-class="!text-indigo-600 dark:!text-indigo-300 bg-indigo-500/10"
                @click="globalOpen = false"
              >{{ t.label }}</RouterLink>

              <template v-if="PLUGIN_TABS.length">
                <div class="my-1 border-t border-slate-200/70 dark:border-white/10"></div>
                <p class="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Plugins</p>
                <RouterLink
                  v-for="t in PLUGIN_TABS"
                  :key="t.to"
                  :to="t.to"
                  class="block px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/8 transition-colors"
                  active-class="!text-indigo-600 dark:!text-indigo-300 bg-indigo-500/10"
                  @click="globalOpen = false"
                >{{ t.label }}</RouterLink>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </nav>

    <main class="px-4 md:px-6 pt-6 pb-24 max-w-5xl mx-auto">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.gt-enter-active, .gt-leave-active { transition: opacity 0.13s ease, transform 0.13s ease; }
.gt-enter-from, .gt-leave-to { opacity: 0; transform: translateY(-4px); }

/* Cross-fade between admin sections. */
.page-enter-active { transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1); }
.page-leave-active { transition: opacity 0.12s ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: opacity 0.12s ease; }
  .page-enter-from { transform: none; }
}
</style>

