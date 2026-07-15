// pages/api/auth.js
// 관리자 인증 API

const ADMIN_ID = 'admin'
const ADMIN_PW = '123jesus'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  const { id, password } = req.body || {}

  if (!id || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' })
  }

  if (id === ADMIN_ID && password === ADMIN_PW) {
    return res.status(200).json({ success: true, message: '로그인 성공' })
  }

  return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
}
