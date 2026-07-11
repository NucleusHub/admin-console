// Discovers admin-tab contributions from installed plugins.
//
// Each plugin declares its own admin tab(s) in its manifest under
// `extensions.adminTabs` (see plugins/<id>/nucleus.plugin.json). Admin does not
// hardcode any plugin's tab — it reads the declaration and mounts the component
// the plugin ships. This is the client half of the plugin `adminTabs` extension
// point; the plugin-runtime registry exposes the same metadata server-side.

// Eagerly load every plugin manifest; lazily map every plugin .vue component.
// This file lives in src/, so `../plugins` is the client-dir plugins entry
// (symlink → repo /plugins, mounted at /app/plugins in the container), mirroring
// how `core` is wired.
const manifests = import.meta.glob('../plugins/*/nucleus.plugin.json', { eager: true, import: 'default' })
const components = import.meta.glob('../plugins/*/**/*.vue')

function build() {
  const tabs = []
  for (const [file, manifest] of Object.entries(manifests)) {
    const match = file.match(/\/plugins\/([^/]+)\/nucleus\.plugin\.json$/)
    if (!match) continue
    const dir = match[1]
    const pluginId = manifest?.id || dir
    const adminTabs = manifest?.extensions?.adminTabs
    if (!Array.isArray(adminTabs)) continue
    for (const t of adminTabs) {
      if (!t?.path || !t?.label || !t?.component) continue
      const key = `../plugins/${dir}/${t.component}`
      const loader = components[key]
      if (!loader) {
        console.warn(`[plugins] admin-tab component not found for ${pluginId}: ${key}`)
        continue
      }
      tabs.push({ pluginId, path: t.path, label: t.label, loader })
    }
  }
  return tabs
}

// The plugin-contributed admin tabs available at build time. Filtering by the
// enabled/disabled state (a runtime concern) happens in AdminLayout.
export const pluginAdminTabs = build()
