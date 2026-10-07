import { ideaStatuses } from './ideaTypes.ts'
import type { IdeaDraft, ProjectIdea } from './ideaTypes.ts'

export const IDEAS_KEY = 'repoRadar.ideas.v1'
export interface IdeaStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface IdeaState { ideas: readonly ProjectIdea[]; warning: string | null; persistent: boolean }
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const validText = (value: unknown, max: number, required = true): value is string => typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()))
const validList = (value: unknown, required = true): value is string[] => Array.isArray(value) && value.length <= 50 && (!required || value.length > 0) && value.every((entry) => validText(entry, 500))
const routeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value)
export function validDraft(value: unknown): value is IdeaDraft {
  return isRecord(value) && routeId(value.sourceRepoId) && typeof value.sourceFullName === 'string' && /^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(value.sourceFullName)
    && validText(value.title, 120) && validText(value.targetUser, 500) && validText(value.problem, 4000)
    && validList(value.features) && validList(value.excludedFeatures, false) && validList(value.techStack)
    && validText(value.notes, 8000, false) && (ideaStatuses as readonly unknown[]).includes(value.status)
}
function validIdea(value: unknown): value is ProjectIdea {
  return validDraft(value) && isRecord(value) && routeId(value.id) && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string'
    && Number.isFinite(Date.parse(value.createdAt)) && Number.isFinite(Date.parse(value.updatedAt)) && Date.parse(value.updatedAt) >= Date.parse(value.createdAt)
}
function cleanDraft(draft: IdeaDraft): IdeaDraft {
  return { sourceRepoId: draft.sourceRepoId, sourceFullName: draft.sourceFullName, title: draft.title.trim(), targetUser: draft.targetUser.trim(), problem: draft.problem.trim(), features: draft.features.map((item) => item.trim()), excludedFeatures: draft.excludedFeatures.map((item) => item.trim()), techStack: draft.techStack.map((item) => item.trim()), notes: draft.notes.trim(), status: draft.status }
}
function browserStorage(): IdeaStorage | null { try { return globalThis.localStorage ?? null } catch { return null } }
export class IdeaStore {
  private storage: IdeaStorage | null
  private clock: () => string
  private id: () => string
  private listeners = new Set<() => void>()
  private state: IdeaState = { ideas: [], warning: null, persistent: true }
  constructor(storage: IdeaStorage | null = browserStorage(), clock: () => string = () => new Date().toISOString(), id: () => string = () => 'idea-' + globalThis.crypto.randomUUID()) {
    this.storage = storage; this.clock = clock; this.id = id; this.refresh()
  }
  getSnapshot = (): IdeaState => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(state: IdeaState) { this.state = state; this.listeners.forEach((listener) => listener()) }
  refresh() {
    if (!this.storage) { this.publish({ ...this.state, persistent: false, warning: '浏览器本地存储不可用，灵感只保留在当前页面内存；刷新会丢失。' }); return }
    try {
      const raw = this.storage.getItem(IDEAS_KEY)
      if (!raw) { this.publish({ ideas: [], persistent: true, warning: null }); return }
      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.ideas) || parsed.ideas.length > 200) throw new Error('Invalid local ideas')
      const ids = new Set<string>(), ideas: ProjectIdea[] = []
      for (const item of parsed.ideas) if (validIdea(item) && !ids.has(item.id)) {
        ids.add(item.id); ideas.push({ ...cleanDraft(item), id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt })
      }
      this.publish({ ideas, persistent: true, warning: ideas.length === parsed.ideas.length ? null : '部分本地灵感数据损坏；已保留可读取的条目，请核对后保存。' })
    } catch { this.publish({ ...this.state, warning: '无法读取本地灵感存档，当前页面仍可创建和编辑；保存会写入新的有效存档。' }) }
  }
  private persist(ideas: ProjectIdea[]) {
    let persistent = Boolean(this.storage), warning: string | null = null
    try { if (!this.storage) throw new Error('Storage unavailable'); this.storage.setItem(IDEAS_KEY, JSON.stringify({ version: 1, ideas })) }
    catch { persistent = false; warning = '本地保存失败（可能禁用存储或空间不足）；更改仅保留在当前页面内存，刷新会丢失。' }
    this.publish({ ideas, persistent, warning })
  }
  save(draft: IdeaDraft, id?: string): ProjectIdea {
    if (!validDraft(draft)) throw new Error('请填写项目名称、目标用户、问题、至少一项 V1 功能和技术栈；每行一项，最多 50 项。')
    const existing = id ? this.state.ideas.find((idea) => idea.id === id) : undefined
    if (id && !existing) throw new Error('这条灵感已被删除，请返回我的灵感。')
    if (!existing && this.state.ideas.length >= 200) throw new Error('最多保存 200 条灵感，请先整理已有项目。')
    const now = this.clock(), nextId = existing?.id ?? this.id()
    if (!routeId(nextId) || (!existing && this.state.ideas.some((idea) => idea.id === nextId))) throw new Error('无法生成新的灵感 ID，请重试。')
    const idea = { ...cleanDraft(draft), id: nextId, createdAt: existing?.createdAt ?? now, updatedAt: now }
    if (!validIdea(idea)) throw new Error('无法保存灵感，请检查设备时间与表单内容。')
    this.persist(existing ? this.state.ideas.map((item) => item.id === id ? idea : item) : [...this.state.ideas, idea])
    return idea
  }
  delete(id: string) { this.persist(this.state.ideas.filter((idea) => idea.id !== id)) }
}
export const ideaStore = new IdeaStore()
