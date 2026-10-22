import { abilitySlug } from './ability-bars'

// no-inline keeps the icons as cacheable files; Vite would otherwise embed the sub-4 KB ones as base64 in this page's chunk.
const files = import.meta.glob<string>('../../assets/abilities/*.png', { eager: true, import: 'default', query: '?url&no-inline' })

const byName = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url]))

/** The ability's icon URL, or undefined when no icon has been added for it. */
export const abilityIcon = (name: string): string | undefined => byName.get(abilitySlug(name))

/** Icon file names without the extension; for checking that every icon is used by a bar. */
export const iconSlugs = (): string[] => [...byName.keys()]
