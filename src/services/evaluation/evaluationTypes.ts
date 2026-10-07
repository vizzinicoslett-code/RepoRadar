export type ProjectKind = 'kernel' | 'database' | 'distributed' | 'compiler' | 'training' | 'hardware' | 'model-runtime' | 'skills' | 'content' | 'cv' | 'cli' | 'desktop' | 'agent' | 'web' | 'learning' | 'automation' | 'library' | 'app' | 'unknown'
export type ScoreKey = 'researchScore' | 'useScore' | 'remakeScore' | 'soloScore' | 'codexScore' | 'complexityScore' | 'buildScore'
export interface ProjectEvaluation {
  researchScore: number
  useScore: number
  remakeScore: number
  soloScore: number
  codexScore: number
  complexityScore: number
  buildScore: number
  kind: ProjectKind
  profileLabel: string
  matchedRules: string[]
  signals: string[]
  warnings: string[]
  recommendedActions: string[]
  explanations: Record<ScoreKey, string>
  researchComponents: Record<'hot' | 'day' | 'week' | 'activity' | 'metadata', number | null>
}
