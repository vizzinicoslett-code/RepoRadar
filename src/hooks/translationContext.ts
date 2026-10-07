import { createContext, useContext, useSyncExternalStore } from 'react'
import { TranslationService } from '../services/translation/translator'
export const TranslationContext = createContext<TranslationService | null>(null)
export function useTranslation() {
  const service = useContext(TranslationContext)
  if (!service) throw new Error('TranslationProvider is missing')
  const state = useSyncExternalStore(service.subscribe, service.getSnapshot)
  return { service, ...state }
}
