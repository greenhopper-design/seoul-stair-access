// 저장본 대체 경로 검증 — 공개 Overpass가 전부 죽어도 같은 영역을 다시 분석할 수 있어야 한다.
import assert from 'node:assert/strict'

// 브라우저 전역 스텁
globalThis.location = { href: 'http://test.local/' }
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
}

const OK_RESPONSE = {
  elements: [
    {
      type: 'way',
      id: 1,
      tags: { highway: 'steps', step_count: '30', handrail: 'yes' },
      geometry: [
        { lat: 37.57, lon: 127.01 },
        { lat: 37.5705, lon: 127.0105 },
      ],
    },
    { type: 'node', id: 2, lat: 37.5702, lon: 127.0102, tags: { highway: 'elevator' } },
  ],
}

let mode = 'ok'
globalThis.fetch = async () => {
  if (mode === 'fail') throw new Error('network down')
  return { ok: true, status: 200, json: async () => OK_RESPONSE }
}

const { fetchArea } = await import('./overpass.js')
const bbox = [37.57, 127.01, 37.58, 127.02]

// 1) 정상 수집 — 한 번의 쿼리에서 계단과 대체수단이 함께 나온다
const live = await fetchArea(bbox)
assert.equal(live.stairs.length, 1)
assert.equal(live.elevators.length, 1)
assert.equal(live.stairs[0].stepCountTag, 30)
assert.equal(live.stairs[0].handrail, true)
assert.equal(live.cachedAt, null, '실시간 수집은 저장본 표시가 없어야 한다')

// 2) 서버가 전부 죽어도 같은 영역은 저장본으로 응답하고, 수집 시각을 함께 돌려준다
mode = 'fail'
const cached = await fetchArea(bbox)
assert.equal(cached.stairs.length, 1)
assert.ok(cached.cachedAt > 0, '저장본에는 수집 시각이 있어야 한다')

// 3) 저장본이 없는 영역은 조용히 빈 값을 주지 않고 실패를 알린다
await assert.rejects(() => fetchArea([38.0, 128.0, 38.01, 128.01]), /Overpass/)

// 4) 저장 영역은 최대 8개까지만 유지한다
mode = 'ok'
for (let i = 0; i < 12; i++) await fetchArea([37 + i / 100, 127, 37.01 + i / 100, 127.01])
assert.ok(store.size <= 8, `저장 영역 수 ${store.size} ≤ 8`)

console.log('overpass.test.mjs: 모든 검증 통과')
