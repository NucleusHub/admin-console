<script setup>
import { ref, watch, computed } from 'vue'
import TemplateModal from '@core/TemplateModal.vue'
import PinInput from '@core/auth/PinInput.vue'
import AvatarCircle from '@core/auth/AvatarCircle.vue'
import { useAuth } from '@core/auth/useAuth.js'

// Permanently deletes a user and ALL of their data across every app. The acting
// admin must re-enter their own PIN. Flow: confirm the PIN first (no mutation),
// then tear down each app's data, then drop the profile itself — so the
// irreversible teardown never runs on a wrong PIN.
const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['close', 'deleted'])

const { profile: admin } = useAuth()

const pin = ref('')
const busy = ref(false)
const step = ref('')        // progress label shown while working
const error = ref(null)

// Only require a PIN when the acting admin actually has one set.
const needsPin = computed(() => !!admin.value?.hasPin)
const canConfirm = computed(() => !needsPin.value || pin.value.length === 4)

watch(() => props.user, () => {
  pin.value = ''
  busy.value = false
  step.value = ''
  error.value = null
}, { immediate: true })

// Best-effort per-app teardown. An app that isn't installed/reachable (network
// error or 404) is skipped; a real error (any other non-OK status) aborts before
// the profile is deleted, so data is never silently orphaned.
async function teardown(label, url) {
  let res
  try {
    res = await fetch(url, { method: 'POST', credentials: 'include' })
  } catch {
    return // unreachable → treat as not installed
  }
  if (res.ok || res.status === 404) return
  throw new Error(`${label} cleanup failed (HTTP ${res.status})`)
}

async function confirm() {
  if (!props.user || !canConfirm.value || busy.value) return
  busy.value = true
  error.value = null
  const id = props.user._id
  const body = JSON.stringify({ pin: needsPin.value ? pin.value.toUpperCase() : undefined })
  const opts = { headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
  try {
    // 1. Verify the admin's PIN up front — nothing is deleted yet.
    step.value = 'Verifying PIN…'
    const check = await fetch(`/api/auth/profiles/${id}/confirm-delete`, { method: 'POST', body, ...opts })
    if (!check.ok) throw new Error((await check.json()).error || `HTTP ${check.status}`)

    // 2. Tear down the user's data in every installed app. We gate on the
    // registry (fetched fresh here) so we only hit apps that are actually
    // present — an uninstalled app has no route and its teardown would 404. The
    // best-effort fallback in teardown() still covers apps mid-uninstall.
    step.value = 'Deleting files & data…'
    const installed = new Set(
      await fetch('/api/registry/apps')
        .then(r => (r.ok ? r.json() : []))
        .then(list => list.map(a => a.id))
        .catch(() => []),
    )
    const TEARDOWNS = [
      { id: 'orbit',         label: 'Orbit',     url: `/api/orbit/profiles/${id}/teardown` },
      { id: 'echo',          label: 'Echo',      url: `/api/echo/users/${id}/teardown` },
      { id: 'goal-calendar', label: 'Goals',     url: `/api/goals/users/${id}/teardown` },
      { id: 'watchlist',     label: 'Watchlist', url: `/api/watchlist/users/${id}/teardown` },
      { id: 'pulse',         label: 'Pulse',     url: `/api/pulse/dashboard/users/${id}/teardown` },
    ]
    for (const app of TEARDOWNS) {
      if (installed.has(app.id)) await teardown(app.label, app.url)
    }

    // 3. Drop group membership, overrides and the profile itself.
    step.value = 'Removing profile…'
    const del = await fetch(`/api/auth/profiles/${id}`, { method: 'DELETE', body, ...opts })
    if (!del.ok) throw new Error((await del.json()).error || `HTTP ${del.status}`)

    emit('deleted', id)
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
    step.value = ''
  }
}
</script>

<template>
  <TemplateModal :show="!!user" size="md" @cancel="busy || emit('close')">
    <div class="p-5 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <AvatarCircle v-if="user" :profile="user" :size="40" />
        <div>
          <h2 class="text-[15px] font-bold text-slate-900 dark:text-white">Delete “{{ user?.name }}”?</h2>
          <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5">This account and everything in it.</p>
        </div>
      </div>

      <!-- Hard warning -->
      <div class="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5">
        <svg class="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.7A1.5 1.5 0 0 0 3.11 21h17.78a1.5 1.5 0 0 0 1.3-2.44l-8.48-14.7a1.5 1.5 0 0 0-2.62 0z" />
        </svg>
        <p class="text-xs font-medium text-red-700 dark:text-red-300 leading-relaxed">
          This permanently deletes {{ user?.name }} and <strong>all of their data</strong> across every app.
          <strong>This cannot be undone.</strong>
        </p>
      </div>

      <!-- PIN confirmation -->
      <div v-if="needsPin" class="flex flex-col gap-2">
        <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
          Confirm with your PIN
        </label>
        <div class="flex justify-center">
          <PinInput :disabled="busy" @complete="p => pin = p" @incomplete="pin = ''" />
        </div>
      </div>

      <p v-if="busy && step" class="text-xs text-slate-500 dark:text-white/50">{{ step }}</p>
      <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

      <div class="flex gap-3 justify-end">
        <button
          class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
          :disabled="busy"
          @click="emit('close')"
        >Cancel</button>
        <button
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer transition-colors disabled:opacity-60"
          :disabled="busy || !canConfirm"
          @click="confirm"
        >{{ busy ? 'Deleting…' : 'Delete user & data' }}</button>
      </div>
    </div>
  </TemplateModal>
</template>
