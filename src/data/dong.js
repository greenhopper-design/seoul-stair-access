// 좌표 → 행정동 판정
//
// 생활인구 API는 행정동 코드(8자리)로 데이터를 주는데, 역지오코딩으로 얻는 동 이름은
// 법정동이라 그대로 맞출 수 없다(창신동 ↔ 창신1·2·3동). 그래서 행정동 경계 폴리곤을 싣고
// 점-다각형 판정으로 코드를 직접 구한다.
//
// 경계 데이터: vuski/admdongkor (통계청 행정동 경계, 2026-07-01판)를 서울만 추려
// 약 11m 오차로 단순화한 것. public/seoul-dong.json (199KB, gzip 45KB).
// 첫 화면이 아니라 분석을 시작할 때 처음 한 번만 받는다.

let cache = null
let loading = null

export async function loadDongBoundaries() {
  if (cache) return cache
  if (loading) return loading
  loading = fetch('/seoul-dong.json', { signal: AbortSignal.timeout(20000) })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
    .then((j) => {
      cache = j
      return j
    })
    .catch(() => null)
    .finally(() => {
      loading = null
    })
  return loading
}

/** 광선 교차법. 구멍(내부 링)은 홀짝 규칙으로 자연히 처리된다. */
function inside(lon, lat, area) {
  const [minX, minY, maxX, maxY] = area.b
  if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false
  let odd = false
  for (const ring of area.r) {
    const n = ring.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i]
      const yi = ring[2 * i + 1]
      const xj = ring[2 * j]
      const yj = ring[2 * j + 1]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) odd = !odd
    }
  }
  return odd
}

/** 좌표가 속한 행정동 { code, name } 또는 null */
export function dongAt(lat, lon, data) {
  if (!data?.dong) return null
  for (const area of data.dong) {
    if (inside(lon, lat, area)) return { code: area.c, name: area.n }
  }
  return null
}
