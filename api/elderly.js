// 서울 열린데이터광장 생활인구(자치구별) — 자치구별 65세 이상 비율을 계산해 돌려준다.
//
// 왜 '생활인구'인가: 연령별 등록인구 통계는 열린데이터광장에서 시트·차트로만 제공되고
// OpenAPI가 없다. 반면 생활인구(SPOP_LOCAL_RESD_JACHI)는 자치구 코드별·시간대별·연령대별로
// OpenAPI를 제공한다. 심야 시간대 생활인구는 그 지역에 실제로 머무는 인구에 가깝다.
//
// 인증키는 서버 환경변수(SEOUL_API_KEY)로만 존재하며 브라우저로 내려가지 않는다.

const SERVICE = 'SPOP_LOCAL_RESD_JACHI'
const HOUR = '04' // 새벽 4시 — 통근·방문 유입이 가장 적어 거주 인구에 가장 가까운 시간대
const ROWS = 600 // 자치구 25 × 시간대 24 = 최신 일자 한 벌
const TIMEOUT_MS = 20000

// 65세 이상 = 65~69세 + 70세 이상(마지막 구간이 누적)
const SENIOR_FIELDS = [
  'MALE_F65T69_LVPOP_CO',
  'MALE_F70T74_LVPOP_CO',
  'FEMALE_F65T69_LVPOP_CO',
  'FEMALE_F70T74_LVPOP_CO',
]

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  const key = process.env.SEOUL_API_KEY
  if (!key) {
    return res.status(503).json({ error: 'SEOUL_API_KEY가 설정되지 않았습니다.' })
  }

  const url = `http://openapi.seoul.go.kr:8088/${key}/json/${SERVICE}/1/${ROWS}/`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    const json = await r.json()
    const body = json[SERVICE]
    if (!body?.row?.length) {
      const msg = body?.RESULT?.MESSAGE || json?.RESULT?.MESSAGE || '응답에 데이터가 없습니다.'
      return res.status(502).json({ error: msg })
    }

    // 최신 일자만 사용한다 (응답 선두가 최신 일자 한 벌이지만 섞여 있어도 안전하게 거른다)
    const latest = body.row.reduce((a, x) => (x.STDR_DE_ID > a ? x.STDR_DE_ID : a), '')
    const ratios = {}
    for (const row of body.row) {
      if (row.STDR_DE_ID !== latest || row.TMZON_PD_SE !== HOUR) continue
      const total = Number(row.TOT_LVPOP_CO)
      if (!total) continue
      const senior = SENIOR_FIELDS.reduce((a, f) => a + Number(row[f] || 0), 0)
      ratios[row.ADSTRD_CODE_SE] = Math.round((senior / total) * 1000) / 10
    }
    if (!Object.keys(ratios).length) {
      return res.status(502).json({ error: '해당 시간대 데이터를 찾지 못했습니다.' })
    }

    // 인구 통계는 월 단위로 갱신된다. 하루 캐시면 충분하다.
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json({
      source: '서울 열린데이터광장 생활인구(자치구별)',
      service: SERVICE,
      date: latest,
      hour: HOUR,
      ratios,
    })
  } catch (e) {
    return res.status(502).json({ error: '열린데이터광장 호출 실패: ' + e.message })
  }
}
