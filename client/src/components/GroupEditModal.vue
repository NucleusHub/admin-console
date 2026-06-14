<script setup>
import { ref, computed, watch } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'

// One modal for both creating and configuring a group.
//  • Details tab: name, shared-storage switch (only when Orbit is installed), members.
//  • Apps & widgets tab: per-group enable/disable (only when editing an existing group).
const props = defineProps({
  show: { type: Boolean, default: false },
  group: { type: Object, default: null },     // null = create mode
  users: { type: Array, default: () => [] },   // non-guest profiles
  orbitInstalled: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'saved'])

const isEdit = computed(() => !!props.group)

// ── Details ──────────────────────────────────────────────────────────────────
const tab = ref('details')
const name = ref('')
const sharedOrbit = ref(false)
const members = ref(new Set())
const saving = ref(false)
const error = ref(null)

watch(() => props.show, (open) => {
  if (!open) return
  tab.value = 'details'
  error.value = null
  name.value = props.group?.name ?? ''
  sharedOrbit.value = !!props.group?.sharedOrbit
  members.value = new Set((props.group?.memberIds ?? []).map(String))
  if (isEdit.value) loadAccess(props.group._id)
}, { immediate: true })

function toggleMember(u) {
  const s = new Set(members.value)
  s.has(u._id) ? s.delete(u._id) : s.add(u._id)
  members.value = s
}

async function save() {
  const n = name.value.trim()
  if (!n) { error.value = 'Name required'; return }
  saving.value = true
  error.value = null
  try {
    const body = { name: n, sharedOrbit: sharedOrbit.value, memberIds: [...members.value] }
    const res = await fetch(
      isEdit.value ? `/api/auth/groups/${props.group._id}` : '/api/auth/groups',
      {
        method: isEdit.value ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    emit('saved', await res.json())
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Apps & widgets (edit only — each is its own top-level tab) ────────────────
const apps = ref([])
const widgets = ref([])
const globalApps = ref(new Set())
const globalWidgets = ref(new Set())
const groupApps = ref(new Set())
const groupWidgets = ref(new Set())
const accessLoading = ref(false)

async function loadAccess(id) {
  accessLoading.value = true
  try {
    const j = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    const soft = (url, fb) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : fb).catch(() => fb)
    const [a, w, g, go] = await Promise.all([
      j('/api/registry/apps'),
      j('/api/registry/widgets'),
      soft('/api/auth/overrides', { apps: [], widgets: [] }),
      soft(`/api/auth/groups/${id}/overrides`, { apps: [], widgets: [] }),
    ])
    apps.value = a
    widgets.value = w
    globalApps.value = new Set(g.apps)
    globalWidgets.value = new Set(g.widgets)
    groupApps.value = new Set(go.apps)
    groupWidgets.value = new Set(go.widgets)
  } finally {
    accessLoading.value = false
  }
}

const accessItems = computed(() => (tab.value === 'apps' ? apps.value : widgets.value))
const globalSet = computed(() => (tab.value === 'apps' ? globalApps.value : globalWidgets.value))
const groupSet = computed(() => (tab.value === 'apps' ? groupApps.value : groupWidgets.value))
const isLocked = (it) => !!it.locked
const globallyOff = (it) => globalSet.value.has(it.id)
const groupOff = (it) => groupSet.value.has(it.id)
// Cascade: a widget whose data provider is disabled (globally or for this
// group) is effectively off too — disabling e.g. System Info turns off the
// widgets that depend on it.
const widgetName = (id) => widgets.value.find(w => w.id === id)?.name || id
const providerOff = (it) => it.dependsOn && (globalSet.value.has(it.dependsOn) || groupSet.value.has(it.dependsOn))

async function toggleAccess(it) {
  if (!props.group || isLocked(it) || globallyOff(it)) return
  const next = !groupOff(it)
  const set = new Set(groupSet.value)
  next ? set.add(it.id) : set.delete(it.id)
  if (tab.value === 'apps') groupApps.value = set
  else groupWidgets.value = set
  try {
    const kind = tab.value === 'apps' ? 'app' : 'widget'
    const res = await fetch(`/api/auth/groups/${props.group._id}/overrides/${kind}/${it.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ disabled: next }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    loadAccess(props.group._id)
  }
}
</script>

<template>
  <TemplateModal :show="show" panel-class="max-w-md" @cancel="saving || emit('close')">
    <div class="flex flex-col" style="max-height: 82vh">
      <!-- Header -->
      <div class="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
        <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">{{ isEdit ? 'Configure group' : 'New group' }}</h2>
        <button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" @click="emit('close')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Tabs (only when editing — apps/widgets need an existing group) -->
      <div v-if="isEdit" class="flex gap-5 px-5 border-b border-slate-200/60 dark:border-white/10">
        <button
          v-for="t in [{ key: 'details', label: 'Details' }, { key: 'apps', label: 'Apps' }, { key: 'widgets', label: 'Widgets' }]"
          :key="t.key"
          class="cursor-pointer pt-3 pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors"
          :class="tab === t.key ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'border-transparent text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- DETAILS -->
      <div v-show="tab === 'details'" class="flex-1 overflow-y-auto px-5 py-4 min-h-0 flex flex-col gap-4">
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="Group name"
            class="w-full text-sm rounded-xl border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2 placeholder:text-slate-400 dark:placeholder:text-white/30"
            @keydown.enter.prevent="save"
          />
        </div>

        <!-- Shared storage (hidden when Orbit isn't installed) -->
        <button
          v-if="orbitInstalled"
          type="button"
          class="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 bg-slate-500/[0.06] dark:bg-white/[0.04] cursor-pointer"
          @click="sharedOrbit = !sharedOrbit"
        >
          <div class="text-left">
            <p class="text-[13px] font-medium text-slate-700 dark:text-white/80">Shared storage</p>
            <p class="text-[11px] text-slate-400 dark:text-white/35">A shared “Group - {{ name || 'name' }}” folder in Orbit</p>
          </div>
          <span class="shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors" :class="sharedOrbit ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/15'">
            <span class="block w-4 h-4 rounded-full bg-white transition-transform" :class="sharedOrbit ? 'translate-x-4' : ''" />
          </span>
        </button>

        <!-- Members -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Members · {{ members.size }}</label>
          <ul class="flex flex-col gap-0.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200/70 dark:border-white/10 p-1">
            <li
              v-for="u in users"
              :key="u._id"
              class="flex items-center gap-3 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/5"
              @click="toggleMember(u)"
            >
              <AvatarCircle :name="u.name" :color="u.color" :emoji="u.emoji" :admin="u.role === 'admin'" :size="28" />
              <span class="text-sm font-medium text-slate-900 dark:text-white flex-1 truncate">{{ u.name }}</span>
              <span class="shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors" :class="members.has(u._id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-white/20'">
                <svg v-if="members.has(u._id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              </span>
            </li>
            <li v-if="!users.length" class="text-sm text-slate-400 dark:text-white/40 py-6 text-center">No users.</li>
          </ul>
        </div>
      </div>

      <!-- APPS / WIDGETS -->
      <div v-if="isEdit" v-show="tab === 'apps' || tab === 'widgets'" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <p v-if="accessLoading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
        <ul v-else class="flex flex-col gap-0.5">
          <li
            v-for="it in accessItems"
            :key="it.id"
            class="flex items-center gap-3 px-2.5 py-2 rounded-xl"
            :class="(isLocked(it) || globallyOff(it) || groupOff(it) || providerOff(it)) ? 'opacity-70' : ''"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-900 dark:text-white truncate">{{ it.name }}</p>
              <p class="text-xs text-slate-500 dark:text-white/40 truncate">{{ it.description }}</p>
              <p v-if="it.dependsOn" class="text-[11px] text-slate-400 dark:text-white/35 truncate inline-flex items-center gap-1 mt-0.5">
                <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                Depends on {{ widgetName(it.dependsOn) }}
              </p>
            </div>
            <span v-if="isLocked(it)" class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-white/50 bg-slate-500/10 dark:bg-white/10 px-2 py-1 rounded-lg">Required</span>
            <span v-else-if="globallyOff(it)" class="shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/12 px-2 py-1 rounded-lg" title="Disabled globally">Disabled globally</span>
            <span v-else-if="providerOff(it)" class="shrink-0 text-[11px] font-medium text-slate-400 dark:text-white/40" :title="`Re-enable ${widgetName(it.dependsOn)} to control this widget`">via {{ widgetName(it.dependsOn) }}</span>
            <button
              v-else
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              :class="groupOff(it) ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22' : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
              @click="toggleAccess(it)"
            >{{ groupOff(it) ? 'Enable' : 'Disable' }}</button>
          </li>
          <li v-if="!accessItems.length" class="text-sm text-slate-400 dark:text-white/40 py-8 text-center">Nothing here.</li>
        </ul>
      </div>

      <!-- Footer (Details actions; access tab saves instantly) -->
      <div v-show="tab === 'details'" class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200/60 dark:border-white/10">
        <p class="text-[11px] text-red-500 truncate">{{ error }}</p>
        <div class="flex gap-2 shrink-0">
          <button class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-white/60 bg-slate-500/10 dark:bg-white/8 hover:bg-slate-500/20 cursor-pointer transition-colors" @click="emit('close')">Cancel</button>
          <button class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 cursor-pointer transition-colors" :disabled="saving || !name.trim()" @click="save">
            {{ saving ? 'Saving…' : (isEdit ? 'Save' : 'Create group') }}
          </button>
        </div>
      </div>
    </div>
  </TemplateModal>
</template>
