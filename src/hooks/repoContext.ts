import { createContext } from 'react'
import type { LoadStatus, RepoCatalog } from '../types/repo'

export interface RepoState { status: LoadStatus; catalog: RepoCatalog | null }
export const RepoContext = createContext<RepoState | null>(null)
