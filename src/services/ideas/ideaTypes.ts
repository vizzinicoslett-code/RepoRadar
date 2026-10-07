export const ideaStatuses = ['灵感', '准备做', '正在做'] as const
export type IdeaStatus = (typeof ideaStatuses)[number]
export interface IdeaDraft {
  sourceRepoId: string
  sourceFullName: string
  title: string
  targetUser: string
  problem: string
  features: string[]
  excludedFeatures: string[]
  techStack: string[]
  notes: string
  status: IdeaStatus
}
export interface ProjectIdea extends IdeaDraft { id: string; createdAt: string; updatedAt: string }
