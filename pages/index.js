import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ id: '', password: '', apiKey: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    // 세션 유지: localStorage에 인증 정보가 있으면 바로 이동
    const session = localStorage.getItem('deepl_session')
    if (session) {
      const parsed = JSON.parse(session)
      if (parsed.authenticated && parsed.apiKey) {
        router.replace('/translate')
      }
    }
  }, [router])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.id || !form.password || !form.apiKey) {
      setError('모든 필드를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id, password: form.password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || '아이디 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
        return
      }

      // localStorage에 세션 저장 (새로고침 시 유지)
      localStorage.setItem('deepl_session', JSON.stringify({
        authenticated: true,
        apiKey: form.apiKey,
        loginTime: Date.now(),
      }))

      router.push('/translate')
    } catch (err) {
      setError('서버 연결에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>DeepL 번역 서비스 — 로그인</title>
        <meta name="description" content="DeepL API 기반 다국어 문서 번역 서비스" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.page}>
        {/* Animated background orbs */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />

        <div className={styles.container}>
          {/* Logo / Brand */}
          <div className={styles.brand}>
            <div className={styles.logoIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M4 8h24M4 16h16M4 24h20" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M22 20l4 4-4 4" stroke="url(#grad2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="28" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#63b3ed"/>
                    <stop offset="1" stopColor="#7f5af0"/>
                  </linearGradient>
                  <linearGradient id="grad2" x1="22" y1="20" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38ef7d"/>
                    <stop offset="1" stopColor="#11998e"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className={styles.brandName}>TransLingo</h1>
            <p className={styles.brandSub}>Powered by DeepL API</p>
          </div>

          {/* Login Card */}
          <div className={`glass-card ${styles.card}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>관리자 로그인</h2>
              <p className={styles.cardDesc}>번역 서비스에 접근하려면 로그인하세요</p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
              {/* ID */}
              <div className="input-group">
                <label htmlFor="id">관리자 아이디</label>
                <input
                  id="id"
                  name="id"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={form.id}
                  onChange={handleChange}
                  autoComplete="username"
                />
                <span className="input-icon">👤</span>
              </div>

              {/* Password */}
              <div className="input-group">
                <label htmlFor="password">비밀번호</label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호를 입력하세요"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(p => !p)}
                  aria-label="비밀번호 표시/숨김"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* DeepL API Key */}
              <div className={styles.divider}>
                <span>DeepL 설정</span>
              </div>

              <div className="input-group">
                <label htmlFor="apiKey">
                  DeepL API Key
                  <a
                    href="https://www.deepl.com/ko/account/summary"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.apiLink}
                  >
                    키 발급 →
                  </a>
                </label>
                <input
                  id="apiKey"
                  name="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                  value={form.apiKey}
                  onChange={handleChange}
                  autoComplete="off"
                  style={{ paddingRight: '44px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowApiKey(p => !p)}
                  aria-label="API 키 표시/숨김"
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="alert alert-error">
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className={`btn btn-primary ${styles.submitBtn}`}
                disabled={loading}
                id="login-submit-btn"
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <span>🔐</span> 로그인
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className={styles.footer}>
            © 2025 TransLingo · Secure Translation Platform
          </p>
        </div>
      </div>
    </>
  )
}
