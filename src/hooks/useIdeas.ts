import { useEffect, useSyncExternalStore } from 'react'
import { IDEAS_KEY, ideaStore } from '../services/ideas/ideaStorage.ts'
export function useIdeas() {
  const state = useSyncExternalStore(ideaStore.subscribe, ideaStore.getSnapshot)
  useEffect(() => {
    // Pick up changes made while this tab was on a page without an idea view.
    if (ideaStore.getSnapshot().persistent) ideaStore.refresh()
    const update = (event: StorageEvent) => { if (event.key === IDEAS_KEY || event.key === null) ideaStore.refresh() }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])
  return { ...state, store: ideaStore }
}
