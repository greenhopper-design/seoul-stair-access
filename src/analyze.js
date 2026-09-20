// 분석 파이프라인: 계단 수집 → 상승고 → 고령인구 → 대체수단 → 우회거리
import { fetchArea, haversine } from './data/overpass.js'
import { attachRise } from './data/elevation.js'
import { elderlyRatioAt, guNameAt } from './data/elderly.js'
import { estimateDetour } from './data/detour.js'

const MAX_STAIRS = 200 // 발표용 MVP 상한. 초과 시 긴 계단 우선.

export async function analyzeArea(bbox, onProgress = () => {}) {
  onProgress('계단·대체수단 데이터를 불러오는 중… (OpenStreetMap)')
  const area = await fetchArea(bbox, () =>
    onProgress('Overpass 서버가 혼잡합니다. 잠시 후 자동으로 다시 시도합니다…')
  )
  let stairs = area.stairs
  const elevators = area.elevators
  const cachedAt = area.cachedAt
  const total = stairs.length
  // 에스컬레이터가 설치된 계단은 그 자체가 대체 이동수단이므로 분석 상한과 무관하게 모두 남긴다
  const escalators = stairs
    .filter((s) => s.conveying && s.conveying !== 'no')
    .map((s) => ({ id: s.id, lat: s.center[0], lon: s.center[1], kind: '에스컬레이터' }))
  if (stairs.length > MAX_STAIRS) {
    stairs = [...stairs].sort((a, b) => b.lengthM - a.lengthM).slice(0, MAX_STAIRS)
  }
  if (!stairs.length) return { stairs: [], elevators: [], total: 0, gu: null, cachedAt }

  // 엘리베이터와 에스컬레이터를 함께 '대체 이동수단' 후보로 본다 (AccessMap이 경사로·승강설비를
  // 대체 경로로 취급하는 방식과 같다)
  const alternatives = [...elevators, ...escalators]

  onProgress('고도 데이터로 총 상승고를 계산하는 중…')
  await attachRise(stairs)

  onProgress('행정구역·고령인구를 확인하는 중…')
  const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const gu = await guNameAt(center[0], center[1])

  stairs.forEach((s) => {
    s.elderlyRatio = elderlyRatioAt(s.center[0], s.center[1], gu)
    s.gu = gu

    // 같은 계단에 에스컬레이터·경사로가 병설되어 있으면 그 자체가 대체 수단이다
    s.selfAlt =
      s.conveying && s.conveying !== 'no'
        ? '에스컬레이터 병설'
        : s.ramp
          ? '경사로 병설'
          : null

    let nearest = null
    for (const e of alternatives) {
      if (e.id === s.id) continue
      const d = haversine({ lat: s.center[0], lon: s.center[1] }, { lat: e.lat, lon: e.lon })
      if (nearest == null || d < nearest.d) nearest = { d, e }
    }
    s.nearestElevatorM = nearest && nearest.d <= 800 ? nearest.d : null
    s.nearestElevator = s.nearestElevatorM != null ? nearest.e : null
    s.detour = estimateDetour(s)
  })

  return { stairs, elevators: alternatives, total, gu, cachedAt }
}

export const SEOUL_BBOX = [37.42, 126.76, 37.71, 127.19]

/** 표시용 위치 이름 */
export function stairLabel(s) {
  if (s.name) return s.name
  const gu = s.gu ? s.gu + ' ' : ''
  return `${gu}${s.center[0].toFixed(4)}, ${s.center[1].toFixed(4)}`
}
