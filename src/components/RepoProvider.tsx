import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { RepoContext } from '../hooks/repoContext'
import type { RepoState } from '../hooks/repoContext'
import { repoSource } from '../services/repoSource'

export function RepoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RepoState>({ status: 'loading', catalog: null })
  useEffect(() => {
    const controller = new AbortController()
    repoSource.list(controller.signal).then((catalog) => {
      if (!controller.signal.aborted) setState({ status: catalog.status, catalog })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error', catalog: null })
    })
    return () => controller.abort()
  }, [])
  return <RepoContext.Provider value={state}>{children}</RepoContext.Provider>
}
