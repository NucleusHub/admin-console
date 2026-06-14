<script setup>
import { ref, computed, onMounted } from 'vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'
import UserConfigModal from '@/components/UserConfigModal.vue'
import TemplateModal from '@core/TemplateModal.vue'

const users = ref([])
const groups = ref([])
const loading = ref(true)
const error = ref(null)
const configUser = ref(null)     // user whose "configure apps" modal is open
const groupsUser = ref(null)     // user whose "all groups" modal is open

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
          <AvatarCircle :name="u.name" :color="u.color" :emoji="u.emoji" :admin="u.role === 'admin'" :size="34" />
          <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ u.name }}</span>
        </div>

        <!-- role -->
        <div class="flex sm:justify-center">
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="u.isGuest
              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15'
              : (u.role === 'admin'
                ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/15'
                : 'text-slate-500 dark:text-white/60 bg-slate-500/12 dark:bg-white/8')"
          >
            <svg v-if="u.role === 'admin' && !u.isGuest" class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6l-9-4z" />
            </svg>
            {{ roleLabel(u) }}
          </span>
        </div>

        <!-- pin -->
        <div class="hidden sm:flex sm:justify-center">
          <span v-if="u.hasPin" class="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
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
        <div class="row-span-2 sm:row-span-1 self-center justify-self-end">
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap text-indigo-600 dark:text-indigo-300 bg-indigo-500/12 hover:bg-indigo-500/22 transition-colors"
            @click="configUser = u"
          >Config</button>
        </div>
      </div>
    </div>

    <!-- Per-user app/widget config -->
    <UserConfigModal :user="configUser" @close="configUser = null" @updated="onUserUpdated" />

    <!-- All groups a user belongs to -->
    <TemplateModal :show="!!groupsUser" panel-class="max-w-xs" @cancel="groupsUser = null">
      <div class="p-5">
        <div class="flex items-start justify-between mb-3">
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">{{ groupsUser?.name }}'s groups</h2>
          <button class="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" @click="groupsUser = null">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
  </section>
</template>
