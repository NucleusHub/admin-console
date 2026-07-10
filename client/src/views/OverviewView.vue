<script setup>
import { ref, onMounted } from 'vue'
import { formatVersion, channelLabel } from '@core/version.js'

const stats = ref({ users: '–', apps: '–', widgets: '–' })
// Nucleus platform version — the ground truth apps/widgets declare
// compatibility against. Served by the registry from the root nucleus.json.
const platform = ref({ version: null, manifestVersion: null })

async function load() {
  const get = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => [])
  const [u, a, w, n] = await Promise.all([
    get('/api/auth/profiles'),
    get('/api/registry/apps'),
    get('/api/registry/widgets'),
    fetch('/api/registry/nucleus').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ])
  stats.value = { users: u.length, apps: a.length, widgets: w.length }
  platform.value = n || {}
}
onMounted(load)

const CARDS = [
  { key: 'users',   label: 'Users',   accent: 'text-indigo-500' },
  { key: 'apps',    label: 'Apps',    accent: 'text-emerald-500' },
  { key: 'widgets', label: 'Widgets', accent: 'text-pink-500' },
]
</script>

<template>
  <section>
    <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Overview</h1>
    <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-4">Your Nucleus at a glance</p>

    <!-- Platform version hero -->
    <div class="mb-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/15 dark:to-purple-500/10 border border-indigo-200/80 dark:border-indigo-400/20 p-4 sm:p-5 flex items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="text-[13px] font-medium text-slate-500 dark:text-white/50">Nucleus</p>
        <div class="flex items-center gap-2.5 mt-1 flex-wrap">
          <p class="text-2xl sm:text-3xl font-bold tabular-nums font-mono text-slate-900 dark:text-white">
            {{ platform.version ? formatVersion(platform.version) : '–' }}
          </p>
          <span
            v-if="platform.version"
            class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
          >{{ channelLabel(platform.version) }}</span>
        </div>
        <p v-if="platform.manifestVersion" class="text-[11px] text-slate-400 dark:text-white/35 mt-1">
          Manifest schema v{{ platform.manifestVersion }}
        </p>
      </div>
      <svg class="w-10 h-10 shrink-0 text-indigo-500/70 dark:text-indigo-400/60" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" />
      </svg>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="c in CARDS"
        :key="c.key"
        class="nuc-lift rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] p-4 sm:p-5"
      >
        <p class="text-2xl sm:text-3xl font-bold tabular-nums" :class="c.accent">{{ stats[c.key] }}</p>
        <p class="text-[13px] font-medium text-slate-500 dark:text-white/50 mt-1">{{ c.label }}</p>
      </div>
    </div>
  </section>
</template>
