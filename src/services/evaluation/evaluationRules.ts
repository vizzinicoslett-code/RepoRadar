import type { ProjectKind, ScoreKey } from './evaluationTypes.ts'

export const evaluationConfig = {
  version: 1,
  thresholds: { remake: 75, solo: 75, codex: 80, build: 75, research: 75, use: 75 },
  researchWeights: { hot: .35, day: .25, week: .15, activity: .15, metadata: .10 },
  growthCaps: { day: 5000, week: 25000 },
  activityDays: 30,
  buildWeights: { remake: .40, solo: .25, codex: .25, research: .10 },
  languageAdjustment: { commonCodex: 3, commonComplexity: -2, systemsCodex: -2, systemsSolo: -2, systemsComplexity: 3 },
  broadScopeAdjustment: { remake: -18, solo: -22, codex: -12, complexity: 24 },
} as const

export const scoreLabels: Record<ScoreKey, string> = {
  researchScore: '值得研究', useScore: '值得直接使用', remakeScore: '值得复刻',
  soloScore: '一个人能做', codexScore: 'Codex 适合度', complexityScore: '开发难度', buildScore: 'Build Score',
}

interface Profile { kind: ProjectKind; label: string; pattern: RegExp; use: number; remake: number; solo: number; codex: number; complexity: number; reason: string }
// First matching profile wins. Specific infrastructure/content precedes generic tools.
export const projectProfiles: readonly Profile[] = [
  { kind: 'kernel', label: '操作系统 / 内核', pattern: /\b(linux kernel|operating system|kernel|device driver)\b|操作系统|内核|驱动程序/i, use: 55, remake: 18, solo: 12, codex: 28, complexity: 96, reason: '系统级实现需要底层调试与兼容性验证，完整复刻成本很高。' },
  { kind: 'database', label: '数据库引擎', pattern: /\b(database engine|distributed database|storage engine|database server)\b|数据库引擎|分布式数据库/i, use: 66, remake: 22, solo: 18, codex: 35, complexity: 94, reason: '存储、一致性与恢复机制使完整数据库引擎难以由个人复刻。' },
  { kind: 'training', label: '大型模型训练', pattern: /\b(pretraining|pre-training|large[- ]scale training|distributed training|training framework)\b|大规模.*训练|模型训练框架/i, use: 62, remake: 20, solo: 16, codex: 35, complexity: 95, reason: '训练基础设施和算力依赖提高完整实现与验收成本。' },
  { kind: 'distributed', label: '分布式基础设施', pattern: /\b(kubernetes|distributed system|container orchestration|distributed infrastructure)\b|分布式系统|容器编排/i, use: 62, remake: 28, solo: 25, codex: 42, complexity: 89, reason: '多节点部署、故障恢复与一致性验证扩大开发范围。' },
  { kind: 'compiler', label: '编译器基础设施', pattern: /\b(compiler infrastructure|compiler toolchain|llvm|compiler framework)\b|编译器基础设施|编译器框架/i, use: 60, remake: 32, solo: 28, codex: 42, complexity: 86, reason: '完整工具链包含语言与平台兼容性，适合缩成单个分析工具。' },
  { kind: 'hardware', label: '硬件 / 设备工具', pattern: /\b(carplay|head units?|embedded|firmware|robotics|microcontroller|hardware integration)\b|嵌入式|固件|复杂硬件|车机/i, use: 64, remake: 38, solo: 32, codex: 44, complexity: 84, reason: '设备依赖与协议兼容需要真实硬件验收，不能只靠网页测试。' },
  { kind: 'model-runtime', label: '模型推理引擎', pattern: /\b(inference engine|model runtime|inference framework|tensor compiler)\b|推理引擎|推理框架/i, use: 74, remake: 42, solo: 38, codex: 50, complexity: 82, reason: '推理内核和硬件优化范围较大，个人版优先围绕现成引擎做工具。' },
  { kind: 'skills', label: '技能 / 工作流模板库', pattern: /(?:^|\s)skills(?:\s|$)|\b(agent skills|skills for|skill collection|skills collection)\b|技能模板库/i, use: 65, remake: 65, solo: 81, codex: 88, complexity: 30, reason: '可借鉴和整理技能模板；评分针对模板管理工具，不等同于复刻完整 Agent。' },
  { kind: 'content', label: '教程 / 资料库', pattern: /\b(tutorials?|courses?|awesome[- ]list|roadmaps?|examples|learning material|learning resources?|guide|guides)\b|指南|教程|资料库|学习资源/i, use: 28, remake: 61, solo: 81, codex: 80, complexity: 22, reason: '内容可供学习和阅读，但通常不是开箱即用的软件；个人版可做资料检索与记录。' },
  { kind: 'cv', label: 'Computer Vision 工具', pattern: /\b(computer[- ]vision|opencv|object[- ]detection|image[- ]segmentation|yolo|image[- ]recognition)\b|computer vision|计算机视觉|目标检测/i, use: 80, remake: 84, solo: 78, codex: 86, complexity: 56, reason: '限定一种图像输入并使用成熟算法，可形成独立的离线 V1。' },
  { kind: 'cli', label: 'CLI 工具', pattern: /\b(cli|command[- ]line|terminal tool)\b|命令行/i, use: 86, remake: 94, solo: 92, codex: 93, complexity: 30, reason: '命令、输入和输出可拆成可测试的独立工作流。' },
  { kind: 'desktop', label: '桌面小工具', pattern: /\b(desktop|tauri|electron|launcher)\b|桌面工具|桌面应用/i, use: 85, remake: 87, solo: 83, codex: 88, complexity: 48, reason: '可从单平台、单任务开始；需要额外验证打包和系统权限。' },
  { kind: 'web', label: 'Web / 数据展示工具', pattern: /\b(web[- ]app|web tool|browser tool|dashboard|crud|react|diagram|diagrams|visualization|flowchart)\b|可视化|网页工具|浏览器工具/i, use: 85, remake: 93, solo: 94, codex: 95, complexity: 28, reason: '输入、处理和展示可拆小，常规界面与状态逻辑便于个人验收。' },
  { kind: 'agent', label: 'AI Agent 应用', pattern: /\b(agents?|agentic|tool[- ]use|coding[- ]agent|browser[- ]agent)\b|智能体|工具调用/i, use: 78, remake: 86, solo: 84, codex: 90, complexity: 48, reason: '个人版可限制为一个任务、一个场景；不推断已经具备完整 Agent 能力。' },
  { kind: 'learning', label: '学习工具', pattern: /\b(flashcards?|learning tool|study tool|education)\b|学习工具|记忆卡片/i, use: 80, remake: 90, solo: 91, codex: 90, complexity: 32, reason: '限定一个学习环节与本地记录即可产生独立价值。' },
  { kind: 'automation', label: '效率 / 自动化工具', pattern: /\b(automation|productivity|workflow|clipboard|task[- ]manager|note[- ]taking)\b|效率工具|自动化/i, use: 86, remake: 91, solo: 90, codex: 92, complexity: 36, reason: '单个重复任务可形成明确的输入、处理和结果。' },
  { kind: 'library', label: 'Library / SDK', pattern: /\b(library|sdk|framework)\b|函数库|软件库/i, use: 72, remake: 70, solo: 68, codex: 82, complexity: 55, reason: '需要集成代码才能使用；完整兼容接口可能超出个人 V1 范围。' },
  { kind: 'app', label: 'App / Client', pattern: /\b(app|application|client|editor|android|ios)\b|应用|客户端/i, use: 86, remake: 89, solo: 87, codex: 92, complexity: 38, reason: '可以先保留一个核心场景，推迟账号、协作和云同步。' },
]
export const unknownProfile: Omit<Profile, 'pattern'> = { kind: 'unknown', label: '信息不足 / 通用项目', use: 45, remake: 52, solo: 55, codex: 58, complexity: 55, reason: '仅凭当前元数据无法确认核心工作流，需要先阅读文档。' }
export const broadScopePattern = /\b(framework|platform|ecosystem|multi[- ]agent|distributed|all[- ]in[- ]one)\b|平台|多智能体|全功能/i
export const developmentFilters = ['值得复刻', '一个人能做', '适合 Codex'] as const
export type DevelopmentFilter = (typeof developmentFilters)[number]
