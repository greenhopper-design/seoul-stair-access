// 우회거리 / 추가 이동시간 — ※ 예시 추정 ※
// 실제 구현은 OSM 보행도로망(highway=footway|path|residential…)을 그래프로 만들어
// 계단 양 끝점 사이 '계단을 제외한' 최단경로를 구해야 한다(네트워크 분석).
// 현재는 발표 가능한 MVP를 위해 기하 기반 추정식을 쓰고, 화면에 예시 추정으로 표기한다.
// 실제 연결 시 estimateDetour() 를 라우팅 엔진(OSRM/GraphHopper foot 프로파일) 호출로 교체.

const WALK_SPEED_ELDERLY = 0.7 // m/s, 고령자 보행속도 문헌 범위 하단

export const DATA_SOURCE = { real: false, label: '예시 추정' }

/**
 * 계단 직선거리 대비 우회 시 늘어나는 거리(m)와 추가 소요시간(분).
 * 상승고가 클수록 우회로가 등고선을 따라 크게 돌아간다는 가정.
 */
export function estimateDetour(stair) {
  const direct = stair.lengthM
  // 우회 경로 = 평지 우회(직선의 2.2배) + 고저차 1m당 등고선을 따라 약 25m 추가
  // ponytail: 기하 추정식. 실제 보행도로망 라우팅(OSRM foot)으로 교체 시 이 함수만 바꾸면 된다.
  const detourM = Math.min(1500, Math.round(direct * 2.2 + (stair.riseM || 0) * 25))
  const extraM = Math.max(0, detourM - Math.round(direct))
  const extraMin = Math.round((extraM / WALK_SPEED_ELDERLY / 60) * 10) / 10
  return { detourM, extraM, extraMin }
}
