import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { TranslationContext } from '../hooks/translationContext'
import { TranslationService } from '../services/translation/translator'
export function TranslationProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => new TranslationService())
  useEffect(() => { void service.checkAvailability() }, [service])
  return <TranslationContext.Provider value={service}>{children}</TranslationContext.Provider>
}
