// 서울 열린데이터광장 생활인구 — 행정동별·자치구별 65세 이상 비율을 계산해 돌려준다.
//
// 왜 '생활인구'인가: 연령별 등록인구 통계는 열린데이터광장에서 시트·차트로만 제공되고
// OpenAPI가 없다. 반면 생활인구(SPOP_LOCAL_RESD_DONG)는 행정동 코드별·시간대별·연령대별로
// OpenAPI를 제공한다. 심야 시간대 생활인구는 그 지역에 실제로 머무는 인구에 가깝다.
//
// 인증키는 서버 환경변수(SEOUL_API_KEY)로만 존재하며 브라우저로 내려가지 않는다.

const SERVICE = 'SPOP_LOCAL_RESD_DONG'
const HOUR = '04' // 새벽 4시 — 통근·방문 유입이 가장 적어 거주 인구에 가장 가까운 시간대
const TIMEOUT_MS = 20000

// 65세 이상 = 65~69세 + 70세 이상(마지막 구간이 누적)
const SENIOR_FIELDS = [
  'MALE_F65T69_LVPOP_CO',
  'MALE_F70T74_LVPOP_CO',
  'FEMALE_F65T69_LVPOP_CO',
  'FEMALE_F70T74_LVPOP_CO',
]

export const config = { maxDuration: 30 }

const call = (key, range, args = '') =>
  fetch(`http://openapi.seoul.go.kr:8088/${key}/json/${SERVICE}/${range}/${args}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).then((r) => r.json())

export default async function handler(req, res) {
  const key = process.env.SEOUL_API_KEY
  if (!key) return res.status(503).json({ error: 'SEOUL_API_KEY가 설정되지 않았습니다.' })

  try {
    // 1) 가장 최근 기준일을 확인한다 (응답 선두가 최신)
    const head = await call(key, '1/1')
    const latest = head?.[SERVICE]?.row?.[0]?.STDR_DE_ID
    if (!latest) {
      const msg = head?.[SERVICE]?.RESULT?.MESSAGE || head?.RESULT?.MESSAGE || '기준일 확인 실패'
      return res.status(502).json({ error: msg })
    }

    // 2) 그 날짜의 해당 시간대만 받으면 서울 424개 행정동이 한 번에 들어온다
    const body = (await call(key, '1/1000', `${latest}/${HOUR}/`))?.[SERVICE]
    if (!body?.row?.length) {
      return res.status(502).json({ error: body?.RESULT?.MESSAGE || '데이터가 없습니다.' })
    }

    const dong = {}
    const guSum = {} // 자치구 합계 — 경계 밖 좌표를 위한 대비책
    for (const row of body.row) {
      const total = Number(row.TOT_LVPOP_CO)
      if (!total) continue
      const senior = SENIOR_FIELDS.reduce((a, f) => a + Number(row[f] || 0), 0)
      const code = row.ADSTRD_CODE_SE
      dong[code] = Math.round((senior / total) * 1000) / 10
      const gu = code.slice(0, 5)
      const acc = (guSum[gu] ||= { senior: 0, total: 0 })
      acc.senior += senior
      acc.total += total
    }
    const gu = Object.fromEntries(
      Object.entries(guSum).map(([k, v]) => [k, Math.round((v.senior / v.total) * 1000) / 10])
    )

    // 인구 통계는 월 단위로 갱신된다. 하루 캐시면 충분하다.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json({
      source: '서울 열린데이터광장 생활인구(행정동별)',
      service: SERVICE,
      date: latest,
      hour: HOUR,
      dong,
      gu,
    })
  } catch (e) {
    return res.status(502).json({ error: '열린데이터광장 호출 실패: ' + e.message })
  }
}
