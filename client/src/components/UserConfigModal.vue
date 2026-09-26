<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'
import AppTabs from '@core/AppTabs.vue'
import { useAuth } from '@core/auth/useAuth.js'
import { Icon } from '@core/icons'

const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['close', 'updated', 'delete'])

const { profile: currentProfile } = useAuth()

const tab = ref('details')

const name = ref('')
const role = ref('user')
const locale = ref('')
const installedLanguages = ref(['en-US'])
const pinSet = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/api/auth/i18n/config', { credentials: 'include' })
    if (res.ok) installedLanguages.value = (await res.json()).installedLanguages || ['en-US']
  } catch {}
})

const langLabel = (tag) => {
  try { return new Intl.DisplayNames([tag], { type: 'language' }).of(tag.split('-')[0]) || tag }
  catch { return tag }
}
const pinTemporaryStatus = ref(false)
const tempPin = ref(null)
const resettingPin = ref(false)
const savingDetails = ref(false)
const detailsError = ref(null)
const pinError = ref(null)

const savedRole = ref('user')

const isGuest = computed(() => !!props.user?.isGuest)
const isSelf = computed(() =>
  !!currentProfile.value && !!props.user && String(currentProfile.value._id) === String(props.user._id))
const canDelete = computed(() => !isGuest.value && !isSelf.value && savedRole.value !== 'admin')

watch(() => props.user, (u) => {
  if (!u) return
  tab.value = 'details'
  name.value = u.name ?? ''
  role.value = u.role === 'admin' ? 'admin' : 'user'
  locale.value = u.locale ?? ''
  savedRole.value = role.value
  pinSet.value = !!u.hasPin
  pinTemporaryStatus.value = !!u.hasPin && !!u.pinTemporary
  tempPin.value = null
  detailsError.value = null
  pinError.value = null
  load(u._id)
  loadTempPin(u._id)
}, { immediate: true })

async function loadTempPin(id) {
  if (isGuest.value) return
  try {
    const res = await fetch(`/api/auth/profiles/${id}/pin-temp`, { credentials: 'include' })
    if (!res.ok) return
    const d = await res.json()
    pinSet.value = !!d.hasPin
    pinTemporaryStatus.value = !!d.pinTemporary
    tempPin.value = d.pin || null
  } catch {}
}

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
      body: JSON.stringify({ name: n, role: role.value, locale: locale.value || null }),
    })
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
    savedRole.value = role.value
    emit('updated', { _id: props.user._id, name: n, role: role.value, locale: locale.value || null })
  } catch (e) {
    detailsError.value = e.message
  } finally {
    savingDetails.value = false
  }
}

async function resetPin() {
  resettingPin.value = true
  pinError.value = null
  try {
    const res = await fetch(`/api/auth/profiles/${props.user._id}/pin/reset`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
    const d = await res.json()
    pinSet.value = true
    pinTemporaryStatus.value = true
    tempPin.value = d.pin
    emit('updated', { _id: props.user._id, hasPin: true, pinTemporary: true })
  } catch (e) {
    pinError.value = e.message
  } finally {
    resettingPin.value = false
  }
}

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
    load(props.user._id)
  }
}
</script>

<template>
  <TemplateModal :show="!!user" size="md" @cancel="emit('close')">
    <div class="flex flex-col" style="max-height: 82vh">
      <div class="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
        <div>
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Config</h2>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">{{ user?.name }} · per-user settings</p>
        </div>
        <button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" @click="emit('close')">
          <Icon width="16" height="16" name="close" :sw="2.5" />
        </button>
      </div>

      <AppTabs
        v-model="tab"
        :tabs="[{ key: 'details', label: 'Details' }, { key: 'apps', label: 'Apps' }, { key: 'widgets', label: 'Widgets' }]"
        class="px-5 border-b border-slate-200/60 dark:border-white/10"
      />

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

        <div v-if="!isGuest">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Language</label>
          <select
            v-model="locale"
            class="w-full text-sm rounded-xl border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2 cursor-pointer"
          >
            <option value="">Default</option>
            <option v-for="l in installedLanguages" :key="l" :value="l">{{ langLabel(l) }} ({{ l }})</option>
          </select>
          <p class="text-[11px] text-slate-400 dark:text-white/35 mt-1.5">The UI language for {{ user?.name }}. “Default” uses the instance language.</p>
        </div>

        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">PIN</label>
          <div v-if="isGuest" class="text-sm text-slate-400 dark:text-white/35">Guest profiles can't have a PIN.</div>
          <div v-else>
            <div v-if="pinTemporaryStatus && tempPin" class="rounded-xl border border-amber-300/60 dark:border-amber-400/25 bg-amber-500/10 px-3 py-2.5 mb-2">
              <p class="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Icon name="clock" class="w-3.5 h-3.5" />
                One-time PIN
              </p>
              <p class="font-mono text-2xl font-bold tracking-[0.35em] text-amber-800 dark:text-amber-200 mt-1 pl-1">{{ tempPin }}</p>
              <p class="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-1">Share with {{ user?.name }}. They'll set their own PIN on next sign-in, then this clears.</p>
            </div>

            <div class="mb-2 text-[12px]">
              <span v-if="pinTemporaryStatus" class="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                Awaiting first sign-in
              </span>
              <span v-else-if="pinSet" class="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <Icon name="lockSimple" class="w-3.5 h-3.5" />
                PIN is set — only {{ user?.name }} knows it
              </span>
              <span v-else class="text-slate-400 dark:text-white/40">No PIN — this profile signs in without one.</span>
            </div>

            <button
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-60 cursor-pointer transition-colors"
              :disabled="resettingPin"
              @click="resetPin"
            >{{ resettingPin ? 'Generating…' : (pinTemporaryStatus && tempPin ? 'Generate new one-time PIN' : 'Reset PIN') }}</button>
            <p class="text-[11px] text-slate-400 dark:text-white/35 mt-1.5">
              Issues a one-time PIN. An admin can't read or change a user's own PIN — only reset it.
            </p>
          </div>
          <p v-if="pinError" class="text-[11px] text-red-500 mt-1">{{ pinError }}</p>
        </div>

        <div v-if="!isGuest" class="pt-2 border-t border-slate-200/60 dark:border-white/10">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-red-500/70 mb-1.5">Danger zone</label>
          <template v-if="canDelete">
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22 cursor-pointer transition-colors"
              @click="emit('delete', user)"
            >Delete user…</button>
            <p class="text-[11px] text-slate-400 dark:text-white/35 mt-1.5">Permanently removes this user and all their data.</p>
          </template>
          <p v-else-if="isSelf" class="text-[11px] text-slate-400 dark:text-white/40">You can’t delete your own profile.</p>
          <p v-else class="text-[11px] text-slate-400 dark:text-white/40">Admins can’t be deleted. Switch the role to <strong>User</strong> and save first.</p>
        </div>
      </div>

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
                <Icon name="link" class="w-3 h-3 shrink-0" />
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
