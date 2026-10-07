import { browserTranslator, createChromeTranslator, languagePair } from './chromeTranslator.ts'
import type { NativeTranslator, TranslatorAPI } from './chromeTranslator.ts'
import { browserStorage, MODE_KEY, TranslationCache } from './translationCache.ts'
import type { StorageLike } from './translationCache.ts'
export type TranslationMode = 'original' | 'zh'
export type TranslationStatus = 'unsupported' | 'downloadable' | 'downloading' | 'ready' | 'translating' | 'error'
export interface TranslationState { mode: TranslationMode; status: TranslationStatus; progress: number | null; initialized: boolean }
export class TranslationService {
  private api: TranslatorAPI | null
  private cache: TranslationCache
  private storage: StorageLike | null
  private native: NativeTranslator | null = null
  private initialization: Promise<void> | null = null
  private pending = new Map<string, Promise<string | null>>()
  private consumers = new Map<string, Set<() => boolean>>()
  private queue: Promise<unknown> = Promise.resolve()
  private listeners = new Set<() => void>()
  private state: TranslationState
  constructor(api: TranslatorAPI | null = browserTranslator(), storage: StorageLike | null = browserStorage(), cache = new TranslationCache(storage)) {
    this.api = api; this.storage = storage; this.cache = cache
    let mode: TranslationMode = 'original'
    try { if (api && storage?.getItem(MODE_KEY) === 'zh') mode = 'zh' } catch { /* safe default */ }
    this.state = { mode, status: api ? 'downloadable' : 'unsupported', progress: null, initialized: false }
    if (!api) this.saveMode()
  }
  getSnapshot = () => this.state
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback) } }
  private update(change: Partial<TranslationState>) { this.state = { ...this.state, ...change }; this.listeners.forEach((f) => f()) }
  private saveMode() { try { this.storage?.setItem(MODE_KEY, this.state.mode) } catch { /* preference is optional */ } }
  async checkAvailability() {
    if (!this.api) return
    try {
      const available = await this.api.availability(languagePair)
      if (this.initialization || this.native) return
      if (available === 'unavailable') { this.update({ status: 'unsupported', mode: 'original' }); this.saveMode() }
      else this.update({ status: available === 'downloading' ? 'downloading' : available === 'available' ? 'ready' : 'downloadable' })
    } catch { if (!this.native && !this.initialization) this.update({ status: 'error' }) }
  }
  original() { this.update({ mode: 'original' }); this.saveMode() }
  // Must only be called directly from a user click, never mount/effect or restored preference.
  activateChinese(): Promise<void> {
    if (!this.api || this.state.status === 'unsupported') { this.update({ mode: 'original', status: 'unsupported' }); this.saveMode(); return Promise.resolve() }
    this.update({ mode: 'zh' }); this.saveMode()
    if (this.native) return Promise.resolve()
    if (this.initialization) return this.initialization
    this.update({ status: 'downloading', progress: null })
    try {
      const creation = createChromeTranslator(this.api, (progress) => this.update({ status: 'downloading', progress }))
      this.initialization = creation.then((native) => { this.native = native; this.update({ status: 'ready', initialized: true, progress: null }) })
        .catch(() => { this.update({ status: 'error', initialized: false, progress: null }) })
        .finally(() => { this.initialization = null })
    } catch { this.update({ status: 'error' }); return Promise.resolve() }
    return this.initialization
  }
  cached(text: string) { return this.cache.get(text) }
  translate(text: string, needed: () => boolean = () => true): Promise<string | null> {
    const cached = this.cached(text)
    if (cached !== null) return Promise.resolve(cached)
    if (!this.native || this.state.mode !== 'zh' || !text.trim()) return Promise.resolve(null)
    const existing = this.pending.get(text)
    if (existing) { this.consumers.get(text)?.add(needed); return existing }
    this.consumers.set(text, new Set([needed]))
    const task = this.queue.then(async () => {
      if (![...(this.consumers.get(text) ?? [])].some((isNeeded) => isNeeded()) || this.state.mode !== 'zh') return null
      this.update({ status: 'translating' })
      try {
        const translated = await this.native!.translate(text)
        if (typeof translated !== 'string' || !translated.trim()) return null
        this.cache.put(text, translated)
        return translated
      } catch { return null }
    }).finally(() => {
      this.pending.delete(text)
      this.consumers.delete(text)
      if (this.pending.size === 0) this.update({ status: 'ready' })
    })
    this.pending.set(text, task); this.queue = task.catch(() => null)
    return task
  }
}
