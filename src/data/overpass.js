// OpenStreetMap Overpass API — 실제 데이터 (계단 highway=steps, 엘리베이터 highway=elevator)
// 공개 Overpass 인스턴스는 시점마다 살아있는 곳이 다르다(과부하·클라우드 IP 차단·지역 한정).
// 순차 시도하면 죽은 서버에서 매번 수십 초를 버리므로, 서로 다른 서버에 동시에 던지고
// 가장 먼저 성공한 응답을 쓴다. 각 서버가 받는 동시 요청은 1건이라 이용 정책에 어긋나지 않는다.
// '/api/overpass' 는 같은 도메인의 서버리스 프록시로, 브라우저 CORS 차단을 우회하는 경로다
// (로컬 개발에서는 404가 나고 나머지 경로가 처리한다).
// ponytail: 서버 목록 하드코딩. 실제 운영 규모가 되면 자체 Overpass 인스턴스로 교체.
const ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  '/api/overpass',
  'https://overpass.kumi.systems/api/interpreter',
]
const TIMEOUT_MS = 25000
const RETRY_TIMEOUT_MS = 45000
const RETRY_DELAY_MS = 3000

function race(query, timeout) {
  const body = 'data=' + encodeURIComponent(query)
  const tryOne = async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(timeout),
    })
    if (!res.ok) throw new Error(`${new URL(url, location.href).host} → HTTP ${res.status}`)
    return res.json()
  }
  return Promise.any(ENDPOINTS.map(tryOne))
}

async function overpass(query, onRetry) {
  try {
    return await race(query, TIMEOUT_MS)
  } catch {
    // 공개 인스턴스는 일시적 과부하가 잦다. 잠깐 쉬었다가 더 긴 제한시간으로 한 번만 다시 시도한다.
    onRetry?.()
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    try {
      return await race(query, RETRY_TIMEOUT_MS)
    } catch (e) {
      const detail = e.errors ? e.errors.map((x) => x.message).join(' / ') : e.message
      throw new Error('Overpass 서버 응답 실패 (' + detail + ')')
    }
  }
}

const R = 6371000
export function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pathLength(geometry) {
  let sum = 0
  for (let i = 1; i < geometry.length; i++) sum += haversine(geometry[i - 1], geometry[i])
  return sum
}

/** bbox = [south, west, north, east] */
// 성공한 수집 결과를 브라우저에 저장해 둔다.
// 공개 Overpass 인스턴스가 통째로 죽는 일이 드물지 않아(실측: 전 미러 504), 같은 영역을
// 다시 분석할 때는 저장본으로 대체한다. 저장본을 쓸 때는 수집 시각을 화면에 반드시 표기한다.
const CACHE_PREFIX = 'stair-access:area:'
const CACHE_MAX = 8

const cacheKey = (bbox) => CACHE_PREFIX + bbox.map((v) => v.toFixed(3)).join(',')

function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k)
    }
    if (keys.length > CACHE_MAX) {
      keys
        .map((k) => ({ k, ts: readCache(k)?.ts || 0 }))
        .sort((a, b) => a.ts - b.ts)
        .slice(0, keys.length - CACHE_MAX)
        .forEach(({ k }) => localStorage.removeItem(k))
    }
  } catch {
    // 저장 실패(용량 초과·시크릿 모드)는 분석 자체를 막지 않는다
  }
}

/**
 * 계단과 대체 이동수단을 한 번의 Overpass 쿼리로 가져온다.
 * 예전에는 두 번 나눠 호출했는데, 공개 인스턴스가 불안정해 왕복이 늘수록 실패 확률이
 * 그대로 커졌다. 한 요청으로 묶어 실패 지점과 대기시간을 절반으로 줄인다.
 * 실시간 수집이 모두 실패하면 같은 영역의 저장본으로 대체하고 수집 시각을 함께 돌려준다.
 */
export async function fetchArea(bbox, onRetry) {
  const bb = bbox.join(',')
  const q = `[out:json][timeout:90];
(
  way["highway"="steps"](${bb});
  node["highway"="elevator"](${bb});
  way["highway"="elevator"](${bb});
  node["elevator"="yes"](${bb});
  node["railway"="subway_entrance"]["wheelchair"="yes"](${bb});
);
out geom;`
  const key = cacheKey(bbox)
  try {
    const elements = (await overpass(q, onRetry)).elements || []
    const data = { stairs: parseStairs(elements), elevators: parseElevators(elements) }
    if (data.stairs.length) saveCache(key, data)
    return { ...data, cachedAt: null }
  } catch (e) {
    const cached = readCache(key)
    if (!cached) throw e
    return { ...cached.data, cachedAt: cached.ts }
  }
}

function parseStairs(elements) {
  return elements
    .filter((e) => e.type === 'way' && e.tags?.highway === 'steps' && e.geometry?.length >= 2)
    .map((e) => {
      const g = e.geometry
      const t = e.tags || {}
      const mid = g[Math.floor(g.length / 2)]
      return {
        id: 'way/' + e.id,
        osmId: e.id,
        name: t.name || t['addr:street'] || null,
        geometry: g.map((p) => [p.lat, p.lon]),
        start: { lat: g[0].lat, lon: g[0].lon },
        end: { lat: g[g.length - 1].lat, lon: g[g.length - 1].lon },
        center: [mid.lat, mid.lon],
        lengthM: pathLength(g),
        stepCountTag: t.step_count ? Number(t.step_count) : null,
        handrail: t.handrail === 'yes' ? true : t.handrail === 'no' ? false : null,
        landing: t['step:landing'] === 'yes' || t.landing === 'yes' ? true : null,
        widthM: t.width ? parseFloat(t.width) : null,
        incline: t.incline || null,
        conveying: t.conveying || null, // 에스컬레이터 여부 (yes/forward/backward)
        ramp: t.ramp === 'yes' || t['ramp:stroller'] === 'yes' || t['ramp:wheelchair'] === 'yes',
        // 접근성 관련 부가 태그 — AccessMap·OpenSidewalks 계열 도구가 공통으로 쓰는 항목
        surface: t.surface || null,
        lit: t.lit === 'yes' ? true : t.lit === 'no' ? false : null,
        tactilePaving: t.tactile_paving === 'yes' ? true : t.tactile_paving === 'no' ? false : null,
        wheelchair: t.wheelchair || null,
        tags: t,
      }
    })
}

function parseElevators(elements) {
  return elements
    .filter((e) => {
      const t = e.tags || {}
      return t.highway === 'elevator' || t.elevator === 'yes' || t.railway === 'subway_entrance'
    })
    .map((e) => {
      const g = e.geometry
      const mid = g?.length ? g[Math.floor(g.length / 2)] : null
      return {
        id: e.type + '/' + e.id,
        lat: e.lat ?? mid?.lat,
        lon: e.lon ?? mid?.lon,
        kind:
          e.tags?.highway === 'elevator' || e.tags?.elevator === 'yes'
            ? '엘리베이터'
            : '배리어프리 출입구',
      }
    })
    .filter((e) => e.lat != null)
}

/** Nominatim 지역 검색 → bbox */
export async function searchPlace(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=kr&viewbox=126.76,37.71,127.18,37.42&bounded=1&q=' +
    encodeURIComponent(query)
  const res = await fetch(url, { headers: { 'Accept-Language': 'ko' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error('지역 검색 실패')
  const json = await res.json()
  return json.map((r) => ({
    label: r.display_name,
    bbox: [Number(r.boundingbox[0]), Number(r.boundingbox[2]), Number(r.boundingbox[1]), Number(r.boundingbox[3])],
    center: [Number(r.lat), Number(r.lon)],
  }))
}
