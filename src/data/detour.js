// 우회거리 / 이동시간 — ※ 경로는 예시 추정, 속도는 문헌 기반 ※
//
// 경로: 실제 구현은 OSM 보행도로망(highway=footway|path|residential…)을 그래프로 만들어
// 계단 양 끝점 사이 '계단을 제외한' 최단경로를 구해야 한다(네트워크 분석).
// 현재는 발표 가능한 MVP를 위해 기하 추정식을 쓰고 화면에 예시 추정으로 표기한다.
// 실제 연결 시 estimateDetour() 를 라우팅 엔진(OSRM/GraphHopper foot 프로파일) 호출로 교체.
//
// 속도: Tobler의 보행속도 함수(Tobler 1993)를 쓴다. 경사 S(수직/수평)에 따라
//   W = 6 · exp(−3.5 · |S + 0.05|)  [km/h]
// 평지에서 약 5 km/h, 오르막에서 지수적으로 감소한다. AccessMap 등 접근성 경로탐색
// 연구에서 경사 비용함수의 기준으로 널리 쓰인다.
// 고령자 보행속도는 성인 평균의 약 70% 수준으로 보고되어 ELDERLY_FACTOR 를 곱한다.

const ELDERLY_FACTOR = 0.7

export const DATA_SOURCE = { real: false, label: '예시 추정' }

/** Tobler 보행속도 (m/s). slope = 수직변화 / 수평거리 */
export function walkSpeed(slope) {
  const kmh = 6 * Math.exp(-3.5 * Math.abs(slope + 0.05))
  return (kmh * 1000) / 3600
}

/**
 * 계단을 이용할 때와 우회할 때의 거리·시간.
 * 우회 경로는 대체로 등고선을 따라 완만하게 돌아간다고 보고 평지 속도를 적용한다.
 */
export function estimateDetour(stair) {
  const direct = stair.lengthM
  const rise = stair.riseM || 0

  // 우회 경로 = 평지 우회(직선의 2.2배) + 고저차 1m당 등고선을 따라 약 25m 추가
  // ponytail: 기하 추정식. 실제 보행도로망 라우팅(OSRM foot)으로 교체 시 이 함수만 바꾸면 된다.
  const detourM = Math.min(1500, Math.round(direct * 2.2 + rise * 25))
  const extraM = Math.max(0, detourM - Math.round(direct))

  const stairSpeed = walkSpeed(rise / Math.max(direct, 1)) * ELDERLY_FACTOR
  const flatSpeed = walkSpeed(0) * ELDERLY_FACTOR
  const stairMin = round1(direct / stairSpeed / 60)
  const detourMin = round1(detourM / flatSpeed / 60)

  return {
    detourM,
    extraM,
    stairMin, // 계단을 이용할 때 (분)
    detourMin, // 우회할 때 (분)
    extraMin: round1(detourMin - stairMin),
    stairSpeed: round2(stairSpeed),
    flatSpeed: round2(flatSpeed),
  }
}

const round1 = (v) => Math.round(v * 10) / 10
const round2 = (v) => Math.round(v * 100) / 100
