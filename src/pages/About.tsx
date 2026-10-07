import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { DataSourceStatus } from '../components/DataSourceStatus'

const phases = [
  ['Phase 1', '产品骨架', '首页、项目详情与可交互的本地 Mock 数据。'],
  ['Phase 2', 'GitHub 数据', '脚本获取公开仓库，前端读取静态 JSON，并支持 Mock 回退。'],
  ['Phase 3', '热度算法', '35 天快照、真实增长、可解释 Hot Score 与浏览器中文翻译。'],
  ['Phase 4', '判断与灵感', '透明规则 Evaluation、个人 V1 模板、本地灵感与 Codex Prompt。'],
  ['Phase 5', 'AI 理解', '未来考虑阅读文档、解释限制与个性化缩小项目；尚未实现。'],
  ['Phase 6', '推荐系统', '根据兴趣发现值得关注的新项目。'],
]

export function About() {
  return <main id="main-content" tabIndex={-1} className="container secondary-page about-page"><div className="page-heading"><span className="eyebrow">BUILT FOR THE CURIOUS</span><h1>让好项目成为新灵感。</h1><p>RepoRadar · Discover what is rising on GitHub.</p></div><section className="about-intro"><span className="about-mark"><Icon name="radar" size={40} /></span><div><h2>发现，理解，然后动手。</h2><p>RepoRadar 关注开源项目的增长，帮助大学生、独立开发者和 AI 编程用户发现值得研究的仓库和开发灵感。</p><p>当前为 Phase 4。GitHub 数据由现有 Node / Actions 管线生成本站静态 JSON；浏览器只读取本站文件。今日、本周、本月保持原 Hot / Growth 排序；「适合开发」独立按 Build 排序。</p><p>Research、Use、Remake、Solo、Codex 与 Complexity 来自透明元数据规则，不是 AI 结论，也没有读取 README 或源代码。Hot 代表热度，Build 代表个人 + Codex 开发适合度，难度越高越难。缺失增长不因历史不足扣分。</p><p>从详情页进入灵感工作区，选择个人小版本、编辑设定并生成完整 Codex Prompt。灵感只保存在浏览器 localStorage，不上传；清除浏览器数据会删除灵感。没有账号、云同步或模型 API。中文简介继续由浏览器本地 Translator 按需提供；数据不可用时保留明确标注的 Mock 回退。</p><div className="about-source"><DataSourceStatus /></div></div></section><section className="roadmap"><h2>逐步构建 RepoRadar</h2><div className="roadmap-grid">{phases.map(([phase, title, description], index) => <article key={phase} className={index === 3 ? 'roadmap-card current' : 'roadmap-card'}><div><span>{phase}</span><span className="phase-status">{index === 3 ? '当前阶段' : index < 3 ? '已完成' : '未来计划'}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section><Link to="/?mode=build" className="button button-primary">寻找下一个项目<Icon name="arrow" size={16} /></Link></main>
}
