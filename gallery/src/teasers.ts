/** Teaser thumbnails (420px) inlined into the bundle. Keyed by artwork file name. */
const files = import.meta.glob('./teasers/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const TEASERS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop()!, url]),
)
export const teaser = (file: string) => TEASERS[file] ?? ''
