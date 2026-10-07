export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'
export interface NativeTranslator { translate(text: string): Promise<string>; destroy?(): void }
export interface TranslatorAPI {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>
  create(options: { sourceLanguage: string; targetLanguage: string; monitor?: (monitor: { addEventListener(type: string, listener: (event: { loaded: number }) => void): void }) => void }): Promise<NativeTranslator>
}
export const languagePair = { sourceLanguage: 'en', targetLanguage: 'zh' }
export function browserTranslator(): TranslatorAPI | null {
  if (!('Translator' in globalThis)) return null
  const api = (globalThis as typeof globalThis & { Translator?: TranslatorAPI }).Translator
  return api && typeof api.create === 'function' && typeof api.availability === 'function' ? api : null
}
export function createChromeTranslator(api: TranslatorAPI, onProgress: (progress: number) => void): Promise<NativeTranslator> {
  // Called directly by a click handler, before awaiting anything: preserve user activation.
  return api.create({ ...languagePair, monitor(monitor) {
    monitor.addEventListener('downloadprogress', (event) => {
      if (Number.isFinite(event.loaded)) onProgress(Math.round(Math.min(1, Math.max(0, event.loaded)) * 100))
    })
  } })
}
