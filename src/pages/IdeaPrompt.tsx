import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useIdeas } from '../hooks/useIdeas'
import { generateCodexPrompt } from '../services/ideas/promptGenerator'
import { EmptyState } from '../components/EmptyState'
export function IdeaPrompt() {
  const { id } = useParams(), { ideas, warning } = useIdeas(), [copyStatus, setCopyStatus] = useState('')
  const text = useRef<HTMLPreElement>(null), idea = ideas.find((item) => item.id === id)
  const prompt = idea ? generateCodexPrompt(idea) : ''
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(prompt); setCopyStatus('Prompt 已复制')
    } catch {
      if (text.current) { const range = document.createRange(); range.selectNodeContents(text.current); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range) }
      setCopyStatus('复制未成功，已选中完整 Prompt；请手动复制。')
    }
  }
  return <main id="main-content" tabIndex={-1} className="container secondary-page prompt-page">{!idea ? <><EmptyState title="没有找到已保存的灵感" description="先在工作区保存项目设定，再生成开发方案。" /><Link to="/ideas" className="button button-primary">我的灵感</Link></> : <><Link className="back-link" to={'/idea/' + idea.id}>← 继续编辑</Link><div className="page-heading"><span className="eyebrow">CODEX DEVELOPMENT PLAN</span><h1>{idea.title}</h1><p>根据你的项目设定自动整理 · 不调用 AI</p></div>{warning && <p className="storage-notice" role="status">{warning}</p>}<div className="prompt-toolbar"><button className="button button-primary" onClick={() => { void copy() }}>复制 Prompt</button><Link className="text-link" to="/ideas">我的灵感 →</Link><span role="status">{copyStatus}</span></div><pre className="codex-prompt" ref={text} tabIndex={0}>{prompt}</pre></>}</main>
}
