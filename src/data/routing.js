// 실제 보행도로망 경로탐색 — 계단을 이용할 때와 '계단을 막았을 때'의 경로를 각각 구한다.
//
// FOSSGIS가 운영하는 공개 Valhalla 인스턴스를 쓴다(키 불필요).
// 계단 한가운데에 작은 제외 폴리곤을 씌워 그 계단을 통과하지 못하게 만들고 다시 경로를 구하면,
// 그 차이가 '이 계단을 못 쓸 때 실제로 더 걸어야 하는 거리'다.
// 양 끝점까지 덮으면 출발·도착점이 막혀 경로가 없다고 나오므로 중앙만 막는다.
//
// ponytail: 공개 데모 서버라 호출을 아껴야 한다. 그래서 TOP 10에만 적용하고 결과를 캐시한다.
// 상시 운영하려면 Valhalla를 직접 띄우고 ENDPOINT만 바꾸면 된다.

const ENDPOINT = 'https://valhalla1.openstreetmap.de/route'
const TIMEOUT_MS = 15000
const MAX_BLOCK_M = 9 // 계단만 막고 주변 골목은 남길 정도의 크기
const MIN_BLOCK_M = 3 // 이보다 작게 막아야 하는 짧은 계단은 판정을 포기한다
const CACHE_PREFIX = 'stair-access:route2:' // 제외 폴리곤 위치 수정 후 캐시 무효화
const NO_PATH_CODE = 442 // Valhalla: No path could be found for input

export const DATA_SOURCE = { real: true, label: '보행도로망 경로탐색' }

function readCache(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCache(id, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(value))
  } catch {
    // 저장 실패는 무시 — 다음 분석에서 다시 계산하면 된다
  }
}

async function route(from, to, excludePolygon) {
  const body = {
    locations: [
      { lat: from.lat, lon: from.lon },
      { lat: to.lat, lon: to.lon },
    ],
    costing: 'pedestrian',
    units: 'kilometers',
  }
  if (excludePolygon) body.exclude_polygons = [excludePolygon]

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = await res.json()
  if (json.trip) {
    return {
      m: Math.round(json.trip.summary.length * 1000),
      min: Math.round((json.trip.summary.time / 60) * 10) / 10,
    }
  }
  // '경로가 없다'와 '서버가 응답하지 못했다'는 다르다. 후자를 우회로 없음으로 읽으면 안 된다.
  if (json.error_code === NO_PATH_CODE) return 'no-path'
  return null
}

const R = 6371000
function metersBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * 선을 따라 거리의 절반이 되는 지점.
 * 가운데 '꼭짓점'을 쓰면 안 된다 — 꼭짓점 간격이 불규칙해서 끝점 바로 옆인 경우가 많고,
 * 그러면 제외 폴리곤이 출발·도착점까지 덮어 실제로는 있는 우회로가 없다고 나온다.
 */
function midpointAlong(geometry) {
  const pts = geometry.map(([lat, lon]) => ({ lat, lon }))
  const segs = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = metersBetween(pts[i - 1], pts[i])
    segs.push(d)
    total += d
  }
  let walked = 0
  for (let i = 0; i < segs.length; i++) {
    if (walked + segs[i] >= total / 2) {
      const t = segs[i] === 0 ? 0 : (total / 2 - walked) / segs[i]
      return {
        lat: pts[i].lat + (pts[i + 1].lat - pts[i].lat) * t,
        lon: pts[i].lon + (pts[i + 1].lon - pts[i].lon) * t,
      }
    }
    walked += segs[i]
  }
  return pts[pts.length - 1]
}

/** 양 끝점이 반드시 폴리곤 밖에 남도록 크기를 줄인 정사각형 */
function blockBox(mid, stair) {
  const nearest = Math.min(metersBetween(mid, stair.start), metersBetween(mid, stair.end))
  const sizeM = Math.min(MAX_BLOCK_M, nearest * 0.5)
  if (sizeM < MIN_BLOCK_M) return null // 너무 짧은 계단 — 안전하게 막을 수 없다
  const dLat = sizeM / 111320
  const dLon = sizeM / (111320 * Math.cos((mid.lat * Math.PI) / 180))
  return [
    [mid.lon - dLon, mid.lat - dLat],
    [mid.lon + dLon, mid.lat - dLat],
    [mid.lon + dLon, mid.lat + dLat],
    [mid.lon - dLon, mid.lat + dLat],
    [mid.lon - dLon, mid.lat - dLat],
  ]
}

/**
 * 계단 하나의 실제 우회 거리·시간.
 * 실패하면 null을 돌려주고, 호출한 쪽은 기존 추정값을 그대로 쓴다.
 */
export async function realDetour(stair) {
  const cached = readCache(stair.id)
  if (cached) return cached

  const box = blockBox(midpointAlong(stair.geometry), stair)
  if (!box) return null

  try {
    const direct = await route(stair.start, stair.end)
    const around = await route(stair.start, stair.end, box)

    // 계단을 막았더니 경로가 아예 없다 = 이 계단이 유일한 통로
    if (around === 'no-path') {
      const result = {
        detourM: null,
        detourMin: null,
        extraM: 1500,
        extraMin: null,
        stairM: direct?.m ?? Math.round(stair.lengthM),
        stairMin: direct?.min ?? null,
        impossible: true,
        source: '보행도로망 경로탐색',
      }
      saveCache(stair.id, result)
      return result
    }
    if (!direct || direct === 'no-path' || !around) return null

    const result = {
      detourM: around.m,
      detourMin: around.min,
      extraM: Math.max(0, around.m - direct.m),
      extraMin: Math.round((around.min - direct.min) * 10) / 10,
      stairM: direct.m,
      stairMin: direct.min,
      impossible: false,
      source: '보행도로망 경로탐색',
    }
    saveCache(stair.id, result)
    return result
  } catch {
    return null
  }
}
