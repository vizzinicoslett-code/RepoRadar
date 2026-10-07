# RepoRadar

Discover what is rising on GitHub.

当前完成 **Phase 3：Star 历史快照、真实增长、Hot Score 与中文简介**。沿用 Phase 2 的 React + TypeScript + Vite、HashRouter、浅色卡片布局、响应式样式、GitHub 数据抓取、12 条 Mock fallback 与全部原有测试。

前端没有新增运行依赖、服务器、数据库或账号。浏览器只读取本站静态 JSON；GitHub API 请求在 Node 脚本或 Actions 中运行。候选池不是 GitHub Trending，也不代表全部 GitHub 仓库。

## Live Site

尚未发布。完成首次 Pages 部署并验证后，在这里填写 GitHub 返回的实际站点链接。

## Automatic Updates

GitHub Actions 按 `17 */6 * * *`（UTC）计划约每 6 小时运行一次：获取 GitHub 仓库 → 保存 Stars 快照 → 计算 Growth 与 Hot Score → 校验数据 → commit 两份数据 JSON → 构建并部署 GitHub Pages。Scheduled Actions 可能延迟，不保证准点运行；增长指标使用实际观测时间与既有容差。

部署成功后，正常使用无需人工刷新，也无需启动本地开发服务器。本地 `data:refresh` 只用于开发和测试。首次部署尚未完成时，此自动更新服务尚未启用。

## Local Development

```bash
npm install
npm run data:refresh
npm run dev
```

### 开发与命令

前端工具链要求 Node 22.13+，推荐 Node 24；数据脚本使用原生 fetch，较旧版本的代理后备要求 Node 20.18.1+。

```bash
npm install
npm run dev
npm run data:fetch      # 仅抓取并原子写 repos.json，不记录历史、不计算指标
npm run data:snapshot   # 对已抓取数据记录快照，并同步重算指标，保持两文件一致
npm run data:derive     # 不抓取、不增加快照，按已有历史重新计算指标
npm run data:refresh    # 推荐：抓取 → 快照 → 派生 → 校验 → 成对提交本地文件
npm run data:validate   # 离线校验两份文件及指标的一致性
npm run build
npm run lint
npm test
npm run security:check
npm run preview
```

不要同时运行多个数据命令。单独 data:fetch 的输出仍可展示，增长保持缺失；之后运行 data:snapshot 或 data:refresh 再通过联合校验。首次打开即可读取已提交的静态文件，无需 Token。数据不可用时明确显示“当前显示演示数据”；可以用非敏感的 VITE_REPO_SOURCE=mock 显式开发 Mock UI。

## Data Pipeline

```text
GitHub REST Search API
→ collectRepositories（仅内存）
→ captureSnapshots（仅内存）
→ deriveMetrics（仅内存）
→ 校验仓库、历史、指标的一致性
→ 带恢复日志的两文件更新
→ public/data/repos.json + public/data/star-history.json
→ GithubStaticRepoSource → RepoProvider → React
```

搜索策略保留 Phase 2：6 类查询，每类一页最多 20 条，串行间隔 2.1 秒。近期创建（30d、Stars≥50）、近期活跃（7d、Stars≥500）、AI Agent、developer-tools、computer-vision、education（后三个 Topics 与 Agent 均为 30d 活跃、Stars≥100）。限定公开、非归档、非 Fork，按查询组轮流选入、GitHub ID 去重，池大小 50–100。没有单仓库详情请求、README 抓取或 Trending 爬虫。

保留 API 版本 2022-11-28、Accept、User-Agent、20 秒超时、响应完整性与限流校验。403/429 或 remaining≤1 停止，不自动重试；空池、坏 JSON、非法字段或历史损坏均以非零退出。

data:refresh 在所有步骤成功之前不替换任何文件。替换失败会恢复两份旧文件；repos.json.journal 保存之前的字节内容，进程中断后下一次管线运行先恢复。repos.json.lock 排除同时运行的管线；失效进程锁可自动回收，非法锁需要检查。暂存文件使用独立随机名称，中断遗留的 .tmp 永远不会自动成为有效数据。锁、日志和暂存文件忽略提交。正常异常会清理临时文件。数据操作只涉及明确的数据文件。

## 数据结构

repos.json 继续使用 version=1、source=github、generatedAt、repoCount、queries、repositories；额外添加以 GitHub 数字 ID 为键的 metrics。旧 Phase 2 文件仍可读，缺少 metrics 时保留 null。

GitHub 原始字段与 RepoRadar 派生字段分离。ID 路由仍为 github-<ID>，改名不会改变身份。原始数据只保留白名单字段；language、topics、license、日期、简介等缺失时保留 null。metrics 包含：

- growth.day/week/month：delta、rate、baselineCapturedAt、baselineStars、actualWindowHours；没有基准时整个项为 null。
- hotScore：0–100 整数或 null。
- hotComponents：各个 0–1 分项，缺失分项为 null。
- snapshots：当前仓库已观测的历史点，供静态详情趋势使用。

校验会从快照重新计算增长，再用完整候选池重新计算 Hot，拒绝不一致指标。analysis 始终为 null；Mock 仍是明确标记的旧演示内容。

## Star History

文件：public/data/star-history.json。

```json
{
  "version": 1,
  "updatedAt": "2026-10-05T10:27:41.996Z",
  "retentionDays": 35,
  "repositories": {
    "123456": {
      "fullName": "owner/repo",
      "snapshots": [
        { "capturedAt": "2026-10-05T10:27:41.996Z", "stars": 1234 }
      ]
    }
  }
}
```

真正的唯一键为 githubId。每 6 小时抓取一次，捕获时间采用本轮数据 generatedAt。距该 ID 上个快照不足 3 小时则跳过；恰好 3 小时允许增加。ID 去重，不按名称区分；改名更新 fullName，保留旧观察值。

每轮删除早于 now−35d 的点，恰好 35d 的点保留。当前候选池外的仓库，只要仍有有效观察值就继续保留。没有当前 Stars 的响应不能生成快照。

只记录实际观测值，不按当前 Stars 倒推、不随机补历史。Phase 3 首次刷新只建立第一份真实快照，没有把 Phase 2 文件或 fixture 回填为历史。

## Growth

| 周期 | 目标基准 | 最大容差 |
| --- | --- | --- |
| 24h | now−24h | ±8h |
| 7d | now−168h | ±18h |
| 30d | now−720h | ±36h |

选择容差内距目标最近的过去快照；相同距离选较早的一条。不能把当前快照当作过去基准。delta=currentStars−baselineStars；rate=delta/baselineStars（比例，显示时乘 100）。baselineStars=0 时 rate=null，绝对增长仍有效。负增长保留，不钳制为 0；缺失基准为 null，不冒充 +0。actualWindowHours=(now−baselineCapturedAt)/3600000，没有按实际窗口外推标准化增量。

## Hot Score

当前候选池内计算；总 Stars 不直接参加打分：

```text
D = log1p(max(growth24h, 0))
R = max(growthRate24h, 0)
W = log1p(max(growth7d, 0))
A = max(0, 1 − ageDays(pushedAt)/30)

Hot = round(100 × Σ(w_i × component_i) / Σ(available w_i))
components = { P(D), P(R), P(W), A }
weights    = {  0.45, 0.25, 0.20, 0.10 }
```

pushedAt 缺失或晚于 generatedAt 时 A=null。每一项的 percentile 样本只包含具有该项数据的仓库（包括增长为零或负值的仓库）。v≤0 时 P(v)=0；只有一个有效样本且 v>0 时 P(v)=1；否则：

```text
P(v) = (小于 v 的样本数 + (等于 v 的样本数 − 1)/2) / (样本数 − 1)
```

这是并列值的平均名次，范围 0–1。log1p 为单调变换，因此在 percentile 排序中不改变次序；公式明确使用它，不声称产生额外排序能力。

缺少 7d 或增长率时去掉该项，并将余下权重重新归一化。24h 增长都没有时 Hot=null，即使 pushedAt 已知也不能打分。样本池变化会影响相对排名；分数是透明的相对指标，不是跨日期可直接比较的项目质量评分。

固定 fixture（非线上增长）：三项 pushedAt 均为 now，另有一个无历史项目，它不参与增长 percentile。

| 项目 | 24h 基准→当前 | 24h 增长率 | 7d 增量 | Hot |
| --- | --- | --- | --- | --- |
| A 大仓库小增长 | 100000→100010（+10） | +0.01% | +50 | 10 |
| B 小仓库爆发 | 100→500（+400） | +400% | +450 | 68 |
| C 高绝对增长 | 100000→101000（+1000） | +1% | +5000 | 88 |
| D 无历史 | —→99 | — | — | — |

例如 B 的分项为 0.5、1、0.5、1，Hot=round(100×0.675)=68。只有 24h、无 7d/活跃度的单一正增长 fixture，分母为 0.70（有零基准时为 0.45），无需因此扣分。

分级：≥90 爆发、≥75 很热、≥55 上升、其余普通。

## 首页与详情

今日：已知增长的仓库按 Hot 降序、24h 增量降序；本周/本月按对应增量降序、Hot 降序。最终以 ID 稳定排序。已知增长组优先，包含负增长且不要求最近 push；未知增长组沿用 Phase 2：按 1/7/30d 活跃窗口过滤，Stars 降序、活跃日期降序、ID。活跃时间优先 pushedAt，然后 updatedAt/createdAt，窗口相对于 JSON generatedAt。

搜索与分类继续叠加，匹配名称、owner、简介、语言、Topics 与规则标签。Hot 的候选池为完整文件，不因前端筛选改变。分类由 deriveRepoTags 的透明关键词规则产生；真实数据不提供“值得复刻”“一个人能做”的主观筛选。

卡片保留 Stars、Forks、实际增长和 Hot；负增长使用下降箭头，缺失显示“24h/7d/30d 数据积累中”与“Hot —”。详情增加三个周期、增长率、基准 Stars、基准日期、实际窗口；有至少两个点时用原生 SVG 画时间轴快照折线，无图表依赖。

仓库信息、Topics、License、Issues（含 PR）、安全 Homepage、GitHub 外链与缺失值说明保留。真实项目的分析、复刻方案依然显示待后续阶段提供；Mock 的原有编辑示例不变。

## Translation

使用浏览器内置 globalThis.Translator，先检查功能和 en→zh 可用性。没有 API Key，也没有第三方翻译接口。模型由浏览器按需准备；RepoRadar 不上传简介到自己的服务器或外部翻译服务。浏览器可能下载语言包，翻译在本机执行。

只翻 Repository description 和明确由 description 提供的概览短介绍；不翻 owner、项目名称、language、Topics、README 或 Mock 的分析文本。只把原始简介交给 Translator，没有自行替换技术术语。

筛选区和详情提供“简介：原文 / 中文”。第一次显式点击中文，调用 create({sourceLanguage:'en',targetLanguage:'zh'})，在任何 await 之前发起，保留用户激活。页面挂载只检测 availability，不创建、不下载模型。恢复中文偏好时只显示已有缓存；未缓存内容保持英文，需再次点击中文才能初始化。

处理 unsupported、downloadable、downloading、ready、translating、error；支持 monitor 时显示 loaded×100 的进度。下载或模型创建失败显示重试提示，保留原文。单条翻译失败只影响该简介，其他任务继续；已翻译文本可“查看英文原文”。

只有 IntersectionObserver 判断可见的简介才入队，执行前再次检查是否仍需要。队列串行，重复原文共享进行中的任务；详情头部和概览共享结果。快速切回原文会跳过未开始的任务。已开始的本地翻译可完成并写缓存，不阻塞导航。

偏好：localStorage 的 repoRadar.translationMode，original/zh。
缓存：repoRadar.translationCache.v1。键为 en:zh:<文本 FNV-1a hash>；还检查完整原文，避免 hash 碰撞读错内容。保存 originalText、translatedText、createdAt、lastUsedAt，最多 500 条，按最近使用时间淘汰；文本变化自动产生新键。JSON 损坏、存储禁用或空间不足时退为内存缓存，不抛页面异常。

不支持 API 或 en→zh 时强制 original，显示“当前浏览器暂不支持站内翻译”和“复制英文简介”；剪贴板拒绝或不可用会提示手动复制。不偷接外部翻译 API。实际支持范围由浏览器检测决定；Chrome 官方说明当前桌面支持，手机不支持。[官方 Translator API 文档](https://developer.chrome.com/docs/ai/translator-api)。

服务抽象在 src/services/translation/：chromeTranslator.ts（最小本地 API 类型与适配）、translationCache.ts、translator.ts。没有增加运行时依赖。

## GitHub Token 与安全

Token 可选，只从 Node 的 GITHUB_TOKEN 环境变量读取。不要写入 React、public、dist、VITE_ 变量或文档。Actions 的 github.token 只注入 data:refresh，不注入构建。security:check 延用 Phase 2，扫描 src/public/dist/README 与实际凭证值，失败日志不打印凭证。

### 本地 GitHub 网络代理

本地 Node 数据脚本支持代理环境变量和 Windows 系统代理，由统一 GitHub HTTP client 处理。代理配置与凭证不写入源码；GitHub Actions / CI 没有显式代理环境变量时直接连接。

## GitHub Pages / 历史持久化

保持一个 .github/workflows/pages.yml。只支持 workflow_dispatch 与 schedule（17 */6 * * *，UTC；北京时间 02:17、08:17、14:17、20:17），没有 push 触发器。

```text
checkout 默认分支最新提交 → npm ci
→ data:refresh → data:validate
→ 检查刷新只改动两份数据 JSON
→ git add 仅 repos.json / star-history.json
→ 有差异才以 github-actions[bot] commit
→ push 默认分支成功
→ lint → test → build → security:check → upload → deploy
```

提交消息固定为 chore(data): update repository snapshots [skip ci]。下一次 checkout 读取上一轮已经推送的 star-history.json，而不是空的临时 runner 目录。没有变化则不产生空 commit；push 失败会明确报“Star history was NOT persisted remotely”，停止部署，要求检查 Actions 写权限与分支保护。不会强推或绕过保护，拒绝并发更新时也明确失败。

工作流顶层 contents:read；build 仅 contents:write 与 pages:read（读取 Pages 配置），deploy 仅 pages:write 和 id-token:write。并发组 pages 且 cancel-in-progress:false，避免工作流相互覆盖历史。

已实际检查触发器中没有 push，因此 bot 数据提交不会递归启动此工作流；[skip ci] 是附加标记。以后若添加 push 触发器，应同时设计 paths-ignore 或 actor 条件，并重新审查循环。当前只编写配置，没有执行远程 workflow、推送或部署；仓库仍须上传并在 Pages 选择 GitHub Actions，默认分支允许 bot 写入。

Vite base:'./'、BASE_URL 相对静态文件地址和 HashRouter 保留；支持根路径与 /RepoRadar/，详情刷新无需服务器路由。

## 文件结构

```text
shared/github-data.mjs + .d.mts     # 映射、分类、扩展数据校验
shared/star-history.mjs + .d.mts    # 历史、增长、Hot 与指标校验
scripts/fetch-github-repos.mjs       # 沿用 bounded GitHub fetch
scripts/data-pipeline.mjs            # 刷新事务、日志恢复、快照、派生
scripts/validate-data.mjs
scripts/check-client-secrets.mjs
public/data/repos.json
public/data/star-history.json
src/types/repo.ts
src/services/repoAdapters.ts / repoSource.ts
src/services/translation/
src/hooks/translationContext.ts
src/components/TranslationProvider.tsx / TranslationControl.tsx
src/components/RepoDescription.tsx / GrowthTrend.tsx
tests/catalog.test.ts / github-data.test.mjs / source.test.ts
tests/star-history.test.mjs / translation.test.ts
.github/workflows/pages.yml
```

## Phase 3 验证记录

npm install 成功，0 vulnerabilities，没有新增运行依赖。真实 data:refresh 成功获取 100 个仓库，generatedAt=2026-10-05T10:27:41.996Z（北京时间 18:27:41）。首次 100 个历史各一份快照；24h/7d/30d 有效基准数量均为 0，Hot 全为 null。fixture 不会写入真实数据。

自动测试不请求 GitHub、不下载 Translator 模型；保留原 33 项，当前共 63 项全部通过，新增历史、增长、分数、混合排序、事务和翻译用例。data:validate、build、lint 与 security:check 全部通过；凭证扫描覆盖 45 个文件。

Chrome 154 原生 API 实测 en→zh：首次 downloadable，约 15 秒完成准备并实际生成三条译文；另一次新会话模型创建返回 NotSupportedError，再次点击中文后成功，原文与缓存始终可读。原文切换、中文恢复、刷新偏好、详情与返回缓存均验证。以下为固定测试文本的原生译文，不是 mock API 输出：

| 英文测试输入 | Chrome 原生译文 |
| --- | --- |
| A fast command-line benchmarking tool. | 一个快速的命令行基准测试工具。 |
| An AI agent for browser automation. | 用于浏览器自动化的 AI 代理。 |
| An open-source library for computer vision. | 用于计算机视觉的开源库。 |

另有 mock API 的确定性浏览器检查：模型进度、逐条失败、复制拒绝、缓存命中、文本变更、单队列、可见内容按需翻译（首屏仅 2/100），以及没有 API 的 320–1440px × 首页/详情/收藏/关于，共 24 组无横向溢出。坏数据/404/离线回退保留 Mock 分析，子路径 HashRouter 刷新通过。浏览器运行异常为 0，无外部页面请求。Chrome 的语言包下载由浏览器自身处理，未被计为网页请求。截图、原生记录和浏览器报告在忽略提交的 artifacts/。

## 范围与后续

Phase 1、2、3 已完成。尚未实现 AI 项目总结、AI 复刻建议、个性化推荐、真实收藏、登录、后端或数据库。Phase 4 可以在积累真实历史后完善趋势观察与统计窗口筛选。本次到 Phase 3 停止。

参考：[GitHub Search API](https://docs.github.com/en/rest/search/search#search-repositories)、[REST 限流](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)、[Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule)、[Translator API](https://developer.chrome.com/docs/ai/translator-api)、[Vite 静态部署](https://vite.dev/guide/static-deploy.html)。
