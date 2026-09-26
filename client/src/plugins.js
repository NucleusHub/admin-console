const manifests = import.meta.glob('../plugins/*/nucleus.plugin.json', { eager: true, import: 'default' })
const components = import.meta.glob('../plugins/*/client/admin/**/*.vue')

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

export const pluginAdminTabs = build()
