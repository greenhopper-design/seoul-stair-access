import assert from 'node:assert/strict'
import { scoreStair, scoreAll, grade, reasons, DEFAULT_WEIGHTS } from './scoring.js'

const base = {
  stepCount: 0, riseM: 0, elderlyRatio: 0, handrail: true, landing: true,
  nearestElevatorM: 0, detour: { extraM: 0 },
}
const worst = {
  stepCount: 120, riseM: 40, elderlyRatio: 50, handrail: false, landing: false,
  nearestElevatorM: null, detour: { extraM: 2000 },
}

assert.equal(scoreStair(base).score, 0, '최선 조건은 0점')
assert.equal(scoreStair(worst).score, 100, '최악 조건은 100점 (상한 클램프)')

// 가중치가 0인 지표는 점수에 영향이 없어야 한다
const onlyElderly = { burden: 0, rise: 0, elderly: 100, safety: 0, alternative: 0, detour: 0 }
assert.equal(scoreStair({ ...base, elderlyRatio: 15 }, onlyElderly).score, 50)
assert.equal(scoreStair({ ...base, stepCount: 60 }, onlyElderly).score, 0)

// 정보없음(null)은 '있음'보다 나쁘고 '없음'보다 낫다
const sfw = { burden: 0, rise: 0, elderly: 0, safety: 100, alternative: 0, detour: 0 }
const [yes, unknown, no] = [true, null, false].map((v) => scoreStair({ ...base, handrail: v, landing: v }, sfw).score)
assert.ok(yes < unknown && unknown < no, `난간 정보 단계: ${yes} < ${unknown} < ${no}`)

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
