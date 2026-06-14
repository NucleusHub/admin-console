<script setup>
import { ref, computed, watch } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'

// Per-user config: a Details tab (name, role, PIN) plus per-user app/widget
// enable/disable. Global overrides always win — a globally disabled item is off
// here regardless and can't be toggled per-user.
const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['close', 'updated'])

const tab = ref('details')

// ── Details (name / role / PIN) ───────────────────────────────────────────────
const name = ref('')
const role = ref('user')
const pinSet = ref(false)
const pinInput = ref('')
const savingDetails = ref(false)
const detailsError = ref(null)
const settingPin = ref(false)
const pinError = ref(null)

const isGuest = computed(() => !!props.user?.isGuest)

watch(() => props.user, (u) => {
  if (!u) return
  tab.value = 'details'
  name.value = u.name ?? ''
  role.value = u.role === 'admin' ? 'admin' : 'user'
  pinSet.value = !!u.hasPin
  pinInput.value = ''
  detailsError.value = null
  pinError.value = null
  load(u._id)
}, { immediate: true })

async function saveDetails() {
  const n = name.value.trim()
  if (!n) { detailsError.value = 'Name required'; return }
  savingDetails.value = true
  detailsError.value = null
  try {
    const res = await fetch(`/api/auth/profiles/${props.user._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: n, role: role.value }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    emit('updated', { _id: props.user._id, name: n, role: role.value })
  } catch (e) {
    detailsError.value = e.message
  } finally {
    savingDetails.value = false
  }
}

async function setPin() {
  const pin = pinInput.value.trim().toUpperCase()
  if (!/^[0-9A-F]{4}$/.test(pin)) { pinError.value = 'PIN must be 4 characters (0–9, A–F)'; return }
  settingPin.value = true
  pinError.value = null
  try {
    const res = await fetch(`/api/auth/profiles/${props.user._id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pinSet.value = true
    pinInput.value = ''
    emit('updated', { _id: props.user._id, hasPin: true })
  } catch (e) {
    pinError.value = e.message
  } finally {
    settingPin.value = false
  }
}

// ── Apps / widgets ─────────────────────────────────────────────────────────────
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

const items = computed(() => (tab.value === 'apps' ? apps.value : widgets.value))
const globalSet = computed(() => (tab.value === 'apps' ? globalApps.value : globalWidgets.value))
const userSet = computed(() => (tab.value === 'apps' ? userApps.value : userWidgets.value))

const isLocked = (it) => !!it.locked
const globallyOff = (it) => globalSet.value.has(it.id)
const userOff = (it) => userSet.value.has(it.id)
// Cascade: a widget whose data provider is disabled (globally or for this user)
// is effectively off too.
const widgetName = (id) => widgets.value.find(w => w.id === id)?.name || id
const providerOff = (it) => it.dependsOn && (globalSet.value.has(it.dependsOn) || userSet.value.has(it.dependsOn))

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
    <div class="flex flex-col" style="max-height: 82vh">
      <!-- Header -->
      <div class="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
        <div>
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Config</h2>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">{{ user?.name }} · per-user settings</p>
        </div>
        <button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" @click="emit('close')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-5 px-5 border-b border-slate-200/60 dark:border-white/10">
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
            class="w-full text-sm rounded-xl border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2"
            @keydown.enter.prevent="saveDetails"
          />
        </div>

        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Role</label>
          <div v-if="isGuest" class="text-sm text-slate-500 dark:text-white/45">Guest profile</div>
          <div v-else class="flex gap-1.5 bg-slate-500/[0.06] dark:bg-white/[0.04] rounded-xl p-1">
            <button
              v-for="r in ['user', 'admin']"
              :key="r"
              class="flex-1 capitalize text-sm font-semibold py-1.5 rounded-lg cursor-pointer transition-colors"
              :class="role === r ? 'bg-white dark:bg-white/15 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'"
              @click="role = r"
            >{{ r }}</button>
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">PIN</label>
          <!-- Guests never have a PIN -->
          <div v-if="isGuest" class="text-sm text-slate-400 dark:text-white/35">Guest profiles can't have a PIN.</div>
          <!-- Already set: locked field -->
          <div v-else-if="pinSet" class="flex items-center gap-2">
            <input
              type="text"
              value="••••"
              disabled
              class="flex-1 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] text-slate-400 dark:text-white/35 px-3 py-2 tracking-[0.3em] cursor-not-allowed"
            />
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              PIN is set
            </span>
          </div>
          <!-- Not set: allow setting one (non-guest only) -->
          <div v-else>
            <div class="flex gap-2">
              <input
                v-model="pinInput"
                type="text"
                maxlength="4"
                placeholder="4 chars · 0–9, A–F"
                class="flex-1 text-sm rounded-xl border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2 uppercase tracking-[0.2em] placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-white/30"
                @keydown.enter.prevent="setPin"
              />
              <button
                class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 cursor-pointer transition-colors shrink-0"
                :disabled="settingPin || pinInput.trim().length !== 4"
                @click="setPin"
              >{{ settingPin ? 'Setting…' : 'Set PIN' }}</button>
            </div>
            <p class="text-[11px] text-slate-400 dark:text-white/35 mt-1">No PIN set — this profile signs in without one.</p>
          </div>
          <p v-if="pinError" class="text-[11px] text-red-500 mt-1">{{ pinError }}</p>
        </div>
      </div>

      <!-- APPS / WIDGETS -->
      <div v-show="tab === 'apps' || tab === 'widgets'" class="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
        <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">{{ error }}</p>
        <ul v-else class="flex flex-col gap-0.5">
          <li
            v-for="it in items"
            :key="it.id"
            class="flex items-center gap-3 px-2.5 py-2 rounded-xl"
            :class="(isLocked(it) || globallyOff(it) || userOff(it) || providerOff(it)) ? 'opacity-70' : ''"
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
            <span v-else-if="globallyOff(it)" class="shrink-0 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/12 px-2 py-1 rounded-lg" title="Disabled globally for everyone">Disabled globally</span>
            <span v-else-if="providerOff(it)" class="shrink-0 text-[11px] font-medium text-slate-400 dark:text-white/40" :title="`Re-enable ${widgetName(it.dependsOn)} to control this widget`">via {{ widgetName(it.dependsOn) }}</span>
            <button
              v-else
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              :class="userOff(it) ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22' : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
              @click="toggle(it)"
            >{{ userOff(it) ? 'Enable' : 'Disable' }}</button>
          </li>
          <li v-if="!items.length" class="text-sm text-slate-400 dark:text-white/40 py-8 text-center">Nothing here.</li>
        </ul>
      </div>

      <!-- Footer -->
      <div v-show="tab === 'details'" class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200/60 dark:border-white/10">
        <p class="text-[11px] text-red-500 truncate">{{ detailsError }}</p>
        <div class="flex gap-2 shrink-0">
          <button class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-white/60 bg-slate-500/10 dark:bg-white/8 hover:bg-slate-500/20 cursor-pointer transition-colors" @click="emit('close')">Close</button>
          <button class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 cursor-pointer transition-colors" :disabled="savingDetails || !name.trim()" @click="saveDetails">{{ savingDetails ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
      <p v-show="tab !== 'details'" class="px-5 py-3 text-[11px] text-slate-400 dark:text-white/40 border-t border-slate-200/60 dark:border-white/10">
        Affects only {{ user?.name }}. Globally disabled items can't be enabled per-user.
      </p>
    </div>
  </TemplateModal>
</template>
