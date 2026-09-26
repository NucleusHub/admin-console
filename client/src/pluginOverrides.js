import { ref } from 'vue'

const disabled = ref(new Set())
let loaded = false

async function load(force = false) {
  if (loaded && !force) return disabled.value
  loaded = true
  try {
    const r = await fetch('/api/auth/overrides', { credentials: 'include' })
    if (r.ok) disabled.value = new Set((await r.json()).plugins ?? [])
  } catch {}
  return disabled.value
}

function setDisabled(id, off) {
  const s = new Set(disabled.value)
  off ? s.add(id) : s.delete(id)
  disabled.value = s
}

export function usePluginOverrides() {
  return { disabled, load, setDisabled }
}
