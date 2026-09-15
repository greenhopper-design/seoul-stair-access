// OpenStreetMap Overpass API — 실제 데이터 (계단 highway=steps, 엘리베이터 highway=elevator)
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function overpass(query) {
  let lastErr
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query) })
      if (!res.ok) throw new Error('Overpass ' + res.status)
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
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
export async function fetchStairs(bbox) {
  const bb = bbox.join(',')
  const q = `[out:json][timeout:60];
way["highway"="steps"](${bb});
out geom;`
  const json = await overpass(q)
  return (json.elements || [])
    .filter((e) => e.type === 'way' && e.geometry && e.geometry.length >= 2)
    .map((e) => {
      const g = e.geometry
      const t = e.tags || {}
      const length = pathLength(g)
      const mid = g[Math.floor(g.length / 2)]
      return {
        id: 'way/' + e.id,
        osmId: e.id,
        name: t.name || t['addr:street'] || null,
        geometry: g.map((p) => [p.lat, p.lon]),
        start: { lat: g[0].lat, lon: g[0].lon },
        end: { lat: g[g.length - 1].lat, lon: g[g.length - 1].lon },
        center: [mid.lat, mid.lon],
        lengthM: length,
        stepCountTag: t.step_count ? Number(t.step_count) : null,
        handrail: t.handrail === 'yes' ? true : t.handrail === 'no' ? false : null,
        landing: t['step:landing'] === 'yes' || t.landing === 'yes' ? true : null,
        widthM: t.width ? parseFloat(t.width) : null,
        incline: t.incline || null,
        conveying: t.conveying || null, // 에스컬레이터 여부
        ramp: t.ramp === 'yes' || t['ramp:stroller'] === 'yes' || t['ramp:wheelchair'] === 'yes',
        tags: t,
      }
    })
}

export async function fetchElevators(bbox) {
  const bb = bbox.join(',')
  const q = `[out:json][timeout:60];
(
  node["highway"="elevator"](${bb});
  way["highway"="elevator"](${bb});
  node["elevator"="yes"](${bb});
  node["railway"="subway_entrance"]["wheelchair"="yes"](${bb});
);
out center;`
  const json = await overpass(q)
  return (json.elements || [])
    .map((e) => ({
      id: e.type + '/' + e.id,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
      kind: e.tags?.highway === 'elevator' || e.tags?.elevator === 'yes' ? '엘리베이터' : '배리어프리 출입구',
    }))
    .filter((e) => e.lat != null)
}

/** Nominatim 지역 검색 → bbox */
export async function searchPlace(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=kr&viewbox=126.76,37.71,127.18,37.42&bounded=1&q=' +
    encodeURIComponent(query)
  const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } })
  if (!res.ok) throw new Error('지역 검색 실패')
  const json = await res.json()
  return json.map((r) => ({
    label: r.display_name,
    bbox: [Number(r.boundingbox[0]), Number(r.boundingbox[2]), Number(r.boundingbox[1]), Number(r.boundingbox[3])],
    center: [Number(r.lat), Number(r.lon)],
  }))
}
