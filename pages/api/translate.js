// pages/api/translate.js
// DeepL API 프록시 — API 키를 서버에서 처리하여 CORS 문제 및 키 노출 방지

const DEEPL_API_FREE = 'https://api-free.deepl.com/v2'
const DEEPL_API_PRO  = 'https://api.deepl.com/v2'

function getDeeplBase(apiKey) {
  // Free 키는 ':fx'로 끝남
  return apiKey.trim().endsWith(':fx') ? DEEPL_API_FREE : DEEPL_API_PRO
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { action, text, targetLang, sourceLang, apiKey } = req.body || {}

  if (!apiKey) {
    return res.status(400).json({ message: 'API 키가 없습니다.' })
  }

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ message: '번역할 텍스트가 없습니다.' })
  }

  const base = getDeeplBase(apiKey)
  const headers = {
    'Authorization': `DeepL-Auth-Key ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    if (action === 'detect') {
      // 언어 감지: target_lang을 임시 영어로 지정하여 감지만 수행
      const body = {
        text: [text.slice(0, 500)],
        target_lang: 'EN',
      }
      const response = await fetch(`${base}/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        return res.status(response.status).json({ message: `DeepL 오류: ${errText}` })
      }

      const data = await response.json()
      const detected = data?.translations?.[0]?.detected_source_language || null
      return res.status(200).json({ detectedLang: detected })
    }

    if (action === 'translate') {
      if (!targetLang) {
        return res.status(400).json({ message: '대상 언어가 지정되지 않았습니다.' })
      }

      const body = {
        text: [text],
        target_lang: targetLang,
        ...(sourceLang ? { source_lang: sourceLang } : {}),
        preserve_formatting: true,
      }

      const response = await fetch(`${base}/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        // 상세한 오류 메시지 파싱
        let errMsg = `DeepL API 오류 (${response.status})`
        try {
          const errJson = JSON.parse(errText)
          errMsg = errJson.message || errMsg
        } catch (_) {}
        return res.status(response.status).json({ message: errMsg })
      }

      const data = await response.json()
      const translatedText = data?.translations?.[0]?.text || ''
      const detectedLang   = data?.translations?.[0]?.detected_source_language || null

      return res.status(200).json({ translatedText, detectedLang })
    }

    return res.status(400).json({ message: '알 수 없는 action입니다.' })

  } catch (err) {
    console.error('[translate API error]', err)
    return res.status(500).json({ message: `서버 오류: ${err.message}` })
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}
