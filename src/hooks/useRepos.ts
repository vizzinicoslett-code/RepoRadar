import { useContext } from 'react'
import { RepoContext } from './repoContext'

export function useRepos() {
  const state = useContext(RepoContext)
  if (!state) throw new Error('useRepos must be used inside RepoProvider')
  return {
    repos: state.catalog?.repositories ?? [],
    source: state.catalog?.source ?? null,
    generatedAt: state.catalog?.generatedAt ?? null,
    repoCount: state.catalog?.repoCount ?? 0,
    fallbackReason: state.catalog?.fallbackReason ?? null,
    status: state.status, loading: state.status === 'loading', error: state.status === 'error',
  }
}
