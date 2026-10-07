import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../hooks/translationContext'
export function RepoDescription({ text, className }: { text: string | null; className?: string }) {
  const { service, mode, status, initialized } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const needed = useRef(false)
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<{ text: string; translated: string | null; failed: boolean } | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!('IntersectionObserver' in globalThis)) { needed.current = true; setVisible(true); return () => { needed.current = false } }
    const observer = new IntersectionObserver(([entry]) => { needed.current = entry.isIntersecting; setVisible(entry.isIntersecting) })
    observer.observe(node)
    return () => { needed.current = false; observer.disconnect() }
  }, [])
  useEffect(() => {
    if (!text || mode !== 'zh' || !visible) return
    const cached = service.cached(text)
    if (cached !== null) { setResult({ text, translated: cached, failed: false }); return }
    if (!initialized) return
    let active = true
    void service.translate(text, () => active && needed.current).then((translated) => {
      if (active && needed.current) setResult({ text, translated, failed: translated === null })
    })
    return () => { active = false }
  }, [text, mode, visible, initialized, service])
  const translated = mode === 'zh' && result?.text === text ? result.translated : null
  const failed = mode === 'zh' && result?.text === text && result.failed
  async function copy() {
    try { if (!text || !navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); setCopyStatus('已复制') }
    catch { setCopyStatus('复制未成功，请选择原文手动复制') }
  }
  return <div ref={ref} className={'description-block ' + (className ?? '')}><p>{translated ?? text ?? '仓库暂未提供简介。'}</p>
    {translated && <><button className="description-action" onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? '收起英文原文' : '查看英文原文'}</button>{showOriginal && <p className="description-original">{text}</p>}</>}
    {failed && <span className="description-status">这条简介翻译失败，已保留原文。</span>}
    {text && (status === 'unsupported' || failed) && <button className="description-action" onClick={() => { void copy() }}>复制英文简介</button>}
    {copyStatus && <span className="description-status" role="status">{copyStatus}</span>}
  </div>
}
