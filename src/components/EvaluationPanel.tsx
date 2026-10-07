import { Link } from 'react-router-dom'
import { scoreLabels } from '../services/evaluation/evaluationRules'
import type { ProjectEvaluation, ScoreKey } from '../services/evaluation/evaluationTypes'
const keys: ScoreKey[] = ['researchScore', 'useScore', 'remakeScore', 'soloScore', 'codexScore', 'complexityScore']
export function EvaluationPanel({ evaluation, repoId }: { evaluation: ProjectEvaluation; repoId: string }) {
  return <section className="detail-panel evaluation-panel" aria-labelledby="evaluation-title">
    <div className="section-label">PROJECT EVALUATION · RULES V1</div><h2 id="evaluation-title">RepoRadar 判断</h2>
    <p className="evaluation-intro">基于元数据与真实增长的透明规则，不是 AI 结论。未读取 README 或源代码。</p>
    <div className="build-summary"><div><span>Build Score</span><strong>{evaluation.buildScore}<small>/ 100</small></strong></div><p>个人 + Codex 开发适合度<br /><span>Hot 表示热度，Build 表示开发适合度。</span></p></div>
    <dl className="evaluation-scores">{keys.map((key) => <div key={key} className={key === 'complexityScore' ? 'complexity-score' : ''}><dt>{scoreLabels[key]}{key === 'complexityScore' && <small>越高越难</small>}</dt><dd><strong>{evaluation[key]}</strong><span className="score-track" aria-hidden="true"><i style={{ width: evaluation[key] + '%' }} /></span></dd></div>)}</dl>
    <div className="evaluation-reasons"><div><h3>有利信号</h3><ul>{evaluation.signals.length ? evaluation.signals.map((signal) => <li key={signal}>{signal}</li>) : <li>当前信息不足，先核对项目用途。</li>}</ul></div><div><h3>注意</h3><ul>{evaluation.warnings.length ? evaluation.warnings.map((warning) => <li key={warning}>{warning}</li>) : <li>这些分数不能替代文档阅读与实际试用。</li>}</ul></div></div>
    <div className="recommended-actions" aria-label="推荐行动">{evaluation.recommendedActions.map((action) => <span className="tag" key={action}>{action}</span>)}</div>
    <details className="evaluation-formula"><summary>查看七项评分依据与命中规则</summary><p>匹配类型：{evaluation.profileLabel} · {evaluation.matchedRules.join(' / ')}</p><dl>{[...keys, 'buildScore' as const].map((key) => <div key={key}><dt>{scoreLabels[key]} · {evaluation[key]}</dt><dd>{evaluation.explanations[key]}</dd></div>)}</dl><p>Research 分项（0–1）：{Object.entries(evaluation.researchComponents).map(([key, value]) => `${key}=${value === null ? '缺失，不参与' : value.toFixed(3)}`).join('；')}。</p></details>
    <Link className="button button-primary idea-cta" to={'/idea/' + repoId}>我想做类似项目<span aria-hidden="true"> →</span></Link>
  </section>
}
