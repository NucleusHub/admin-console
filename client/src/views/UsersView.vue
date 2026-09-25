<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'
import PinInput from '@core/auth/PinInput.vue'
import UserConfigModal from '@/components/UserConfigModal.vue'
import UserDeleteModal from '@/components/UserDeleteModal.vue'
import TemplateModal from '@core/TemplateModal.vue'
import { Icon } from '@core/icons'
import RefreshIcon from '@/assets/icons/refresh.svg?component'

const users = ref([])
const groups = ref([])
const loading = ref(true)
const error = ref(null)
const configUser = ref(null)     // user whose "configure apps" modal is open
const groupsUser = ref(null)     // user whose "all groups" modal is open
const deleteUser = ref(null)     // user pending permanent deletion

// ── New profile ───────────────────────────────────────────────────────────────
// Avatar palette mirrors the server's (core/auth-server/models/Profile.js); a
// null color means "derive from the name", which the server does on create.
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
  '#a855f7', '#f43f5e',
]
function colorFromName(name) {
  let h = 0
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const newProfileModal = ref(false)
const creating = ref(false)
const createError = ref(null)
const newName = ref('')
const newColor = ref(null)         // null → auto (derived from name)
const pinMode = ref('none')        // 'none' | 'set' | 'temporary'
const newPin = ref('')             // 'set': typed via PinInput · 'temporary': generated

// Random 4-char hex one-time PIN, mirroring the server's reset endpoint.
function randomPin() {
  const chars = '0123456789ABCDEF'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * 16)]
  return s
}

// Switching mode: a temporary PIN is generated for the admin to relay (shown in
// the yellow box, same as a reset); a permanent PIN is typed via PinInput.
function selectPinMode(mode) {
  pinMode.value = mode
  newPin.value = mode === 'temporary' ? randomPin() : ''
}

// Color shown in the live preview: chosen swatch, or the name-derived default.
const previewColor = computed(() => newColor.value || colorFromName(newName.value || '?'))

// Reset the form whenever the modal opens (TemplateModal mounts content on show,
// so PinInput starts fresh; we only need to clear the rest).
watch(newProfileModal, (open) => {
  if (!open) return
  newName.value = ''
  newColor.value = null
  pinMode.value = 'none'
  newPin.value = ''
  createError.value = null
})

const canCreate = computed(() =>
  !!newName.value.trim() && (pinMode.value === 'none' || newPin.value.length === 4))

async function createProfile() {
  createError.value = null
  const name = newName.value.trim()
  if (!name) { createError.value = 'Name is required'; return }
  if (pinMode.value !== 'none' && newPin.value.length !== 4) {
    createError.value = 'Enter a 4-character PIN'; return
  }
  creating.value = true
  try {
    const body = { name, role: 'user' }
    if (newColor.value) body.color = newColor.value
    if (pinMode.value !== 'none') {
      body.pin = newPin.value.toUpperCase()
      body.pinTemporary = pinMode.value === 'temporary'
    }
    const res = await fetch('/api/auth/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) { createError.value = (await res.json()).error; return }
    const created = await res.json()
    users.value = [created, ...users.value]
    newProfileModal.value = false
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const j = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    const [profiles, gs] = await Promise.all([
      j('/api/auth/profiles'),
      // Groups is admin-only; tolerate failure so the table still renders.
      fetch('/api/auth/groups', { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    users.value = profiles
    groups.value = gs
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

// userId -> [groups they belong to]
const groupsByUser = computed(() => {
  const m = new Map()
  for (const g of groups.value) {
    for (const id of g.memberIds ?? []) {
      if (!m.has(id)) m.set(id, [])
      m.get(id).push(g)
    }
  }
  return m
})
const groupsOf = (u) => groupsByUser.value.get(u._id) ?? []

function roleLabel(u) {
  if (u.isGuest) return 'Guest'
  return u.role === 'admin' ? 'Admin' : 'User'
}

// Merge edits made in the config modal (name / role / PIN) back into the row.
function onUserUpdated(patch) {
  users.value = users.value.map(u => (u._id === patch._id ? { ...u, ...patch } : u))
}

// Config modal asked to delete this user — close config, open the delete flow.
function onRequestDelete(u) {
  configUser.value = null
  deleteUser.value = u
}

function onUserDeleted(id) {
  users.value = users.value.filter(u => u._id !== id)
}

</script>

<template>
  <section>
    <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Users</h1>
    <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-4">
      {{ users.length }} {{ users.length === 1 ? 'profile' : 'profiles' }}
    </p>

    <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">Couldn't load profiles: {{ error }}</p>

    <div v-else class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] overflow-hidden">
      <!-- header row (desktop) -->
      <div class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_5rem] gap-3 items-center px-[18px] py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
        <span>Name</span><span class="text-center">Role</span><span class="text-center">PIN</span><span class="text-center">Group</span><span />
      </div>

      <div
        v-for="u in users"
        :key="u._id"
        class="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_5rem] gap-x-3 gap-y-1 items-center px-[18px] py-2.5 border-t border-slate-100 dark:border-white/[0.06]"
      >
        <!-- name -->
        <div class="flex items-center gap-3 min-w-0">
          <AvatarCircle :profile="u" :size="34" />
          <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ u.name }}</span>
        </div>

        <!-- role -->
        <div class="flex col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto sm:justify-center">
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="u.isGuest
              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15'
              : (u.role === 'admin'
                ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/15'
                : 'text-slate-500 dark:text-white/60 bg-slate-500/12 dark:bg-white/8')"
          >
            <Icon name="shield" v-if="u.role === 'admin' && !u.isGuest" class="w-3 h-3" fill />
            {{ roleLabel(u) }}
          </span>
        </div>

        <!-- pin -->
        <div class="hidden sm:flex sm:justify-center">
          <span v-if="u.hasPin && u.pinTemporary" class="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-600 dark:text-amber-400" title="One-time PIN — user sets their own on next sign-in">
            <Icon name="clock" class="w-3.5 h-3.5" />
            Temporary
          </span>
          <span v-else-if="u.hasPin" class="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
            <Icon name="lockSimple" class="w-3.5 h-3.5" />
            Set
          </span>
          <span v-else class="text-[13px] text-slate-400 dark:text-white/35">None</span>
        </div>

        <!-- group -->
        <div class="hidden sm:flex sm:justify-center items-center gap-1.5 min-w-0">
          <template v-if="groupsOf(u).length">
            <span class="inline-block max-w-[7rem] truncate text-[12px] font-medium px-2 py-0.5 rounded-full bg-slate-500/10 dark:bg-white/8 text-slate-600 dark:text-white/70">
              {{ groupsOf(u)[0].name }}
            </span>
            <button
              v-if="groupsOf(u).length > 1"
              class="shrink-0 text-[12px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/22 cursor-pointer transition-colors"
              @click="groupsUser = u"
            >+{{ groupsOf(u).length - 1 }}</button>
          </template>
          <span v-else class="text-[13px] text-slate-400 dark:text-white/35">—</span>
        </div>

        <!-- actions -->
        <div class="col-start-2 row-start-1 sm:col-auto sm:row-auto self-center justify-self-end">
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap text-indigo-600 dark:text-indigo-300 bg-indigo-500/12 hover:bg-indigo-500/22 transition-colors"
            @click="configUser = u"
          >Config</button>
        </div>
      </div>
    </div>

    <!-- Per-user app/widget config -->
    <UserConfigModal :user="configUser" @close="configUser = null" @updated="onUserUpdated" @delete="onRequestDelete" />

    <!-- Permanent user + data deletion -->
    <UserDeleteModal :user="deleteUser" @close="deleteUser = null" @deleted="onUserDeleted" />

    <!-- All groups a user belongs to -->
    <TemplateModal :show="!!groupsUser" size="xs" @cancel="groupsUser = null">
      <div class="p-5">
        <div class="flex items-start justify-between mb-3">
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">{{ groupsUser?.name }}'s groups</h2>
          <button class="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" @click="groupsUser = null">
            <Icon width="16" height="16" name="close" :sw="2.5" />
          </button>
        </div>
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="g in (groupsUser ? groupsOf(groupsUser) : [])"
            :key="g._id"
            class="text-[12px] font-medium px-2.5 py-1 rounded-full bg-slate-500/10 dark:bg-white/8 text-slate-700 dark:text-white/70"
          >{{ g.name }}</li>
        </ul>
      </div>
    </TemplateModal>

    <!-- Create user -->
    <div class="mt-3">
      <button
        @click="newProfileModal = true"
        class="group cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-300/50 dark:border-indigo-400/20 transition-colors"
      >
        <Icon name="plus" class="w-4 h-4 nuc-pop" :sw="2.5" />
        Create user
      </button>
    </div>

    <TemplateModal :show="newProfileModal" size="sm" @cancel="newProfileModal = false">
      <div class="flex flex-col" style="max-height: 85vh">
        <!-- Header -->
        <div class="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
          <div>
            <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Create new user</h2>
            <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">A new profile for this Nucleus</p>
          </div>
          <button class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" @click="newProfileModal = false">
            <Icon width="16" height="16" name="close" :sw="2.5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 min-h-0 flex flex-col gap-5">
          <!-- Live preview -->
          <div class="flex justify-center">
            <AvatarCircle :name="newName.trim() || '?'" :color="previewColor" :size="64" />
          </div>

          <!-- Name -->
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Name</label>
            <input
              v-model="newName"
              type="text"
              maxlength="64"
              placeholder="e.g. Alex"
              class="w-full text-sm rounded-xl border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2 placeholder:text-slate-400 dark:placeholder:text-white/30"
              @keydown.enter.prevent="canCreate && createProfile()"
            />
          </div>

          <!-- Color -->
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">Color</label>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                title="Auto (from name)"
                class="w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110 cursor-pointer"
                :class="newColor === null ? 'border-slate-900 dark:border-white' : 'border-transparent'"
                @click="newColor = null"
              >
                <RefreshIcon class="w-3.5 h-3.5 text-slate-400 dark:text-white/50" />
              </button>
              <button
                v-for="c in AVATAR_COLORS"
                :key="c"
                type="button"
                class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                :class="newColor === c ? 'border-slate-900 dark:border-white' : 'border-transparent'"
                :style="{ background: c }"
                @click="newColor = c"
              />
            </div>
          </div>

          <!-- PIN -->
          <div>
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35 mb-1.5">PIN</label>
            <div class="flex gap-1.5 bg-slate-500/[0.06] dark:bg-white/[0.04] rounded-xl p-1">
              <button
                v-for="m in [{ k: 'none', l: 'No PIN' }, { k: 'set', l: 'Set PIN' }, { k: 'temporary', l: 'Temporary' }]"
                :key="m.k"
                type="button"
                class="flex-1 text-[13px] font-semibold py-1.5 rounded-lg cursor-pointer transition-colors"
                :class="pinMode === m.k ? 'bg-white dark:bg-white/15 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white'"
                @click="selectPinMode(m.k)"
              >{{ m.l }}</button>
            </div>

            <p v-if="pinMode === 'none'" class="text-[11px] text-slate-400 dark:text-white/40 mt-2">
              This profile signs in without a PIN.
            </p>

            <!-- Temporary: generated one-time PIN shown in the yellow box -->
            <template v-else-if="pinMode === 'temporary'">
              <div class="rounded-xl border border-amber-300/60 dark:border-amber-400/25 bg-amber-500/10 px-3 py-2.5 mt-3">
                <p class="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Icon name="clock" class="w-3.5 h-3.5" />
                  One-time PIN
                </p>
                <p class="font-mono text-2xl font-bold tracking-[0.35em] text-amber-800 dark:text-amber-200 mt-1 pl-1">{{ newPin }}</p>
                <p class="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-1">Share with the user. They'll set their own PIN on first sign-in.</p>
              </div>
              <button
                type="button"
                class="mt-2 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                @click="newPin = randomPin()"
              >Generate a different PIN</button>
            </template>

            <!-- Permanent: typed via PinInput -->
            <template v-else>
              <p class="text-[11px] text-slate-400 dark:text-white/40 mt-2">
                The user signs in with this PIN. They can change it later.
              </p>
              <div class="mt-3 flex justify-center">
                <PinInput @complete="pin => newPin = pin" @incomplete="newPin = ''" />
              </div>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200/60 dark:border-white/10">
          <p class="text-[11px] text-red-500 truncate">{{ createError }}</p>
          <div class="flex gap-2 shrink-0">
            <button class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-white/60 bg-slate-500/10 dark:bg-white/8 hover:bg-slate-500/20 cursor-pointer transition-colors" @click="newProfileModal = false">Cancel</button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 cursor-pointer transition-colors"
              :disabled="creating || !canCreate"
              @click="createProfile"
            >{{ creating ? 'Creating…' : 'Create user' }}</button>
          </div>
        </div>
      </div>
    </TemplateModal>
  </section>
</template>
