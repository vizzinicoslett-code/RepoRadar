import { useTranslation } from '../hooks/translationContext'
export function TranslationControl() {
  const { service, mode, status, progress, initialized } = useTranslation()
  const hint = status === 'unsupported' ? '当前浏览器暂不支持站内翻译'
    : status === 'downloading' ? progress === null ? '正在准备本地中文翻译…' : '正在准备翻译模型 ' + progress + '%'
    : status === 'error' ? '翻译准备失败，保留原文；点击中文重试'
    : mode === 'zh' && !initialized ? '点击中文准备本地翻译；已有缓存可直接阅读'
    : status === 'translating' ? '正在翻译可见简介…'
    : status === 'downloadable' ? '点击中文后准备本地翻译' : mode === 'zh' ? '本地中文翻译已就绪' : ''
  return <div className="translation-control"><div className="translation-switch" role="group" aria-label="简介语言"><span>简介：</span><button aria-pressed={mode === 'original'} onClick={() => service.original()}>原文</button><button aria-pressed={mode === 'zh'} onClick={() => { void service.activateChinese() }}>中文</button></div><span className="translation-hint" role="status">{hint}</span></div>
}
