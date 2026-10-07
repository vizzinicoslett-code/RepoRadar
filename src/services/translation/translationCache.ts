export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface CacheEntry { originalText: string; translatedText: string; createdAt: number; lastUsedAt: number }
export const CACHE_KEY = 'repoRadar.translationCache.v1'
export const MODE_KEY = 'repoRadar.translationMode'
export function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}
export function translationKey(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return 'en:zh:' + (hash >>> 0).toString(16)
}
export class TranslationCache {
  private entries: Record<string, CacheEntry> = {}
  private storage: StorageLike | null
  private clock: () => number
  constructor(storage: StorageLike | null = browserStorage(), clock: () => number = Date.now) {
    this.storage = storage; this.clock = clock
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          const v = value as Partial<CacheEntry> | null
          if (v && typeof v.originalText === 'string' && typeof v.translatedText === 'string' && v.translatedText.trim() && typeof v.createdAt === 'number' && Number.isFinite(v.createdAt) && typeof v.lastUsedAt === 'number' && Number.isFinite(v.lastUsedAt) && key === translationKey(v.originalText)) this.entries[key] = v as CacheEntry
        }
      }
      this.prune()
    } catch { this.entries = {} }
  }
  private prune() {
    const keys = Object.keys(this.entries).sort((a, b) => this.entries[b].lastUsedAt - this.entries[a].lastUsedAt)
    for (const key of keys.slice(500)) delete this.entries[key]
  }
  private save() { try { this.storage?.setItem(CACHE_KEY, JSON.stringify(this.entries)) } catch { /* memory cache still works when storage is full or blocked */ } }
  get(text: string): string | null {
    const entry = this.entries[translationKey(text)]
    // Exact text check protects against hash collisions.
    if (!entry || entry.originalText !== text) return null
    entry.lastUsedAt = this.clock(); this.save()
    return entry.translatedText
  }
  put(text: string, translatedText: string) {
    if (!translatedText.trim()) return
    const key = translationKey(text), now = this.clock()
    const previous = this.entries[key]
    this.entries[key] = { originalText: text, translatedText, createdAt: previous?.originalText === text ? previous.createdAt : now, lastUsedAt: now }
    this.prune(); this.save()
  }
}
