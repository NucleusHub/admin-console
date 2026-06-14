<script setup>
import { ref, watch, computed } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'

// Deleting a group needs a decision about its shared Orbit directory: wipe it,
// or hand its files to one user. We run Orbit's teardown first, then delete the
// group itself in auth.
const props = defineProps({
  group: { type: Object, default: null },
  users: { type: Array, default: () => [] }, // for the transfer target
  orbitInstalled: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'deleted'])

const mode = ref('delete') // 'delete' | 'transfer'
const targetId = ref('')
const busy = ref(false)
const error = ref(null)

// The shared-files decision only matters when Orbit is around to hold them.
const hasSharedFiles = computed(() => props.orbitInstalled)

watch(() => props.group, () => {
  mode.value = 'delete'
  targetId.value = props.users[0]?._id ?? ''
  error.value = null
}, { immediate: true })

const canConfirm = computed(() => mode.value === 'delete' || !!targetId.value)

async function confirm() {
  if (!props.group || !canConfirm.value) return
  busy.value = true
  error.value = null
  try {
    // 1. Tear down the shared Orbit directory (skipped entirely if Orbit isn't
    //    installed — there can be no shared files to handle).
    if (hasSharedFiles.value) {
      const body = mode.value === 'transfer'
        ? { action: 'transfer', targetProfileId: targetId.value }
        : { action: 'delete' }
      const teardown = await fetch(`/api/orbit/groups/${props.group._id}/teardown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!teardown.ok && teardown.status !== 404) throw new Error(`Orbit teardown failed (HTTP ${teardown.status})`)
    }

    // 2. Delete the group (and its override rows).
    const del = await fetch(`/api/auth/groups/${props.group._id}`, { method: 'DELETE', credentials: 'include' })
    if (!del.ok) throw new Error(`HTTP ${del.status}`)
    emit('deleted', props.group._id)
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <TemplateModal :show="!!group" panel-class="max-w-md" @cancel="busy || emit('close')">
    <div class="p-5 flex flex-col gap-4">
      <div>
        <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Delete “{{ group?.name }}”?</h2>
        <p class="text-xs text-slate-500 dark:text-white/45 mt-1">
          This removes the group and its app/widget rules. Members keep their accounts.
        </p>
      </div>

      <!-- Distinct callout for the shared-storage decision -->
      <div v-if="hasSharedFiles" class="flex items-start gap-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 px-3.5 py-2.5">
        <svg class="w-4 h-4 mt-0.5 shrink-0 text-violet-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
        <p class="text-xs font-medium text-violet-700 dark:text-violet-300 leading-relaxed">
          This group has a shared Orbit folder. Choose what happens to its files:
        </p>
      </div>

      <div v-if="hasSharedFiles" class="flex flex-col gap-2">
        <!-- Delete option -->
        <button
          class="text-left rounded-xl border px-3.5 py-3 transition-colors cursor-pointer"
          :class="mode === 'delete'
            ? 'border-red-500/60 bg-red-500/10'
            : 'border-slate-200 dark:border-white/10 hover:bg-slate-100/60 dark:hover:bg-white/5'"
          @click="mode = 'delete'"
        >
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Permanently delete files</p>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">The shared directory and everything in it is removed from storage. Cannot be undone.</p>
        </button>

        <!-- Transfer option -->
        <button
          class="text-left rounded-xl border px-3.5 py-3 transition-colors cursor-pointer"
          :class="mode === 'transfer'
            ? 'border-indigo-500/60 bg-indigo-500/10'
            : 'border-slate-200 dark:border-white/10 hover:bg-slate-100/60 dark:hover:bg-white/5'"
          @click="mode = 'transfer'"
        >
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Transfer files to a user</p>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">Move the shared files into one user's personal Orbit.</p>
          <select
            v-if="mode === 'transfer'"
            v-model="targetId"
            class="mt-2 w-full text-sm rounded-lg border border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/5 text-slate-900 dark:text-white px-2.5 py-1.5 cursor-pointer"
            @click.stop
          >
            <option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option>
          </select>
        </button>
      </div>

      <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

      <div class="flex gap-3 justify-end">
        <button
          class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
          :disabled="busy"
          @click="emit('close')"
        >Cancel</button>
        <button
          class="px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors disabled:opacity-60"
          :class="mode === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'"
          :disabled="busy || !canConfirm"
          @click="confirm"
        >{{ busy ? 'Working…' : (mode === 'delete' ? 'Delete group' : 'Transfer & delete') }}</button>
      </div>
    </div>
  </TemplateModal>
</template>
