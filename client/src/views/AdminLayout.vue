<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@core/AppSidebar.vue'
import AppHeader from '@core/AppHeader.vue'
import AppTabs from '@core/AppTabs.vue'
import { useAuth } from '@core/auth/useAuth.js'
import { pluginAdminTabs } from '@/plugins.js'
import { usePluginOverrides } from '@/pluginOverrides.js'
import { Icon } from '@core/icons'
import ChevronDownIcon from '@/assets/icons/chevron-down.svg?component'

const { profile } = useAuth()
const isAdmin = computed(() => profile.value?.role === 'admin')

const sidebarOpen = ref(false)

const MAIN_TABS = [
  { to: '/overview', label: 'Overview' },
  { to: '/users',    label: 'Users' },
  { to: '/groups',   label: 'Groups' },
]
const GLOBAL_TABS = [
  { to: '/apps',     label: 'Apps' },
  { to: '/widgets',  label: 'Widgets' },
  { to: '/plugins',  label: 'Plugins' },
]

const { disabled: disabledPlugins, load: loadDisabledPlugins } = usePluginOverrides()
const PLUGIN_TABS = computed(() =>
  pluginAdminTabs
    .filter(t => !disabledPlugins.value.has(t.pluginId))
    .map(t => ({ to: '/' + t.path, label: t.label })),
)

const route = useRoute()
const globalOpen = ref(false)
const globalMenu = ref(null)
const globalActive = computed(() =>
  [...GLOBAL_TABS, ...PLUGIN_TABS.value].some(t => route.path.startsWith(t.to)),
)

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
  <div v-if="!isAdmin" class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm rounded-2xl bg-white/70 dark:bg-white/[0.05] backdrop-blur-md border border-white/70 dark:border-white/10 p-8 flex flex-col items-center text-center gap-3">
      <div class="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
        <Icon name="lock" class="w-6 h-6 text-red-500" :sw="1.75" />
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
          <Icon name="menu" class="w-5 h-5" />
        </button>
      </template>

      <div class="flex items-center gap-2">
        <Icon name="shield" class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill />
        <span class="text-sm font-semibold text-slate-800 dark:text-white">Admin Console</span>
      </div>
    </AppHeader>

    <nav class="sticky top-16 z-20 px-4 pt-4 border-b border-slate-200/70 dark:border-white/10 bg-gradient-to-b from-transparent to-transparent dark:to-slate-900/55 dark:backdrop-blur-md">
      <div class="flex items-stretch gap-1 max-w-5xl mx-auto">
        <AppTabs router :tabs="MAIN_TABS" />

        <div class="hidden sm:flex items-stretch gap-3 ml-3 pl-3 border-l border-slate-200/70 dark:border-white/10">
          <span class="self-center shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Global toggles</span>
          <AppTabs router :tabs="GLOBAL_TABS" />
        </div>

        <div v-if="PLUGIN_TABS.length" class="hidden sm:flex items-stretch gap-3 ml-3 pl-3 border-l border-slate-200/70 dark:border-white/10">
          <span class="self-center shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Plugins</span>
          <AppTabs router :tabs="PLUGIN_TABS" />
        </div>

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
            <ChevronDownIcon class="w-4 h-4 transition-transform duration-200" :class="globalOpen ? 'rotate-180' : ''" />
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

.page-enter-active { transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1); }
.page-leave-active { transition: opacity 0.12s ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: opacity 0.12s ease; }
  .page-enter-from { transform: none; }
}
</style>
