// 고령인구 — 서울 열린데이터광장 생활인구(자치구별) 실데이터.
//
// 서버 함수 /api/elderly 가 인증키를 들고 열린데이터광장을 호출해 자치구별 65세 이상 비율을
// 계산해 준다. 키는 서버에만 있고 브라우저로 내려오지 않는다.
// 호출이 실패하면(키 미설정·서버 장애·로컬 개발) 예시 값으로 내려가고, 화면에 그렇게 표기한다.
//
// 한계: 행정동이 아니라 자치구 단위다. 연령별 '등록인구'는 열린데이터광장에서 OpenAPI로
// 제공되지 않아(시트·차트 전용) 생활인구를 쓴다. 행정동 단위로 올리려면 행정동 경계
// 폴리곤을 넣고 SPOP_LOCAL_RESD_DONG(행정동별)으로 바꾸면 된다.

// 행정표준코드 시군구 5자리. API 응답의 ADSTRD_CODE_SE 와 맞춘다.
const GU_CODE = {
  종로구: '11110', 중구: '11140', 용산구: '11170', 성동구: '11200', 광진구: '11215',
  동대문구: '11230', 중랑구: '11260', 성북구: '11290', 강북구: '11305', 도봉구: '11320',
  노원구: '11350', 은평구: '11380', 서대문구: '11410', 마포구: '11440', 양천구: '11470',
  강서구: '11500', 구로구: '11530', 금천구: '11545', 영등포구: '11560', 동작구: '11590',
  관악구: '11620', 서초구: '11650', 강남구: '11680', 송파구: '11710', 강동구: '11740',
}

// API를 쓸 수 없을 때만 사용하는 자리표시값. 실제 통계가 아니다.
const SAMPLE_RATIO = 19

let cache = null // API 응답 { dong, gu, date, source }

/** 자치구별·행정동별 65세 이상 비율을 한 번 받아 둔다. 실패하면 null. */
export async function loadElderlyRatios() {
  if (cache) return cache
  try {
    const res = await fetch('/api/elderly', { signal: AbortSignal.timeout(25000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = await res.json()
    if (!json.dong && !json.gu) throw new Error(json.error || '응답 형식 오류')
    cache = json
    return cache
  } catch {
    return null
  }
}

/**
 * 계단 한 곳의 65세 이상 비율(%).
 * 행정동이 판정되면 행정동 값, 안 되면 자치구 값, 둘 다 없으면 예시값으로 내려간다.
 */
export function elderlyRatioOf({ dong, guName, data }) {
  if (data?.dong && dong?.code && data.dong[dong.code] != null) {
    return {
      ratio: data.dong[dong.code],
      real: true,
      level: '행정동',
      area: dong.name,
      date: data.date,
      source: data.source,
    }
  }
  const code = GU_CODE[guName]
  if (data?.gu && code && data.gu[code] != null) {
    return {
      ratio: data.gu[code],
      real: true,
      level: '자치구',
      area: guName,
      date: data.date,
      source: data.source,
    }
  }
  return { ratio: SAMPLE_RATIO, real: false, level: '예시', area: guName, source: '예시 데이터' }
}

/** 자치구명 역지오코딩 (Nominatim, 실제 호출) */
export async function guNameAt(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=${lat}&lon=${lon}`,
      { headers: { 'Accept-Language': 'ko' }, signal: AbortSignal.timeout(15000) }
    )
    const j = await res.json()
    return j.address?.borough || j.address?.city_district || j.address?.county || null
  } catch {
    return null
  }
}
