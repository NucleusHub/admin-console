<script setup>
import { ref, onMounted } from 'vue'

const stats = ref({ users: '–', apps: '–', widgets: '–' })

async function load() {
  const get = (url) => fetch(url, { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => [])
  const [u, a, w] = await Promise.all([
    get('/api/auth/profiles'),
    get('/api/registry/apps'),
    get('/api/registry/widgets'),
  ])
  stats.value = { users: u.length, apps: a.length, widgets: w.length }
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

    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="c in CARDS"
        :key="c.key"
        class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] p-5"
      >
        <p class="text-3xl font-bold tabular-nums" :class="c.accent">{{ stats[c.key] }}</p>
        <p class="text-[13px] font-medium text-slate-500 dark:text-white/50 mt-1">{{ c.label }}</p>
      </div>
    </div>
  </section>
</template>
