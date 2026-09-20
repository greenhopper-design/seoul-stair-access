// 개선 필요도 점수 — 각 지표를 0~100으로 정규화한 뒤 가중 평균한다.
// 가중치는 확정된 연구값이 아니라 프로토타입 값이며 UI에서 조절 가능하다.

export const METRICS = [
  {
    key: 'burden',
    label: '계단 부담도',
    unit: '단',
    help: '계단 수 · 길이 기반. 60단 이상을 100점으로 본다.',
    value: (s) => s.stepCount,
    norm: (s) => clamp((s.stepCount / 60) * 100),
    reason: '계단 수가 많음',
  },
  {
    key: 'rise',
    label: '총 상승고',
    unit: 'm',
    help: '계단 시작점과 끝점의 고도차. 20m 이상을 100점으로 본다.',
    value: (s) => round1(s.riseM),
    norm: (s) => clamp((s.riseM / 20) * 100),
    reason: '총 상승고가 높음',
  },
  {
    key: 'elderly',
    label: '주변 고령인구',
    unit: '%',
    help: '65세 이상 인구비율. 30% 이상을 100점으로 본다.',
    value: (s) => s.elderlyRatio,
    norm: (s) => clamp((s.elderlyRatio / 30) * 100),
    reason: '주변 고령인구 비율이 높음',
  },
  {
    key: 'safety',
    label: '난간·계단참 부족',
    unit: '',
    help: '난간/계단참이 없거나 정보가 없으면 위험도를 높게 본다.',
    value: (s) => safetyText(s),
    norm: (s) => (facility(s.handrail) + facility(s.landing)) / 2,
    reason: '난간 또는 계단참 정보 부족',
  },
  {
    key: 'alternative',
    label: '대체 이동수단 부족',
    unit: 'm',
    help: '가장 가까운 엘리베이터까지의 거리. 400m 이상이면 100점.',
    value: (s) => (s.nearestElevatorM == null ? '없음' : Math.round(s.nearestElevatorM)),
    norm: (s) => (s.nearestElevatorM == null ? 100 : clamp((s.nearestElevatorM / 400) * 100)),
    reason: '가까운 대체 엘리베이터 없음',
  },
  {
    key: 'detour',
    label: '우회거리 증가',
    unit: 'm',
    help: '계단을 피해 우회할 때 늘어나는 거리. 600m 이상을 100점으로 본다.',
    value: (s) => Math.round(s.detour.extraM),
    norm: (s) => clamp((s.detour.extraM / 600) * 100),
    reason: '우회 시 이동거리가 크게 증가함',
  },
]

export const DEFAULT_WEIGHTS = {
  burden: 25,
  rise: 20,
  elderly: 20,
  safety: 10,
  alternative: 15,
  detour: 10,
}

const clamp = (v) => Math.max(0, Math.min(100, v))
const round1 = (v) => Math.round(v * 10) / 10
// 있음 → 0, 정보없음 → 60, 없음 → 100
const facility = (v) => (v === true ? 0 : v === false ? 100 : 60)
const safetyText = (s) =>
  `난간 ${s.handrail === true ? '있음' : s.handrail === false ? '없음' : '정보없음'} / 계단참 ${
    s.landing === true ? '있음' : s.landing === false ? '없음' : '정보없음'
  }`

/** 계단 하나의 점수와 지표별 기여도 */
export function scoreStair(stair, weights = DEFAULT_WEIGHTS) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const parts = METRICS.map((m) => {
    const norm = clamp(m.norm(stair))
    const w = weights[m.key] ?? 0
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      help: m.help,
      display: m.value(stair),
      norm: Math.round(norm),
      weight: w,
      contribution: (norm * w) / total, // 최종 점수에서 차지하는 실제 몫
      reason: m.reason,
    }
  })
  const score = Math.round(parts.reduce((a, p) => a + p.contribution, 0))
  return { score, parts }
}

export function scoreAll(stairs, weights) {
  return stairs
    .map((s) => ({ ...s, ...scoreStair(s, weights) }))
    .sort((a, b) => b.score - a.score)
}

// 색은 강조색(--accent) 하나의 명도 단계다. 색상값은 index.css의 --l1~--l4와 같다.
export function grade(score) {
  if (score >= 80) return { label: '매우 높음', color: '#c2410c', level: 4 }
  if (score >= 60) return { label: '높음', color: '#d9784f', level: 3 }
  if (score >= 40) return { label: '보통', color: '#e0b19b', level: 2 }
  return { label: '낮음', color: '#b5b3ad', level: 1 }
}

/** 선정 이유 — 기여도 상위 지표 중 정규화 점수가 높은 것 */
export function reasons(parts, threshold = 55) {
  return [...parts]
    .filter((p) => p.norm >= threshold && p.weight > 0)
    .sort((a, b) => b.contribution - a.contribution)
}
