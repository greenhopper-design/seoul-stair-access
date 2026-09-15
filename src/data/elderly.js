// 고령인구 — ※ 예시 데이터 ※
// 서울 열린데이터광장 "행정동별 연령별 등록인구" API 연결 전까지 사용하는 자리표시 모듈.
// 실제 연결 시 fetchElderlyRatio() 만 실제 API 호출로 교체하면 된다.
//   예) http://openapi.seoul.go.kr:8088/{KEY}/json/octastatapi/1/1000/
// 아래 자치구별 값은 서울시 공표 65세 이상 인구비율의 '대략적인 범위'를 본뜬 예시값이며,
// 실제 통계치가 아니다. 화면에서는 항상 '예시 데이터'로 표기한다.

export const DATA_SOURCE = { real: false, label: '예시 데이터' }

const GU_SAMPLE = {
  종로구: 22, 중구: 21, 용산구: 20, 성동구: 18, 광진구: 17, 동대문구: 21, 중랑구: 22,
  성북구: 19, 강북구: 24, 도봉구: 24, 노원구: 21, 은평구: 21, 서대문구: 20, 마포구: 17,
  양천구: 17, 강서구: 19, 구로구: 21, 금천구: 21, 영등포구: 19, 동작구: 19, 관악구: 19,
  서초구: 16, 강남구: 16, 송파구: 17, 강동구: 18,
}
const DEFAULT_RATIO = 19

/** 좌표 주변 고령인구 비율(%) — 현재는 예시 데이터 */
export function elderlyRatioAt(_lat, _lon, guName) {
  const base = GU_SAMPLE[guName] ?? DEFAULT_RATIO
  // 동일 자치구 내 미세 편차를 주기 위한 결정론적 변주 (좌표 해시)
  const jitter = ((Math.round((_lat + _lon) * 10000) % 7) - 3) * 0.6
  return Math.round((base + jitter) * 10) / 10
}

/** 자치구명 역지오코딩 (Nominatim, 실제 호출) */
export async function guNameAt(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=${lat}&lon=${lon}`,
      { headers: { 'Accept-Language': 'ko' } }
    )
    const j = await res.json()
    return j.address?.borough || j.address?.city_district || j.address?.county || null
  } catch {
    return null
  }
}
