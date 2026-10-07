import { Link, useLocation } from 'react-router-dom'
import type { Repo, TimeRange } from '../types/repo'
import { formatCount, formatDate, getGrowth, signedGrowth, languageColors, timeRanges } from '../utils/repos'
import { Icon } from './Icon'
import { RepoDescription } from './RepoDescription'
import { MetricBadge } from './MetricBadge'

export function RepoCard({ repo, rank, range }: { repo: Repo; rank: number; range: TimeRange }) {
  const location = useLocation()
  const metric = timeRanges.find((item) => item.value === range)?.metric
  const github = repo.github
  const analysis = repo.radar.analysis
  const state = { from: location.pathname + location.search }
  return <article className="repo-card">
    <div className="card-topline"><span className={'rank' + (rank <= 3 ? ' rank-leading' : '')}>#{String(rank).padStart(2, '0')}</span><MetricBadge kind="hot" value={repo.radar.hotScore} /></div>
    <h3><Link to={'/repo/' + repo.id} state={state}><span className="repo-owner">{github.owner} / </span><span className="repo-name">{github.name}</span></Link></h3>
    <RepoDescription className="repo-description" text={github.description} />
    <div className="repo-stats">
      <span className="language"><span className="language-dot" style={{ background: languageColors[github.language ?? ''] ?? '#798293' }} />{github.language ?? '语言未标注'}</span>
      <span title={formatCount(github.stars) + ' Stars'}><Icon name="star" size={14} />{formatCount(github.stars)}<span className="sr-only"> Stars</span></span>
      <span title={formatCount(github.forks) + ' Forks'}><Icon name="fork" size={14} />{formatCount(github.forks)}<span className="sr-only"> Forks</span></span>
    </div>
    <div className="card-growth"><MetricBadge kind="growth" value={getGrowth(repo, range)} label={metric} />{range !== 'today' && repo.radar.growth.day !== null && <span className="daily-growth">24h {signedGrowth(repo.radar.growth.day)}</span>}</div>
    <div className="repo-tags">{repo.radar.tags.map((tag) => <span key={tag} className={tag === '值得复刻' ? 'tag tag-accent' : 'tag'}>{tag}</span>)}</div>
    <div className="card-footer"><span>{analysis ? analysis.soloDeveloperScore >= 4 ? '适合个人探索' : '适合深入研究' : '最近推送 ' + formatDate(github.pushedAt)}</span><Link to={'/repo/' + repo.id} state={state} aria-label={'查看项目 ' + github.fullName}>查看项目<Icon name="arrow" size={15} /></Link></div>
  </article>
}
