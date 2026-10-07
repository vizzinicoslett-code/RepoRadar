import type { Repo } from '../../types/repo.ts'
import type { ProjectEvaluation } from '../evaluation/evaluationTypes.ts'
import { getIdeaTemplate } from '../evaluation/ideaTemplates.ts'
import type { IdeaDraft } from './ideaTypes.ts'
export function createIdeaDraft(repo: Repo, evaluation: ProjectEvaluation): IdeaDraft {
  const template = getIdeaTemplate(evaluation.kind)
  return {
    sourceRepoId: repo.id, sourceFullName: repo.github.fullName,
    title: `${repo.github.name} · ${template.name}`.slice(0, 120), targetUser: template.targetUser,
    problem: template.problem, features: [...template.features], excludedFeatures: [...template.excludedFeatures],
    techStack: [...template.techStack], notes: '灵感来自 ' + repo.github.fullName + '。仅借鉴核心场景；功能与技术栈是个人简化版建议，需由你确认。', status: '灵感',
  }
}
