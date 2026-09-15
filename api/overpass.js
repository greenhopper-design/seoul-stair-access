// Vercel 서버리스 함수 — 브라우저 → 같은 도메인(/api/overpass) → Overpass 서버.
// CORS는 브라우저에만 적용되는 제약이므로, 서버에서 호출하면 공개 인스턴스의
// CORS 정책과 무관하게 동작한다. 응답이 느리거나 죽은 인스턴스는 순서대로 넘어간다.

const UPSTREAMS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' })

  // Vercel이 content-type에 따라 문자열 또는 객체로 넘겨준다
  const body =
    typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString()

  let lastErr = ''
  for (const url of UPSTREAMS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(45000),
      })
      if (!r.ok) {
        lastErr = `${new URL(url).host} → HTTP ${r.status}`
        continue
      }
      const json = await r.json()
      // 같은 영역을 다시 분석할 때는 CDN 캐시에서 즉시 응답 (발표 중 재실행 대비)
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
      return res.status(200).json(json)
    } catch (e) {
      lastErr = `${new URL(url).host} → ${e.message}`
    }
  }
  return res.status(502).json({ error: 'Overpass 업스트림 전부 실패: ' + lastErr })
}
