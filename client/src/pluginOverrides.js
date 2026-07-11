import { ref } from 'vue'

// Shared reactive set of globally-disabled plugin ids. A single module instance
// is used by both the Plugins page (the toggle) and AdminLayout (the nav), so
// disabling a plugin removes its contributed tab INSTANTLY — no reload.

const disabled = ref(new Set())
let loaded = false

async function load(force = false) {
  if (loaded && !force) return disabled.value
  loaded = true
  try {
    const r = await fetch('/api/auth/overrides', { credentials: 'include' })
    if (r.ok) disabled.value = new Set((await r.json()).plugins ?? [])
  } catch { /* keep whatever we have */ }
  return disabled.value
}

// Optimistically reflect a toggle so dependent UI (nav tabs) reacts at once.
function setDisabled(id, off) {
  const s = new Set(disabled.value)
  off ? s.add(id) : s.delete(id)
  disabled.value = s
}

export function usePluginOverrides() {
  return { disabled, load, setDisabled }
}
