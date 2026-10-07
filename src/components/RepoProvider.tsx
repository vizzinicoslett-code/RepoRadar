import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { RepoContext } from '../hooks/repoContext'
import type { RepoState } from '../hooks/repoContext'
import { repoSource } from '../services/repoSource'
import { evaluateRepo } from '../services/evaluation/evaluateRepo'

export function RepoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RepoState>({ status: 'loading', catalog: null })
  useEffect(() => {
    const controller = new AbortController()
    repoSource.list(controller.signal).then((catalog) => {
      if (!controller.signal.aborted) {
        const referenceDate = catalog.generatedAt ?? new Date().toISOString()
        const evaluated = { ...catalog, repositories: catalog.repositories.map((repo) => ({ ...repo, radar: { ...repo.radar, evaluation: evaluateRepo(repo, referenceDate) } })) }
        setState({ status: catalog.status, catalog: evaluated })
      }
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error', catalog: null })
    })
    return () => controller.abort()
  }, [])
  return <RepoContext.Provider value={state}>{children}</RepoContext.Provider>
}
