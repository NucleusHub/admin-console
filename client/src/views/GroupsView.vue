<script setup>
import { ref, computed, onMounted } from 'vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'
import GroupEditModal from '@/components/GroupEditModal.vue'
import GroupDeleteModal from '@/components/GroupDeleteModal.vue'

const groups = ref([])
const users = ref([])           // non-guest profiles
const orbitInstalled = ref(false)
const loading = ref(true)
const error = ref(null)

const editing = ref(false)
const editTarget = ref(null)    // group being configured, or null for create
const deleteGroup = ref(null)

const usersById = computed(() => {
  const m = new Map()
  for (const u of users.value) m.set(u._id, u)
  return m
})
function membersOf(g) {
  return (g.memberIds ?? []).map(id => usersById.value.get(id)).filter(Boolean)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const j = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    const [gs, profiles, regApps] = await Promise.all([
      j('/api/auth/groups'),
      j('/api/auth/profiles'),
      fetch('/api/registry/apps').then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    groups.value = gs
    users.value = profiles.filter(p => !p.isGuest)
    orbitInstalled.value = regApps.some(a => a.id === 'orbit')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() { editTarget.value = null; editing.value = true }
function openConfig(g) { editTarget.value = g; editing.value = true }

function onSaved(updated) {
  const exists = groups.value.some(g => g._id === updated._id)
  groups.value = (exists
    ? groups.value.map(g => (g._id === updated._id ? updated : g))
    : [...groups.value, updated]
  ).sort((a, b) => a.name.localeCompare(b.name))
}

function onDeleted(id) {
  groups.value = groups.value.filter(g => g._id !== id)
}
</script>

<template>
  <section>
    <div class="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Groups</h1>
        <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5">
          Bundle users and control their apps, widgets &amp; shared storage
        </p>
      </div>
      <button
        class="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer transition-colors"
        @click="openCreate"
      >New group</button>
    </div>

    <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-500 py-4">{{ error }}</p>

    <!-- Empty state -->
    <div v-if="!loading && !groups.length" class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] py-14 flex flex-col items-center gap-3 text-center">
      <svg class="w-10 h-10 text-slate-300 dark:text-white/20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
      <p class="text-sm font-medium text-slate-500 dark:text-white/50">No groups yet</p>
      <button class="text-xs font-semibold text-indigo-600 dark:text-indigo-300 cursor-pointer" @click="openCreate">Create your first group</button>
    </div>

    <!-- Group cards -->
    <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
      <div
        v-for="g in groups"
        :key="g._id"
        class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] p-4 flex flex-col gap-3"
      >
        <div class="flex items-center gap-2">
          <p class="flex-1 min-w-0 text-sm font-semibold text-slate-900 dark:text-white truncate">{{ g.name }}</p>
          <span
            v-if="g.sharedOrbit"
            class="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
            title="Has a shared Orbit folder"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44z" /></svg>
            Shared
          </span>
          <button
            class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
            title="Delete group"
            @click="deleteGroup = g"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>

        <!-- Members preview -->
        <div class="flex items-center gap-2">
          <div class="flex -space-x-2">
            <AvatarCircle
              v-for="u in membersOf(g).slice(0, 4)"
              :key="u._id"
              :profile="u" :size="26"
              class="ring-2 ring-white dark:ring-slate-900 rounded-full"
            />
            <span v-if="!membersOf(g).length" class="text-xs text-slate-400 dark:text-white/35">No members</span>
          </div>
          <span class="text-xs font-medium text-slate-500 dark:text-white/50">
            {{ (g.memberIds?.length ?? 0) }} {{ (g.memberIds?.length ?? 0) === 1 ? 'member' : 'members' }}
          </span>
        </div>

        <button
          class="self-start px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-indigo-600 dark:text-indigo-300 bg-indigo-500/12 hover:bg-indigo-500/22 transition-colors"
          @click="openConfig(g)"
        >Configure</button>
      </div>
    </div>

    <GroupEditModal
      :show="editing"
      :group="editTarget"
      :users="users"
      :orbit-installed="orbitInstalled"
      @close="editing = false"
      @saved="onSaved"
    />
    <GroupDeleteModal :group="deleteGroup" :users="users" :orbit-installed="orbitInstalled" @close="deleteGroup = null" @deleted="onDeleted" />
  </section>
</template>
