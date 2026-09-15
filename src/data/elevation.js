// 총 상승고(rise) 산출
// 1순위: Open-Meteo Elevation API (Copernicus DEM GLO-90, 실제 고도 데이터 / 해상도 약 90m)
// 2순위: OSM step_count 태그 × 표준 단높이 0.17m
// 3순위: 계단 길이 기반 기하 추정 (예시 추정값)
// → 서울시/VWorld 고정밀 DEM 연결 시 fetchElevations()만 교체하면 된다.

const STEP_RISE = 0.17 // m, 건축법 시행령 기준 주택 외 계단 단높이 상한 근사

async function openMeteoElevations(points) {
  const out = new Array(points.length).fill(null)
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100)
    const lat = chunk.map((p) => p.lat.toFixed(6)).join(',')
    const lon = chunk.map((p) => p.lon.toFixed(6)).join(',')
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`)
    if (!res.ok) throw new Error('Elevation API ' + res.status)
    const json = await res.json()
    json.elevation.forEach((v, k) => (out[i + k] = v))
  }
  return out
}

/** stairs 배열에 riseM / riseSource 를 채워 넣는다 (in-place, 배열 반환) */
export async function attachRise(stairs) {
  let dem = null
  const points = stairs.flatMap((s) => [s.start, s.end])
  try {
    dem = await openMeteoElevations(points)
  } catch {
    dem = null
  }

  stairs.forEach((s, i) => {
    const a = dem?.[i * 2]
    const b = dem?.[i * 2 + 1]
    const demRise = a != null && b != null ? Math.abs(b - a) : null

    if (demRise != null && demRise >= 1) {
      s.riseM = demRise
      s.riseSource = 'DEM(Copernicus 90m)'
    } else if (s.stepCountTag) {
      s.riseM = s.stepCountTag * STEP_RISE
      s.riseSource = 'OSM step_count'
    } else {
      // 평균 계단 경사 약 30° 가정
      s.riseM = Math.max(demRise ?? 0, s.lengthM * 0.5)
      s.riseSource = '예시 추정(경사 30° 가정)'
    }
    s.demElevation = a != null ? { start: a, end: b } : null

    if (s.stepCountTag) {
      s.stepCount = s.stepCountTag
      s.stepCountSource = 'OSM step_count'
    } else {
      s.stepCount = Math.max(3, Math.round(s.riseM / STEP_RISE))
      s.stepCountSource = s.riseSource.startsWith('DEM') ? '상승고 기반 환산' : '예시 추정'
    }
  })
  return stairs
}
