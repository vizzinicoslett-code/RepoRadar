import type { Repo } from '../../types/repo.ts'
import { evaluationConfig as config, projectProfiles, unknownProfile, broadScopePattern, developmentFilters } from './evaluationRules.ts'
import type { DevelopmentFilter } from './evaluationRules.ts'
import type { ProjectEvaluation } from './evaluationTypes.ts'

const score = (value: number) => Math.round(Math.min(100, Math.max(0, value)))
const growthSignal = (delta: number | null, cap: number) => delta === null ? null : Math.min(1, Math.log1p(Math.max(0, delta)) / Math.log1p(cap))
export function evaluateRepo(repo: Repo, referenceDate: string): ProjectEvaluation {
  const github = repo.github
  const text = [github.name, github.description, ...(github.topics ?? [])].filter(Boolean).join(' ')
  const profile = projectProfiles.find((rule) => rule.pattern.test(text)) ?? unknownProfile
  const matchedRules = ['profile:' + profile.kind], signals: string[] = [], warnings: string[] = []
  let { use, remake, solo, codex, complexity } = profile
  const age = github.pushedAt ? (Date.parse(referenceDate) - Date.parse(github.pushedAt)) / 86400000 : NaN
  const activity = github.archived === true ? 0 : Number.isFinite(age) && age >= 0 ? Math.max(0, 1 - age / config.activityDays) : null
  const metadata = [Boolean(github.description?.trim()), Boolean(github.topics?.length), Boolean(github.language), Boolean(github.license), Boolean(github.homepage?.trim())].filter(Boolean).length / 5
  const components = {
    hot: repo.radar.hotScore === null ? null : repo.radar.hotScore / 100,
    day: growthSignal(repo.radar.growth.day, config.growthCaps.day),
    week: growthSignal(repo.radar.growth.week, config.growthCaps.week), activity, metadata,
  }
  let weighted = 0, availableWeight = 0
  for (const key of Object.keys(components) as (keyof typeof components)[]) {
    const value = components[key]
    if (value !== null) { weighted += value * config.researchWeights[key]; availableWeight += config.researchWeights[key] }
  }
  const research = score(100 * weighted / availableWeight)
  const broad = broadScopePattern.test(text) && !['kernel', 'database', 'distributed', 'compiler', 'training', 'hardware', 'model-runtime', 'content', 'skills'].includes(profile.kind)
  if (broad) {
    remake += config.broadScopeAdjustment.remake; solo += config.broadScopeAdjustment.solo
    codex += config.broadScopeAdjustment.codex; complexity += config.broadScopeAdjustment.complexity
    matchedRules.push('broad-scope'); warnings.push('元数据包含框架、平台或多任务特征，完整复刻范围较大；先限定一个工作流。')
  }
  const language = github.language?.toLowerCase()
  if (['typescript', 'javascript', 'python'].includes(language ?? '')) {
    codex += config.languageAdjustment.commonCodex; complexity += config.languageAdjustment.commonComplexity
    matchedRules.push('common-language'); signals.push('主要语言属于常见个人开发技术栈；语言只贡献少量修正。')
  } else if (['c', 'c++', 'assembly'].includes(language ?? '')) {
    codex += config.languageAdjustment.systemsCodex; solo += config.languageAdjustment.systemsSolo; complexity += config.languageAdjustment.systemsComplexity
    matchedRules.push('systems-language'); warnings.push('主要语言需要额外关注编译和平台调试；语言仅作弱信号，不决定能否个人开发。')
  }
  if (!github.license) { use -= 5; matchedRules.push('license-unknown'); warnings.push('当前元数据未提供 License，直接复用前需核对原项目许可。') }
  if (github.archived === true) { use -= 20; remake -= 8; matchedRules.push('archived'); warnings.push('仓库已归档，不能把旧项目视为持续维护。') }
  if (activity !== null && activity > .75) signals.push('最近仍有 push，活跃度依据数据观测时间计算。')
  if ((repo.radar.growth.day ?? 0) > 0) signals.push('已有真实 24h Star 增长；不使用总 Stars 提高复刻适合度。')
  if (profile.kind !== 'unknown') signals.push('元数据匹配「' + profile.label + '」规则：' + profile.reason)
  if (remake >= config.thresholds.remake && !broad) signals.push('这一类项目可限定输入与输出，模板提供能够独立成立的 V1。')
  if (profile.kind === 'content' || profile.kind === 'skills') warnings.push('这是内容或模板类项目：Use 评价软件直接使用，Remake 评价整理工具；不等同于评价内容质量。')
  if (complexity >= 80) warnings.push('原项目涉及底层、基础设施或硬件能力，不建议个人完整复刻。')
  if (metadata < .6 || profile.kind === 'unknown') warnings.push('元数据有限，未读取 README、源代码或依赖规模；评分需结合原项目文档确认。')
  if (components.day === null || components.week === null) warnings.push('缺失的增长周期不参与 Research，已有权重重新归一化，不因历史不足扣分。')
  if (activity === null) warnings.push('没有可靠的 pushedAt，活跃度不参与 Research。')
  if (repo.source === 'mock') warnings.push('当前项目来自 Mock，热度和增长是演示数据。')
  use = score(use); remake = score(remake); solo = score(solo); codex = score(codex); complexity = score(complexity)
  const build = score(remake * config.buildWeights.remake + solo * config.buildWeights.solo + codex * config.buildWeights.codex + research * config.buildWeights.research)
  const actions: string[] = []
  if (research >= config.thresholds.research) actions.push('值得深入研究')
  if (use >= config.thresholds.use) actions.push('值得直接试用')
  if (remake >= config.thresholds.remake) actions.push('适合做简化版')
  if (remake < config.thresholds.remake || broad) actions.push('适合借鉴产品思路')
  if (complexity >= 80 || solo < 50) actions.push('不建议个人完整复刻')
  if (research < 60 && build < 60) actions.push('暂时观察')
  const corrections = matchedRules.slice(1).join('、') || '无额外修正'
  const base = `${profile.label}基准；${profile.reason} 修正规则：${corrections}。`
  return {
    researchScore: research, useScore: use, remakeScore: remake, soloScore: solo, codexScore: codex, complexityScore: complexity, buildScore: build,
    kind: profile.kind, profileLabel: profile.label, matchedRules, signals, warnings, recommendedActions: actions,
    researchComponents: components,
    explanations: {
      researchScore: 'Hot 35% + log 增长24h 25% + log 增长7d 15% + 最近30天活跃度15% + 元数据10%；缺失项重新归一化。增长上限5000/25000，元数据检查简介、Topics、语言、License、Homepage。',
      useScore: `${base} Use 基准 ${profile.use}；无 License −5、归档 −20。教程/资料的阅读价值由 Research 表达。`,
      remakeScore: `${base} Remake 基准 ${profile.remake}；范围大 −18、归档 −8。评价个人简化版，不使用总 Stars。`,
      soloScore: `${base} Solo 基准 ${profile.solo}；范围大 −22、C/C++/Assembly −2。`,
      codexScore: `${base} Codex 基准 ${profile.codex}；范围大 −12、TS/JS/Python +3、C/C++/Assembly −2。评价个人需求与验收方式的适配。`,
      complexityScore: `${base} 难度基准 ${profile.complexity}；范围大 +24、TS/JS/Python −2、C/C++/Assembly +3。越高越难：0–20很低、21–40较低、41–60中等、61–80较高、81–100很高。`,
      buildScore: `round(${remake} × 40% + ${solo} × 25% + ${codex} × 25% + ${research} × 10%) = ${build}。Hot 表示热度，Build 表示个人 + Codex 开发适合度。`,
    },
  }
}
export function isDevelopmentFilter(value: string): value is DevelopmentFilter { return (developmentFilters as readonly string[]).includes(value) }
export function matchesDevelopmentFilter(evaluation: ProjectEvaluation, filter: DevelopmentFilter): boolean {
  return filter === '值得复刻' ? evaluation.remakeScore >= config.thresholds.remake : filter === '一个人能做' ? evaluation.soloScore >= config.thresholds.solo : evaluation.codexScore >= config.thresholds.codex
}
export function selectBuildRepos(repos: readonly Repo[], query: string, category: string, referenceDate: string): Repo[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return repos.map((repo) => ({ repo, evaluation: repo.radar.evaluation ?? evaluateRepo(repo, referenceDate) })).filter(({ repo, evaluation }) => {
    const text = [repo.github.fullName, repo.github.description, repo.github.language, ...(repo.github.topics ?? []), ...repo.radar.tags].filter(Boolean).join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term)) && (category === '全部' || (isDevelopmentFilter(category) ? matchesDevelopmentFilter(evaluation, category) : repo.radar.tags.includes(category)))
  }).sort((a, b) => b.evaluation.buildScore - a.evaluation.buildScore || b.evaluation.remakeScore - a.evaluation.remakeScore || a.repo.id.localeCompare(b.repo.id)).map(({ repo }) => repo)
}
