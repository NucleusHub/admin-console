<script setup>
import { ref, computed, onMounted } from 'vue'
import ConfirmGlobalModal from '@/components/ConfirmGlobalModal.vue'
import VersionBadge from '@core/VersionBadge.vue'
import { Icon } from '@core/icons'

const widgets = ref([])
const disabled = ref(new Set()) // globally-disabled ids
const loading = ref(true)
const error = ref(null)
const pending = ref(null) // widget awaiting confirm

async function load() {
  loading.value = true
  error.value = null
  try {
    const [regRes, ov] = await Promise.all([
      fetch('/api/registry/widgets'),
      fetch('/api/auth/overrides', { credentials: 'include' }).then(r => r.ok ? r.json() : { widgets: [] }).catch(() => ({ widgets: [] })),
    ])
    if (!regRes.ok) throw new Error(`HTTP ${regRes.status}`)
    widgets.value = await regRes.json()
    disabled.value = new Set(ov.widgets ?? [])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const isOff = (id) => disabled.value.has(id)
// A widget whose data provider is globally disabled is off too (cascade).
const providerOff = (w) => w.dependsOn && disabled.value.has(w.dependsOn)
const widgetById = computed(() => new Map(widgets.value.map(w => [w.id, w])))
const providerName = (w) => widgetById.value.get(w.dependsOn)?.name || w.dependsOn

async function applyToggle() {
  const w = pending.value
  if (!w) return
  const next = !isOff(w.id)
  pending.value = null
  try {
    const res = await fetch(`/api/auth/overrides/widget/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ disabled: next }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const s = new Set(disabled.value)
    next ? s.add(w.id) : s.delete(w.id)
    disabled.value = s
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <section>
    <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Widgets</h1>
    <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-3">Dashboard widgets</p>

    <!-- Global-action notice -->
    <div class="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5">
      <Icon name="warning" class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
      <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        Enabling or disabling a widget here is <strong>global</strong> — it applies to every user. It's separate from each user's own show/hide choices.
      </p>
    </div>

    <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">{{ error }}</p>

    <div v-else class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] overflow-hidden">
      <div
        v-for="w in widgets"
        :key="w.id"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] last:border-0"
      >
        <div class="min-w-0 w-full sm:flex-1" :class="{ 'opacity-55': isOff(w.id) || providerOff(w) }">
          <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ w.name }}</p>
          <p class="text-xs text-slate-500 dark:text-white/45 truncate">{{ w.description }}</p>
          <p v-if="w.dependsOn" class="text-[11px] text-slate-400 dark:text-white/35 truncate inline-flex items-center gap-1 mt-0.5">
            <Icon name="link" class="w-3 h-3 shrink-0" />
            Depends on {{ providerName(w) }}
          </p>
        </div>

        <!-- Meta + action: wraps below the name on narrow screens -->
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <!-- Badges dim with the row; the action button below stays vivid -->
          <div class="flex items-center gap-2" :class="{ 'opacity-55': isOff(w.id) || providerOff(w) }">
            <VersionBadge v-if="w.version" :version="w.version" class="shrink-0" />
            <span class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/90 dark:bg-white/8 text-slate-600 dark:text-white/55 shrink-0">{{ w.slot }}</span>
            <span v-if="!w.locked && (isOff(w.id) || providerOff(w))" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">Disabled</span>
          </div>

          <!-- Core/required widgets can't be disabled -->
          <span
            v-if="w.locked"
            class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-white/50 bg-slate-500/10 dark:bg-white/8"
          >
            <Icon name="lockSimple" class="w-3 h-3" />
            {{ w.slot === 'system' ? 'Core' : 'Required' }}
          </span>
          <!-- Off because its data provider is disabled -->
          <span
            v-else-if="providerOff(w)"
            class="shrink-0 text-[11px] font-medium text-slate-400 dark:text-white/40"
            :title="`Re-enable ${providerName(w)} to control this widget`"
          >via {{ providerName(w) }}</span>
          <button
            v-else
            class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            :class="isOff(w.id)
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22'
              : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
            @click="pending = w"
          >{{ isOff(w.id) ? 'Enable' : 'Disable' }}</button>
        </div>
      </div>
      <p v-if="!widgets.length" class="text-sm text-slate-400 dark:text-white/40 py-8 text-center">No widgets.</p>
    </div>

    <ConfirmGlobalModal
      :show="!!pending"
      :title="`${isOff(pending?.id) ? 'Enable' : 'Disable'} ${pending?.name} for everyone?`"
      :message="isOff(pending?.id)
        ? 'This widget will become available to all users again.'
        : 'This widget will be hidden from every user\'s dashboard.'"
      :confirm-label="isOff(pending?.id) ? 'Enable globally' : 'Disable globally'"
      :danger="!isOff(pending?.id)"
      @confirm="applyToggle"
      @cancel="pending = null"
    />
  </section>
</template>
