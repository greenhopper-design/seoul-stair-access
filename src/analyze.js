// 분석 파이프라인: 계단 수집 → 상승고 → 고령인구 → 대체수단 → 우회거리
import { fetchStairs, fetchElevators, haversine } from './data/overpass.js'
import { attachRise } from './data/elevation.js'
import { elderlyRatioAt, guNameAt } from './data/elderly.js'
import { estimateDetour } from './data/detour.js'

const MAX_STAIRS = 200 // 발표용 MVP 상한. 초과 시 긴 계단 우선.

export async function analyzeArea(bbox, onProgress = () => {}) {
  onProgress('계단 데이터를 불러오는 중… (OpenStreetMap)')
  let stairs = await fetchStairs(bbox)
  const total = stairs.length
  if (stairs.length > MAX_STAIRS) {
    stairs = [...stairs].sort((a, b) => b.lengthM - a.lengthM).slice(0, MAX_STAIRS)
  }
  if (!stairs.length) return { stairs: [], elevators: [], total: 0, gu: null }

  onProgress('대체 이동수단(엘리베이터)을 확인하는 중…')
  let elevators = []
  try {
    elevators = await fetchElevators(bbox)
  } catch {
    elevators = []
  }

  onProgress('고도 데이터로 총 상승고를 계산하는 중…')
  await attachRise(stairs)

  onProgress('행정구역·고령인구를 확인하는 중…')
  const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const gu = await guNameAt(center[0], center[1])

  stairs.forEach((s) => {
    s.elderlyRatio = elderlyRatioAt(s.center[0], s.center[1], gu)
    s.gu = gu

    let nearest = null
    for (const e of elevators) {
      const d = haversine({ lat: s.center[0], lon: s.center[1] }, { lat: e.lat, lon: e.lon })
      if (nearest == null || d < nearest.d) nearest = { d, e }
    }
    s.nearestElevatorM = nearest && nearest.d <= 800 ? nearest.d : null
    s.nearestElevator = s.nearestElevatorM != null ? nearest.e : null
    s.detour = estimateDetour(s)
  })

  return { stairs, elevators, total, gu }
}

export const SEOUL_BBOX = [37.42, 126.76, 37.71, 127.19]

/** 표시용 위치 이름 */
export function stairLabel(s) {
  if (s.name) return s.name
  const gu = s.gu ? s.gu + ' ' : ''
  return `${gu}${s.center[0].toFixed(4)}, ${s.center[1].toFixed(4)}`
}
