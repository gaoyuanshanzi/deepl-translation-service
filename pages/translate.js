import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Translate.module.css'

const LANGUAGES = [
  { code: 'EN', label: 'English',  flag: '🇺🇸', deeplCode: 'EN' },
  { code: 'KO', label: '한국어',   flag: '🇰🇷', deeplCode: 'KO' },
  { code: 'ZH', label: '中文',     flag: '🇨🇳', deeplCode: 'ZH' },
  { code: 'JA', label: '日本語',   flag: '🇯🇵', deeplCode: 'JA' },
]

const CHUNK_SIZE = 2000 // characters per chunk

function chunkText(text, size = CHUNK_SIZE) {
  const chunks = []
  // 단락 단위로 분할 우선
  const paragraphs = text.split(/\n\n+/)
  let current = ''
  for (const para of paragraphs) {
    if ((current + para).length > size && current.length > 0) {
      chunks.push(current.trim())
      current = para
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  // 청크가 없으면 강제 분할
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size))
    }
  }
  return chunks
}

export default function TranslatePage() {
  const router = useRouter()
  const fileInputRef = useRef(null)

  // Session
  const [apiKey, setApiKey] = useState('')

  // Translation Source Type
  const [sourceType, setSourceType] = useState('file') // 'file' | 'text'

  // File
  const [file, setFile]           = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [fileType, setFileType]   = useState('') // 'txt' | 'html'
  const [isDragging, setIsDragging] = useState(false)

  // Direct Text Input
  const [manualText, setManualText] = useState('')

  // Language
  const [detectedLang, setDetectedLang] = useState(null) // detected from DeepL
  const [targetLang, setTargetLang]     = useState(null)

  // Translation
  const [progress, setProgress]         = useState(0)
  const [progressStatus, setProgressStatus] = useState('')
  const [isTranslating, setIsTranslating]   = useState(false)
  const [translatedText, setTranslatedText] = useState('')
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  // Download format choice
  const [downloadFmt, setDownloadFmt] = useState('html') // 'html' | 'txt'

  useEffect(() => {
    const session = localStorage.getItem('deepl_session')
    if (!session) { router.replace('/'); return }
    const parsed = JSON.parse(session)
    if (!parsed.authenticated || !parsed.apiKey) { router.replace('/'); return }
    setApiKey(parsed.apiKey)
  }, [router])

  // Direct Text language detection (Debounced)
  useEffect(() => {
    if (sourceType !== 'text' || !manualText.trim()) return
    const delayDebounce = setTimeout(() => {
      detectLanguage(manualText, 'txt')
    }, 1000)
    return () => clearTimeout(delayDebounce)
  }, [manualText, sourceType])

  // ── File handling ──────────────────────────────────────────
  const readFile = (f) => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['txt', 'html', 'htm'].includes(ext)) {
      setError('TXT 또는 HTML 파일만 업로드할 수 있습니다.')
      return
    }
    setError('')
    setSuccess('')
    setTranslatedText('')
    setDetectedLang(null)
    setProgress(0)
    setFileType(ext === 'htm' ? 'html' : ext)
    setFile(f)
    setSourceType('file')

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      setFileContent(content)
      detectLanguage(content, ext)
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleFileInput = (e) => {
    if (e.target.files[0]) readFile(e.target.files[0])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0])
  }

  // ── Copy Manual Text ───────────────────────────────────────
  const handleCopyManualText = () => {
    if (!manualText.trim()) return
    navigator.clipboard.writeText(manualText)
      .then(() => {
        setSuccess('입력한 텍스트가 클립보드에 복사되었습니다.')
        setTimeout(() => setSuccess(''), 3000)
      })
      .catch(() => {
        setError('텍스트 복사에 실패했습니다.')
      })
  }

  // ── Language detection via DeepL ───────────────────────────
  const detectLanguage = async (content, ext) => {
    try {
      // HTML 파일은 텍스트 추출
      const textSample = ext === 'html' || ext === 'htm'
        ? stripHtml(content).slice(0, 500)
        : content.slice(0, 500)

      if (!textSample.trim()) return

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detect',
          text: textSample,
          apiKey,
        }),
      })
      const data = await res.json()
      if (data.detectedLang) {
        const normalized = normalizeDeeplLang(data.detectedLang)
        setDetectedLang(normalized)
      }
    } catch (_) {
      // 감지 실패 시 무시 (수동 선택 가능)
    }
  }

  // ── Translation ────────────────────────────────────────────
  const handleTranslate = async () => {
    setError('')
    setSuccess('')

    const sourceContent = sourceType === 'file' ? fileContent : manualText
    if (sourceType === 'file' && (!file || !fileContent)) { 
      setError('먼저 파일을 업로드해주세요.'); 
      return 
    }
    if (sourceType === 'text' && !manualText.trim()) {
      setError('번역할 텍스트를 입력해주세요.');
      return
    }
    if (!targetLang) { setError('번역할 언어를 선택해주세요.'); return }

    if (detectedLang && detectedLang === targetLang) {
      setError(`⚠️ 원본 언어(${getLangLabel(detectedLang)})와 번역 언어가 동일합니다. 다른 언어를 선택해주세요.`)
      return
    }

    setIsTranslating(true)
    setProgress(0)
    setTranslatedText('')

    try {
      // HTML이면 텍스트 추출, TXT면 그대로
      const isHtml = sourceType === 'file' && fileType === 'html'
      const plainText = isHtml ? stripHtml(sourceContent) : sourceContent

      const chunks = chunkText(plainText)
      const total = chunks.length
      const results = []

      setProgressStatus(`총 ${total}개 블록 번역 중...`)

      for (let i = 0; i < total; i++) {
        setProgressStatus(`블록 ${i + 1} / ${total} 번역 중...`)

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'translate',
            text: chunks[i],
            targetLang: LANGUAGES.find(l => l.code === targetLang)?.deeplCode,
            sourceLang: detectedLang
              ? LANGUAGES.find(l => l.code === detectedLang)?.deeplCode
              : undefined,
            apiKey,
          }),
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.message || `번역 오류 (블록 ${i + 1})`)
        }

        const data = await res.json()
        results.push(data.translatedText)

        // 진행률 업데이트 (5%에서 시작, 100%로 끝)
        const pct = Math.round(5 + ((i + 1) / total) * 95)
        setProgress(pct)
      }

      const fullTranslation = results.join('\n\n')
      setTranslatedText(fullTranslation)
      setProgress(100)
      setProgressStatus('번역 완료!')
      setSuccess('✅ 번역이 완료되었습니다. 아래에서 다운로드하세요.')
    } catch (err) {
      setError(`번역 실패: ${err.message}`)
      setProgress(0)
      setProgressStatus('')
    } finally {
      setIsTranslating(false)
    }
  }

  // ── Download ───────────────────────────────────────────────
  const handleDownload = () => {
    if (!translatedText) return
    const langLabel = getLangLabel(targetLang)
    const baseName = sourceType === 'file' ? file.name.replace(/\.[^.]+$/, '') : 'manual_translation'

    let content, mimeType, ext

    if (downloadFmt === 'html') {
      content = buildHtmlOutput(translatedText, langLabel, sourceType === 'file' ? file.name : '수동 입력 텍스트', detectedLang, targetLang)
      mimeType = 'text/html;charset=utf-8'
      ext = 'html'
    } else {
      content = translatedText
      mimeType = 'text/plain;charset=utf-8'
      ext = 'txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${baseName}_${langLabel}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => {
    localStorage.removeItem('deepl_session')
    router.push('/')
  }

  const getLangLabel = (code) =>
    LANGUAGES.find(l => l.code === code)?.label || code

  const getLangFlag = (code) =>
    LANGUAGES.find(l => l.code === code)?.flag || ''

  return (
    <>
      <Head>
        <title>TransLingo — 문서 번역</title>
        <meta name="description" content="DeepL API 기반 TXT/HTML 다국어 번역 서비스" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerBrand}>
              <div className={styles.headerLogo}>
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <path d="M4 8h24M4 16h16M4 24h20" stroke="url(#hg)" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M22 20l4 4-4 4" stroke="url(#hg2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="hg" x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#63b3ed"/><stop offset="1" stopColor="#7f5af0"/>
                    </linearGradient>
                    <linearGradient id="hg2" x1="22" y1="20" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#38ef7d"/><stop offset="1" stopColor="#11998e"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className={styles.headerTitle}>TransLingo</span>
            </div>
            <button
              className={`btn btn-secondary ${styles.logoutBtn}`}
              onClick={handleLogout}
              id="logout-btn"
            >
              🚪 로그아웃
            </button>
          </div>
        </header>

        <main className={styles.main}>
          {/* ── Translation Source Selection ── */}
          <div className={styles.sourceToggle}>
            <button
              className={`${styles.sourceBtn} ${sourceType === 'file' ? styles.sourceActive : ''}`}
              onClick={() => {
                setSourceType('file')
                setDetectedLang(fileContent ? null : detectedLang)
                if (fileContent) detectLanguage(fileContent, fileType)
              }}
            >
              📄 파일 번역
            </button>
            <button
              className={`${styles.sourceBtn} ${sourceType === 'text' ? styles.sourceActive : ''}`}
              onClick={() => {
                setSourceType('text')
                setDetectedLang(manualText ? null : detectedLang)
                if (manualText) detectLanguage(manualText, 'txt')
              }}
            >
              ✍️ 텍스트 직접 입력
            </button>
          </div>

          {/* ── Upload Zone ── */}
          {sourceType === 'file' && (
            <section className={`glass-card ${styles.section}`}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>📁</span> 문서 업로드
              </h2>
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="파일 업로드 영역"
                id="file-dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.html,.htm"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                  id="file-input"
                />
                {file ? (
                  <div className={styles.fileInfo}>
                    <span className={styles.fileIcon}>{fileType === 'html' ? '🌐' : '📄'}</span>
                    <div>
                      <p className={styles.fileName}>{file.name}</p>
                      <p className={styles.fileMeta}>
                        {(file.size / 1024).toFixed(1)} KB · {fileType.toUpperCase()} 파일
                        {detectedLang && (
                          <span className={styles.detectedBadge}>
                            {getLangFlag(detectedLang)} 감지된 언어: {getLangLabel(detectedLang)}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      className={styles.removeFile}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null); setFileContent(''); setDetectedLang(null)
                        setTranslatedText(''); setProgress(0)
                        setError(''); setSuccess('')
                      }}
                      aria-label="파일 제거"
                    >✕</button>
                  </div>
                ) : (
                  <div className={styles.dropzoneEmpty}>
                    <div className={styles.dropIcon}>📂</div>
                    <p className={styles.dropTitle}>파일을 드래그하거나 클릭하여 업로드</p>
                    <p className={styles.dropSub}>지원 형식: TXT, HTML · 최대 10MB</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Direct Text Window ── */}
          {sourceType === 'text' && (
            <section className={`glass-card ${styles.section}`}>
              <div className={styles.sectionHeaderRow}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                  <span className={styles.sectionIcon}>✍️</span> 텍스트 입력
                </h2>
                <div className={styles.textActions}>
                  {detectedLang && (
                    <span className={styles.detectedBadge} style={{ marginRight: 8 }}>
                      {getLangFlag(detectedLang)} 감지된 언어: {getLangLabel(detectedLang)}
                    </span>
                  )}
                  <button
                    className={`btn btn-secondary ${styles.copyInputBtn}`}
                    onClick={handleCopyManualText}
                    disabled={!manualText.trim()}
                  >
                    📋 복사하기
                  </button>
                </div>
              </div>
              <div className={styles.textareaWrapper}>
                <textarea
                  className={styles.largeTextarea}
                  placeholder="번역할 텍스트를 여기에 직접 붙여넣거나 입력하세요..."
                  value={manualText}
                  onChange={(e) => {
                    setManualText(e.target.value)
                    setTranslatedText('')
                    setProgress(0)
                    setError('')
                  }}
                />
              </div>
            </section>
          )}

          {/* ── Language Selection ── */}
          <section className={`glass-card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>🌐</span> 번역 언어 선택
            </h2>
            <p className={styles.langHint}>
              {detectedLang
                ? `원본 언어: ${getLangFlag(detectedLang)} ${getLangLabel(detectedLang)} — 아래에서 번역할 언어를 선택하세요`
                : '번역할 대상 언어를 선택하세요'}
            </p>
            <div className={styles.langGrid}>
              {LANGUAGES.map(lang => {
                const isSame    = detectedLang === lang.code
                const isSelected = targetLang === lang.code
                return (
                  <button
                    key={lang.code}
                    className={`${styles.langBtn} ${isSelected ? styles.langSelected : ''} ${isSame ? styles.langSame : ''}`}
                    onClick={() => {
                      if (isSame) {
                        setError(`⚠️ 원본 언어(${lang.label})와 번역 언어가 동일합니다.`)
                        return
                      }
                      setTargetLang(lang.code)
                      setError('')
                    }}
                    title={isSame ? '원본 언어와 동일합니다' : lang.label}
                    id={`lang-btn-${lang.code}`}
                  >
                    <span className={styles.langFlag}>{lang.flag}</span>
                    <span className={styles.langLabel}>{lang.label}</span>
                    <span className={styles.langCode}>{lang.code}</span>
                    {isSame && <span className={styles.sameBadge}>원본</span>}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Translate Button & Progress ── */}
          <section className={`glass-card ${styles.section}`}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIcon}>⚡</span> 번역 실행
            </h2>

            {/* Errors / Success */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <span>⚠️</span> {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                {success}
              </div>
            )}

            <button
              className={`btn btn-primary ${styles.translateBtn}`}
              onClick={handleTranslate}
              disabled={isTranslating || !targetLang || (sourceType === 'file' ? !file : !manualText.trim())}
              id="translate-btn"
            >
              {isTranslating ? (
                <><span className={styles.spinner} /> 번역 중...</>
              ) : (
                <><span>🔄</span> 번역 시작</>
              )}
            </button>

            {/* Progress */}
            {(isTranslating || progress > 0) && (
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-label">
                    {isTranslating ? '번역 진행 중' : '번역 완료'}
                  </span>
                  <span className="progress-percent">{progress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {progressStatus && (
                  <p className="progress-status">{progressStatus}</p>
                )}
              </div>
            )}
          </section>

          {/* ── Result & Download ── */}
          {translatedText && (
            <section className={`glass-card ${styles.section}`} id="result-section">
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>✅</span> 번역 결과
                <span className={styles.resultBadge}>
                  {getLangFlag(targetLang)} {getLangLabel(targetLang)}
                </span>
              </h2>

              <div className={styles.preview}>
                <pre className={styles.previewText}>{translatedText}</pre>
              </div>

              {/* Download format */}
              <div className={styles.downloadRow}>
                <div className={styles.fmtToggle}>
                  <span className={styles.fmtLabel}>다운로드 형식:</span>
                  {['html', 'txt'].map(fmt => (
                    <button
                      key={fmt}
                      className={`${styles.fmtBtn} ${downloadFmt === fmt ? styles.fmtActive : ''}`}
                      onClick={() => setDownloadFmt(fmt)}
                      id={`download-fmt-${fmt}`}
                    >
                      {fmt === 'html' ? '🌐 HTML' : '📄 TXT'}
                    </button>
                  ))}
                </div>
                <button
                  className={`btn btn-success ${styles.downloadBtn}`}
                  onClick={handleDownload}
                  id="download-btn"
                >
                  <span>⬇️</span> 다운로드
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeDeeplLang(deeplLang) {
  const map = { 'EN': 'EN', 'EN-US': 'EN', 'EN-GB': 'EN', 'KO': 'KO', 'ZH': 'ZH', 'JA': 'JA' }
  return map[deeplLang.toUpperCase()] || null
}

function buildHtmlOutput(text, langLabel, originalName, srcLang, tgtLang) {
  const lines = text.split('\n').map(l => `<p>${escHtml(l)}</p>`).join('\n')
  return `<!DOCTYPE html>
<html lang="${tgtLang?.toLowerCase() || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>번역 결과 — ${escHtml(langLabel)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 800px; margin: 40px auto; padding: 0 24px;
           color: #1a202c; line-height: 1.8; background: #f7fafc; }
    header { border-bottom: 2px solid #e2e8f0; margin-bottom: 32px; padding-bottom: 16px; }
    header h1 { font-size: 1.4rem; color: #2d3748; margin-bottom: 4px; }
    header p { font-size: 0.85rem; color: #718096; margin: 2px 0; }
    main p { margin-bottom: 12px; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0;
             font-size: 0.78rem; color: #a0aec0; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>📄 ${escHtml(originalName)}</h1>
    <p>번역 언어: <strong>${escHtml(langLabel)}</strong></p>
    <p>번역 일시: ${new Date().toLocaleString('ko-KR')}</p>
    <p>번역 엔진: DeepL API</p>
  </header>
  <main>
    ${lines}
  </main>
  <footer>TransLingo · Powered by DeepL API</footer>
</body>
</html>`
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
