<script setup>
import { ref, computed, onMounted } from 'vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'
import GroupEditModal from '@/components/GroupEditModal.vue'
import GroupDeleteModal from '@/components/GroupDeleteModal.vue'
import { Icon } from '@core/icons'
import UserGroupIcon from '@/assets/icons/user-group.svg?component'
import TrashIcon from '@/assets/icons/trash.svg?component'

const groups = ref([])
const users = ref([])           // non-guest profiles
const orbitInstalled = ref(false)
const prismInstalled = ref(false)
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
    prismInstalled.value = regApps.some(a => a.id === 'prism')
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
      <UserGroupIcon class="w-10 h-10 text-slate-300 dark:text-white/20" />
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
            <Icon name="folder" class="w-3 h-3" />
            Shared
          </span>
          <button
            class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
            title="Delete group"
            @click="deleteGroup = g"
          >
            <TrashIcon class="w-4 h-4" />
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
      :prism-installed="prismInstalled"
      @close="editing = false"
      @saved="onSaved"
    />
    <GroupDeleteModal :group="deleteGroup" :users="users" :orbit-installed="orbitInstalled" :prism-installed="prismInstalled" @close="deleteGroup = null" @deleted="onDeleted" />
  </section>
</template>
