<script setup>
import { ref, onMounted, computed } from 'vue'
import ConfirmGlobalModal from '@/components/ConfirmGlobalModal.vue'
import AppIcon from '@core/AppIcon.vue'
import VersionBadge from '@core/VersionBadge.vue'
import { usePlugins } from '@core/usePlugins.js'
import { usePluginOverrides } from '@/pluginOverrides.js'
import { Icon } from '@core/icons'
import LightBulbIcon from '@/assets/icons/light-bulb.svg?component'

const { plugins, apiVersion, nucleus, loading, error, load } = usePlugins()

// Shared global-disabled set (also read by AdminLayout's nav), so toggling here
// removes/adds the plugin's admin tab instantly.
const { disabled, load: loadOverrides, setDisabled } = usePluginOverrides()
const pending = ref(null)
onMounted(() => { load(); loadOverrides() })

const count = computed(() => plugins.value.length)

const isOff = (id) => disabled.value.has(id)

async function applyToggle() {
  const p = pending.value
  if (!p) return
  const next = !isOff(p.id)
  pending.value = null
  try {
    const res = await fetch(`/api/auth/overrides/plugin/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ disabled: next }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setDisabled(p.id, next)
  } catch (e) {
    error.value = e.message
  }
}

// Visual treatment per discovery state (manifest validity / API compatibility).
const STATE_META = {
  discovered:   { label: 'Discovered',   cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  incompatible: { label: 'Incompatible', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  invalid:      { label: 'Invalid',      cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}
const stateMeta = (s) => STATE_META[s] ?? { label: s || 'Unknown', cls: 'bg-slate-500/15 text-slate-500 dark:text-white/50' }

// Flatten declared dependencies to a printable list of "id range" chips.
function depChips(deps) {
  const out = []
  for (const kind of ['apps', 'plugins']) {
    for (const [id, range] of Object.entries(deps?.[kind] ?? {})) {
      out.push({ kind, id, range })
    }
  }
  return out
}

// The manifest fields the registry reads — shown in the empty state so it is
// obvious what to author. Mirrors infra/plugin-runtime/manifest.js.
const SCHEMA_FIELDS = [
  { key: 'id',           req: true,  note: 'kebab-case slug' },
  { key: 'name',         req: true,  note: '' },
  { key: 'description',  req: false, note: '' },
  { key: 'version',      req: true,  note: 'SemVer' },
  { key: 'apiVersion',   req: true,  note: 'plugin API targeted' },
  { key: 'target',       req: true,  note: '"core", app id, or array' },
  { key: 'crossApp',     req: true,  note: 'true when spanning apps' },
  { key: 'author',       req: false, note: '' },
  { key: 'dependencies', req: false, note: '{ apps, plugins }' },
  { key: 'permissions',  req: false, note: 'string[]' },
]
</script>

<template>
  <section>
    <div class="flex items-baseline justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-[22px] font-bold text-slate-900 dark:text-white">Plugins</h1>
        <p class="text-[13px] text-slate-500 dark:text-white/45 mt-0.5 mb-3">Discovered plugins &amp; their metadata</p>
      </div>
      <span
        v-if="apiVersion"
        class="text-[11px] font-medium text-slate-500 dark:text-white/45 px-2 py-1 rounded-lg bg-slate-500/10 dark:bg-white/8"
        :title="nucleus ? `Nucleus ${nucleus}` : ''"
      >Plugin API v{{ apiVersion }}</span>
    </div>

    <!-- Global-action notice -->
    <div class="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5">
      <Icon name="warning" class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
      <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        Enabling or disabling a plugin here is <strong>global and admin-only</strong> — it affects every user (e.g. hiding
        the plugin's admin tabs). Users can't toggle plugins themselves.
      </p>
    </div>

    <p v-if="loading" class="text-sm text-slate-500 dark:text-white/45 py-8 text-center">Loading…</p>
    <p v-else-if="error" class="text-sm text-red-500 py-8 text-center">{{ error }}</p>

    <!-- Empty state + schema reference -->
    <div
      v-else-if="count === 0"
      class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200/80 dark:border-white/10 p-8 flex flex-col items-center text-center gap-3"
    >
      <div class="w-14 h-14 rounded-2xl bg-indigo-500/12 flex items-center justify-center">
        <LightBulbIcon class="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
      </div>
      <h2 class="text-base font-bold text-slate-900 dark:text-white">No plugins yet</h2>
      <p class="text-sm text-slate-500 dark:text-white/50 max-w-md">
        Drop a plugin under <code class="font-mono text-slate-600 dark:text-white/70">/plugins/&lt;id&gt;</code>
        with a <code class="font-mono text-slate-600 dark:text-white/70">nucleus.plugin.json</code> manifest and it will appear here.
      </p>

      <div class="mt-3 w-full max-w-md text-left">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-1.5">Manifest fields</p>
        <ul class="rounded-xl border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/70 dark:divide-white/8 overflow-hidden">
          <li v-for="f in SCHEMA_FIELDS" :key="f.key" class="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
            <code class="font-mono text-slate-700 dark:text-white/75">{{ f.key }}</code>
            <span
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              :class="f.req ? 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' : 'bg-slate-500/10 text-slate-500 dark:text-white/40'"
            >{{ f.req ? 'required' : 'optional' }}</span>
            <span v-if="f.note" class="ml-auto text-[11px] text-slate-400 dark:text-white/35 truncate">{{ f.note }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Discovered plugins -->
    <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))">
      <div
        v-for="p in plugins"
        :key="p.id"
        class="rounded-2xl bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-indigo-200/80 dark:border-indigo-400/20 shadow-[0_0_18px_-2px_rgba(99,102,241,0.18)] dark:shadow-[0_0_22px_-4px_rgba(0,0,0,0.55)] p-4 flex flex-col gap-3"
      >
        <!-- Content dims when disabled; the action button below stays vivid -->
        <div class="flex flex-col gap-3" :class="{ 'opacity-55': isOff(p.id) }">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <AppIcon v-if="p.iconSvg" :svg="p.iconSvg" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <LightBulbIcon v-else class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ p.name }}</p>
              <span v-if="isOff(p.id)" class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">Disabled</span>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" :class="stateMeta(p.state).cls">{{ stateMeta(p.state).label }}</span>
            </div>
            <p class="text-[11px] font-mono text-slate-400 dark:text-white/35 truncate">{{ p.id }}</p>
            <p v-if="p.description" class="text-xs text-slate-500 dark:text-white/45 mt-0.5 line-clamp-2">{{ p.description }}</p>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              <VersionBadge v-if="p.version" :version="p.version" />
              <span v-if="p.apiVersion" class="text-[10px] font-medium text-slate-500 dark:text-white/45 px-1.5 py-0.5 rounded-md bg-slate-500/10 dark:bg-white/8">API v{{ p.apiVersion }}</span>
            </div>
          </div>
        </div>

        <!-- Targets -->
        <div v-if="p.target?.length" class="flex items-center gap-1.5 flex-wrap">
          <span v-if="p.crossApp" class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/12 text-purple-600 dark:text-purple-400">cross-app</span>
          <span
            v-for="t in p.target"
            :key="t"
            class="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
          >{{ t }}</span>
        </div>

        <!-- Declared dependencies -->
        <div v-if="depChips(p.dependencies).length" class="flex items-start gap-1.5 flex-wrap">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/30 mt-0.5">Deps</span>
          <span
            v-for="d in depChips(p.dependencies)"
            :key="d.kind + d.id"
            class="text-[10.5px] font-mono px-1.5 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-white/55"
            :title="d.kind"
          >{{ d.id }}&nbsp;{{ d.range }}</span>
        </div>

        <!-- Permissions -->
        <div v-if="p.permissions?.length" class="flex items-start gap-1.5 flex-wrap">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/30 mt-0.5">Perms</span>
          <span
            v-for="perm in p.permissions"
            :key="perm"
            class="text-[10.5px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >{{ perm }}</span>
        </div>

        <p v-if="p.author" class="text-[11px] text-slate-400 dark:text-white/35">by {{ p.author }}</p>

        <!-- Validation errors -->
        <ul v-if="p.errors?.length" class="mt-0.5 space-y-1">
          <li v-for="(e, i) in p.errors" :key="i" class="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5">
            <Icon name="infoDot" class="w-3 h-3 mt-0.5 shrink-0" :sw="2.2" />
            <span>{{ e }}</span>
          </li>
        </ul>

        </div>

        <!-- Global enable/disable (admin-only; affects every user) -->
        <button
          class="mt-auto self-start px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          :class="isOff(p.id)
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 hover:bg-emerald-500/22'
            : 'text-red-600 dark:text-red-400 bg-red-500/12 hover:bg-red-500/22'"
          @click="pending = p"
        >{{ isOff(p.id) ? 'Enable' : 'Disable' }}</button>
      </div>
    </div>

    <ConfirmGlobalModal
      :show="!!pending"
      :title="`${isOff(pending?.id) ? 'Enable' : 'Disable'} ${pending?.name} for everyone?`"
      :message="isOff(pending?.id)
        ? 'This plugin will be active again for all users, and its admin tabs will reappear.'
        : 'This plugin will be disabled globally — its admin tabs are hidden for every user.'"
      :confirm-label="isOff(pending?.id) ? 'Enable globally' : 'Disable globally'"
      :danger="!isOff(pending?.id)"
      @confirm="applyToggle"
      @cancel="pending = null"
    />
  </section>
</template>
