import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { DataSourceStatus } from '../components/DataSourceStatus'

const phases = [
  ['Phase 1', '产品骨架', '首页、项目详情与可交互的本地 Mock 数据。'],
  ['Phase 2', 'GitHub 数据', '脚本获取公开仓库，前端读取静态 JSON，并支持 Mock 回退。'],
  ['Phase 3', '热度算法', '35 天快照、真实增长、可解释 Hot Score 与浏览器中文翻译。'],
  ['Phase 4', '历史数据', '积累快照，观察项目随时间的变化。'],
  ['Phase 5', '项目分析', '帮助理解项目价值与适合的开发切入口。'],
  ['Phase 6', '推荐系统', '根据兴趣发现值得关注的新项目。'],
]

export function About() {
  return <main id="main-content" tabIndex={-1} className="container secondary-page about-page"><div className="page-heading"><span className="eyebrow">BUILT FOR THE CURIOUS</span><h1>让好项目成为新灵感。</h1><p>RepoRadar · Discover what is rising on GitHub.</p></div><section className="about-intro"><span className="about-mark"><Icon name="radar" size={40} /></span><div><h2>发现，理解，然后动手。</h2><p>RepoRadar 关注开源项目的增长，帮助大学生、独立开发者和 AI 编程用户发现值得研究的仓库和开发灵感。</p><p>当前为 Phase 3。GitHub REST API 数据由 Node 脚本生成本站静态 JSON；浏览器只读取本站文件，不直接调用 GitHub API。候选池按真实增长与 Hot 排序，历史不足时沿用活跃窗口与 Stars。分类来自透明关键词规则。</p><p>每 6 小时记录 Stars，保留 35 天历史；缺失基准显示积累中。中文简介由浏览器本地 Translator 提供，点击后才初始化；不支持时保留原文。没有开发适合度或 AI 分析。静态数据不可用时回退到明确标注的 12 条演示数据；Mock 判断仅用于界面开发。项目没有账号或后端。</p><div className="about-source"><DataSourceStatus /></div></div></section><section className="roadmap"><h2>逐步构建 RepoRadar</h2><div className="roadmap-grid">{phases.map(([phase, title, description], index) => <article key={phase} className={index === 2 ? 'roadmap-card current' : 'roadmap-card'}><div><span>{phase}</span><span className="phase-status">{index === 2 ? '当前阶段' : index < 2 ? '已完成' : '未来计划'}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section><Link to="/" className="button button-primary">开始发现<Icon name="arrow" size={16} /></Link></main>
}
