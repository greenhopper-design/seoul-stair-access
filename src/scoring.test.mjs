import assert from 'node:assert/strict'
import { scoreStair, scoreAll, grade, reasons, DEFAULT_WEIGHTS } from './scoring.js'

// 법정 기준 평가는 '이 계단에 요구되는 항목'만 보므로 stepCountSource까지 맞춰 둔다
const base = {
  stepCount: 0, riseM: 0, elderlyRatio: 0, handrail: true, landing: true,
  stepCountSource: 'OSM step_count', nearestElevatorM: 0, selfAlt: null, detour: { extraM: 0 },
}
const worst = {
  stepCount: 120, riseM: 40, elderlyRatio: 50, handrail: false, landing: false,
  stepCountSource: 'OSM step_count', nearestElevatorM: null, selfAlt: null, detour: { extraM: 2000 },
}

assert.equal(scoreStair(base).score, 0, '최선 조건은 0점')
assert.equal(scoreStair(worst).score, 100, '최악 조건은 100점 (상한 클램프)')

// 가중치가 0인 지표는 점수에 영향이 없어야 한다
const onlyElderly = { burden: 0, rise: 0, elderly: 100, safety: 0, alternative: 0, detour: 0 }
assert.equal(scoreStair({ ...base, elderlyRatio: 10 }, onlyElderly).score, 50) // 상한 20%의 절반
assert.equal(scoreStair({ ...base, stepCount: 60 }, onlyElderly).score, 0)

// 법정 기준: 정보없음(null)은 '있음'보다 나쁘고 '없음'보다 낫다
const sfw = { burden: 0, rise: 0, elderly: 0, safety: 100, alternative: 0, detour: 0 }
const tall = { ...base, riseM: 10, stepCount: 60 } // 난간·계단참 의무 대상
const [yes, unknown, no] = [true, null, false].map(
  (v) => scoreStair({ ...tall, handrail: v, landing: v }, sfw).score
)
assert.ok(yes < unknown && unknown < no, `난간 정보 단계: ${yes} < ${unknown} < ${no}`)

// 높이 1m 이하 계단은 난간·계단참 의무가 없으므로 정보가 없어도 감점하지 않는다
assert.equal(scoreStair({ ...base, riseM: 0.8, handrail: null, landing: null }, sfw).score, 0)

// 단높이는 OSM에 계단 수가 실제로 기록된 경우에만 평가한다 (환산값이면 순환논리)
const steep = { ...tall, stepCount: 20, handrail: true, landing: true } // 단높이 50cm
assert.ok(scoreStair(steep, sfw).score > 0, '기록된 계단 수로는 단높이 초과를 잡아낸다')
assert.equal(scoreStair({ ...steep, stepCountSource: '상승고 기반 환산' }, sfw).score, 0)

// 에스컬레이터가 병설된 계단은 대체 이동수단 감점이 없다
const altw = { burden: 0, rise: 0, elderly: 0, safety: 0, alternative: 100, detour: 0 }
assert.equal(scoreStair({ ...worst, selfAlt: '에스컬레이터 병설' }, altw).score, 0)
assert.equal(scoreStair(worst, altw).score, 100)

// 정렬 및 등급
const sorted = scoreAll([base, worst], DEFAULT_WEIGHTS)
assert.equal(sorted[0].score, 100)
assert.equal(grade(100).label, '매우 높음')
assert.equal(grade(0).label, '낮음')

// 선정 이유는 기여도 순
const { parts } = scoreStair(worst)
const r = reasons(parts)
assert.equal(r.length, 6)
assert.ok(r[0].contribution >= r[1].contribution)

// 가중치 합이 바뀌어도 0~100 범위 유지
const doubled = Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, v * 2]))
assert.equal(scoreStair(worst, doubled).score, scoreStair(worst, DEFAULT_WEIGHTS).score)

console.log('scoring.test.mjs: 모든 검증 통과')
