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
    label: '법정 안전기준 미충족',
    unit: '',
    help:
      '건축물의 피난·방화구조 등의 기준에 관한 규칙 제15조. 이 계단에 법적으로 요구되는 ' +
      '난간·계단참·단높이 항목만 평가한다. 충족 0 / 정보 없음 60 / 미충족 100.',
    value: (s) => legalText(s),
    norm: (s) => legalNorm(s),
    reason: '법정 난간·계단참 기준 미충족 또는 정보 없음',
  },
  {
    key: 'alternative',
    label: '대체 이동수단 부족',
    unit: '',
    help:
      '같은 동선의 에스컬레이터·경사로가 있으면 부담이 크게 줄고, 없으면 가장 가까운 ' +
      '엘리베이터·에스컬레이터까지의 거리로 본다. 400m 이상이면 100점.',
    value: (s) =>
      s.selfAlt ? s.selfAlt : s.nearestElevatorM == null ? '없음' : Math.round(s.nearestElevatorM) + 'm',
    norm: (s) =>
      s.selfAlt === '에스컬레이터 병설'
        ? 0
        : s.selfAlt === '경사로 병설'
          ? 20
          : s.nearestElevatorM == null
            ? 100
            : clamp((s.nearestElevatorM / 400) * 100),
    reason: '가까운 대체 이동수단 없음',
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

// 건축물의 피난·방화구조 등의 기준에 관한 규칙 제15조
//  - 높이 1m 초과 계단: 양옆에 난간 설치
//  - 높이 3m 초과 계단: 높이 3m 이내마다 유효너비 120cm 이상의 계단참
//  - (공동주택 외) 단높이 20cm 이하, 단너비 24cm 이상
export const LEGAL = { handrailOverM: 1, landingEveryM: 3, maxRiserCm: 20, minTreadCm: 24 }

const STATE_SCORE = { ok: 0, unknown: 60, fail: 100 }

/** 이 계단에 '법적으로 요구되는' 항목만 골라 충족/미확인/미충족을 판정한다. */
export function legalChecks(s) {
  const out = []
  if (s.riseM > LEGAL.handrailOverM) {
    out.push({
      name: '난간',
      need: '양옆 설치 의무',
      state: s.handrail === true ? 'ok' : s.handrail === false ? 'fail' : 'unknown',
    })
  }
  if (s.riseM > LEGAL.landingEveryM) {
    out.push({
      name: '계단참',
      need: `${Math.floor(s.riseM / LEGAL.landingEveryM)}개소 이상`,
      state: s.landing === true ? 'ok' : s.landing === false ? 'fail' : 'unknown',
    })
  }
  // 단높이는 OSM에 계단 수가 실제로 기록된 경우에만 평가한다.
  // 계단 수를 상승고에서 환산한 경우 단높이가 상수로 고정되어 판정이 순환논리가 되기 때문이다.
  if (s.stepCountSource === 'OSM step_count' && s.stepCount > 0) {
    const riser = (s.riseM / s.stepCount) * 100
    out.push({
      name: '단높이',
      need: `${LEGAL.maxRiserCm}cm 이하`,
      actual: `${riser.toFixed(0)}cm`,
      state: riser <= LEGAL.maxRiserCm ? 'ok' : 'fail',
    })
  }
  return out
}

function legalNorm(s) {
  const checks = legalChecks(s)
  if (!checks.length) return 0 // 높이 1m 이하 — 법정 의무 없음
  return checks.reduce((a, c) => a + STATE_SCORE[c.state], 0) / checks.length
}

function legalText(s) {
  const checks = legalChecks(s)
  if (!checks.length) return '해당 없음'
  const fail = checks.filter((c) => c.state === 'fail').length
  const unknown = checks.filter((c) => c.state === 'unknown').length
  if (!fail && !unknown) return `${checks.length}개 항목 충족`
  return `${checks.length}개 항목 중 미충족 ${fail} · 미확인 ${unknown}`
}

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
