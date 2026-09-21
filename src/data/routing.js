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
const BLOCK_RADIUS = 0.00008 // 약 9m — 계단만 막고 주변 도로는 남긴다
const CACHE_PREFIX = 'stair-access:route:'

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
  if (!json.trip) return null // 경로 없음 (제외 폴리곤 때문에 갈 길이 사라진 경우 포함)
  return {
    m: Math.round(json.trip.summary.length * 1000),
    min: Math.round((json.trip.summary.time / 60) * 10) / 10,
  }
}

const blockBox = ([lat, lon]) => [
  [lon - BLOCK_RADIUS, lat - BLOCK_RADIUS],
  [lon + BLOCK_RADIUS, lat - BLOCK_RADIUS],
  [lon + BLOCK_RADIUS, lat + BLOCK_RADIUS],
  [lon - BLOCK_RADIUS, lat + BLOCK_RADIUS],
  [lon - BLOCK_RADIUS, lat - BLOCK_RADIUS],
]

/**
 * 계단 하나의 실제 우회 거리·시간.
 * 실패하면 null을 돌려주고, 호출한 쪽은 기존 추정값을 그대로 쓴다.
 */
export async function realDetour(stair) {
  const cached = readCache(stair.id)
  if (cached) return cached

  try {
    const direct = await route(stair.start, stair.end)
    const around = await route(stair.start, stair.end, blockBox(stair.center))

    // 계단을 막았더니 경로가 아예 없다 = 이 계단이 유일한 통로
    if (!around) {
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
    if (!direct) return null

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
