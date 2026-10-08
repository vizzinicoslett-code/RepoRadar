import { useEffect, useId, useRef, useState } from 'react'
import type { Repo } from '../types/repo'
import type { ProjectEvaluation } from '../services/evaluation/evaluationTypes'
import { buildChatGptResearchPrompt } from '../services/share/chatGptPrompt'
import { copyChatGptPrompt } from '../services/share/clipboard'
import '../styles/chatgpt-share.css'

export function ChatGptShare({ repo, evaluation }: { repo: Repo; evaluation: ProjectEvaluation | null }) {
  const prompt = buildChatGptResearchPrompt(repo, evaluation)
  const [copied, setCopied] = useState(false), [copying, setCopying] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false), [message, setMessage] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), active = useRef(true)
  const titleId = useId(), descriptionId = useId()
  useEffect(() => {
    active.current = true
    return () => { active.current = false; clearTimeout(timer.current) }
  }, [])
  function preview() {
    setPreviewOpen(true)
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
    content.current?.focus(); content.current?.select()
  }
  async function copy() {
    if (copying) return
    clearTimeout(timer.current); setCopied(false); setCopying(true)
    const result = await copyChatGptPrompt(prompt)
    if (!active.current) return
    setCopying(false)
    if (result === 'copied') {
      setCopied(true); setMessage('已复制，可以直接粘贴到 ChatGPT')
      timer.current = setTimeout(() => { setCopied(false); setMessage('') }, 1800)
    } else {
      setMessage('复制未成功，已选中完整内容；请手动复制，或再次复制。')
      preview()
    }
  }
  return <div className="chatgpt-share">
    <button type="button" className="button chatgpt-copy-button" disabled={copying} onClick={() => { void copy() }}>{copying ? '正在复制…' : copied ? '已复制' : '复制给 ChatGPT'}</button>
    <button type="button" className="chatgpt-preview-button" onClick={preview}>查看内容</button>
    <span className="chatgpt-copy-status" role="status">{!previewOpen && message}</span>
    <dialog className="chatgpt-prompt-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => setPreviewOpen(false)}>
      <div className="chatgpt-dialog-heading"><h2 id={titleId}>复制给 ChatGPT</h2><button type="button" className="chatgpt-close-button" onClick={() => dialog.current?.close()}>关闭</button></div>
      <p id={descriptionId}>研究真实 GitHub 项目。查看或复制后，由你自行粘贴到 ChatGPT；不会自动发送。</p>
      <textarea ref={content} aria-label="给 ChatGPT 的完整研究 Prompt" value={prompt} readOnly spellCheck={false} />
      <div className="chatgpt-dialog-footer"><button type="button" className="button button-primary" disabled={copying} onClick={() => { void copy() }}>{copying ? '正在复制…' : copied ? '已复制' : '再次复制'}</button><span role="status">{message || '文本框支持 Ctrl+A 全选和手动复制。'}</span></div>
    </dialog>
  </div>
}
