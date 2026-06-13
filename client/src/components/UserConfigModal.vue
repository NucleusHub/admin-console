<script setup>
import { ref, computed, watch } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'

// Per-user app/widget enable/disable. Global overrides always win — a globally
// disabled item is off here regardless and can't be toggled per-user.
const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const TABS = [
  { key: 'apps', label: 'Apps' },
  { key: 'widgets', label: 'Widgets' },
]

const tab = ref('apps')
const apps = ref([])
const widgets = ref([])
const globalApps = ref(new Set())
const globalWidgets = ref(new Set())
const userApps = ref(new Set())
const userWidgets = ref(new Set())
const loading = ref(true)
const error = ref(null)

async function load(id) {
  loading.value = true
  error.value = null
  try {
    const j = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    const soft = (url, fb) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : fb).catch(() => fb)
    const [a, w, g, uo] = await Promise.all([
      j('/api/registry/apps'),
      j('/api/registry/widgets'),
      soft('/api/auth/overrides', { apps: [], widgets: [] }),
      soft(`/api/auth/users/${id}/overrides`, { apps: [], widgets: [] }),
    ])
    apps.value = a
    widgets.value = w
    globalApps.value = new Set(g.apps)
    globalWidgets.value = new Set(g.widgets)
    userApps.value = new Set(uo.apps)
    userWidgets.value = new Set(uo.widgets)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => props.user, (u) => {
  if (u) { tab.value = 'apps'; load(u._id) }
}, { immediate: true })

const items = computed(() => (tab.value === 'apps' ? apps.value : widgets.value))
const globalSet = computed(() => (tab.value === 'apps' ? globalApps.value : globalWidgets.value))
const userSet = computed(() => (tab.value === 'apps' ? userApps.value : userWidgets.value))

const isLocked = (it) => !!it.locked
const globallyOff = (it) => globalSet.value.has(it.id)
const userOff = (it) => userSet.value.has(it.id)

async function toggle(it) {
  if (!props.user || isLocked(it) || globallyOff(it)) return
  const next = !userOff(it)
  const set = new Set(userSet.value)
  next ? set.add(it.id) : set.delete(it.id)
  if (tab.value === 'apps') userApps.value = set
  else userWidgets.value = set
  try {
    const kind = tab.value === 'apps' ? 'app' : 'widget'
    const res = await fetch(`/api/auth/users/${props.user._id}/overrides/${kind}/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ disabled: next }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    load(props.user._id) // revert to server truth on failure
  }
}
</script>

<template>
  <TemplateModal :show="!!user" panel-class="max-w-md" @cancel="emit('close')">
    <div class="flex flex-col" style="max-height: 80vh">
      <!-- Header -->
      <div class="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
        <div>
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Config</h2>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">{{ user?.name }} · per-user access</p>
        </div>
        <button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" @click="emit('close')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-5 px-5 border-b border-slate-200/60 dark:border-white/10">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="cursor-pointer pt-3 pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors"
          :class="tab === t.key
            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300'
            : 'border-transparent text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
        <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">{{ error }}</p>

        <ul v-else class="flex flex-col gap-0.5">
          <li
            v-for="it in items"
            :key="it.id"
            class="flex items-center gap-3 px-2.5 py-2 rounded-xl"
            :class="(isLocked(it) || globallyOff(it) || userOff(it)) ? 'opacity-70' : ''"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ it.name }}</p>
              <p class="text-xs text-slate-500 dark:text-white/40 truncate">{{ it.description }}</p>
            </div>

            <span v-if="isLocked(it)" class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-white/50 bg-slate-500/10 dark:bg-white/10 px-2 py-1 rounded-lg">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="10" rx="2" /><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Required
            </span>
            <span v-else-if="globallyOff(it)" class="shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/12 px-2 py-1 rounded-lg" title="Disabled globally for everyone">
              Disabled globally
            </span>
            <button
              v-else
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              :class="userOff(it)
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22'
                : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
              @click="toggle(it)"
            >{{ userOff(it) ? 'Enable' : 'Disable' }}</button>
          </li>
          <li v-if="!items.length" class="text-sm text-slate-400 dark:text-white/40 py-8 text-center">Nothing here.</li>
        </ul>
      </div>

      <!-- Footer note -->
      <p class="px-5 py-3 text-[11px] text-slate-400 dark:text-white/40 border-t border-slate-200/60 dark:border-white/10">
        Affects only {{ user?.name }}. Globally disabled items can't be enabled per-user.
      </p>
    </div>
  </TemplateModal>
</template>
