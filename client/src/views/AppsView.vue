<script setup>
import { ref, onMounted } from 'vue'
import ConfirmGlobalModal from '@/components/ConfirmGlobalModal.vue'
import AppIcon from '@core/AppIcon.vue'
import VersionBadge from '@core/VersionBadge.vue'

const apps = ref([])
const disabled = ref(new Set()) // globally-disabled ids
const loading = ref(true)
const error = ref(null)
const pending = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [regRes, ov] = await Promise.all([
      fetch('/api/registry/apps'),
      fetch('/api/auth/overrides', { credentials: 'include' }).then(r => r.ok ? r.json() : { apps: [] }).catch(() => ({ apps: [] })),
    ])
    if (!regRes.ok) throw new Error(`HTTP ${regRes.status}`)
    apps.value = await regRes.json()
    disabled.value = new Set(ov.apps ?? [])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const isOff = (id) => disabled.value.has(id)

async function applyToggle() {
  const a = pending.value
  if (!a) return
  const next = !isOff(a.id)
  pending.value = null
  try {
    const res = await fetch(`/api/auth/overrides/app/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ disabled: next }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const s = new Set(disabled.value)
    next ? s.add(a.id) : s.delete(a.id)
    disabled.value = s
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <section>
    <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Apps</h1>
    <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-3">Installed applications</p>

    <!-- Global-action notice -->
    <div class="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5">
      <svg class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        Enabling or disabling an app here is <strong>global</strong> — it hides or restores the app for every user.
      </p>
    </div>

    <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">{{ error }}</p>

    <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))">
      <div
        v-for="a in apps"
        :key="a.id"
        class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] p-4 flex flex-col gap-3"
      >
        <!-- Content dims when disabled; the Enable/Required action stays vivid -->
        <div class="flex items-start gap-3" :class="{ 'opacity-55': isOff(a.id) }">
          <div class="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <AppIcon :svg="a.iconSvg" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ a.name }}</p>
              <span v-if="isOff(a.id)" class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">Disabled</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-white/45 mt-0.5 line-clamp-2">{{ a.description }}</p>
            <VersionBadge v-if="a.version" :version="a.version" class="mt-1.5" />
          </div>
        </div>
        <span
          v-if="a.locked"
          class="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-white/50 bg-slate-500/10 dark:bg-white/8"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="10" rx="2" /><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Required
        </span>
        <button
          v-else
          class="self-start px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          :class="isOff(a.id)
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22'
            : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
          @click="pending = a"
        >{{ isOff(a.id) ? 'Enable' : 'Disable' }}</button>
      </div>
    </div>

    <ConfirmGlobalModal
      :show="!!pending"
      :title="`${isOff(pending?.id) ? 'Enable' : 'Disable'} ${pending?.name} for everyone?`"
      :message="isOff(pending?.id)
        ? 'This app will be visible and accessible to all users again.'
        : 'This app will be hidden from every user (launcher, sidebar and dashboard).'"
      :confirm-label="isOff(pending?.id) ? 'Enable globally' : 'Disable globally'"
      :danger="!isOff(pending?.id)"
      @confirm="applyToggle"
      @cancel="pending = null"
    />
  </section>
</template>
