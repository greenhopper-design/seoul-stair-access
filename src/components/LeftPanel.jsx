import { useState } from 'react'
import { searchPlace } from '../data/overpass.js'
import { METRICS, DEFAULT_WEIGHTS } from '../scoring.js'
import DataTag from './DataTag.jsx'

export default function LeftPanel({ region, onRegion, onAnalyze, onUseMapView, weights, onWeights, loading, status, stats }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState(null)

  async function search(e) {
    e.preventDefault()
    if (!q.trim()) return
    setSearching(true)
    setErr(null)
    try {
      const r = await searchPlace(q.trim())
      setResults(r)
      if (!r.length) setErr('검색 결과가 없습니다. 예: 해방촌, 창신동, 이화동, 금호동')
    } catch (e2) {
      setErr('지역 검색 실패: ' + e2.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="panel left">
      <div className="section">
        <h2>지역 검색</h2>
        <form onSubmit={search}>
          <input
            type="text"
            value={q}
            placeholder="동·역·지역명 (예: 창신동)"
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button type="submit" disabled={searching} style={{ flex: 1 }}>
              {searching ? '검색 중…' : '검색'}
            </button>
            <button type="button" onClick={onUseMapView} style={{ flex: 1 }}>
              현재 지도 영역
            </button>
          </div>
        </form>
        {err && <p className="err">{err}</p>}
        {results?.length > 0 && (
          <div className="results">
            {results.map((r, i) => (
              <button key={i} onClick={() => { onRegion(r); setResults(null) }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          선택 지역: {region ? region.label : '없음 — 지역을 검색하거나 지도를 이동한 뒤 현재 지도 영역을 사용하세요.'}
        </p>
      </div>

      <div className="section">
        <button className="primary" onClick={onAnalyze} disabled={loading || !region}>
          {loading ? '분석 중…' : '분석 시작'}
        </button>
        {status && <p className="small muted" style={{ marginBottom: 0 }}>{status}</p>}
        {stats && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            계단 {stats.shown}개 분석{stats.total > stats.shown && ` (영역 내 ${stats.total}개 중 길이 상위 ${stats.shown}개)`}
            {' · '}엘리베이터 {stats.elevators}개
          </p>
        )}
      </div>

      <div className="section">
        <h2>분석 조건 · 데이터 출처</h2>
        <div className="kv">
          <dt>계단 위치·속성</dt><dd>OpenStreetMap <DataTag real>실시간</DataTag></dd>
          <dt>총 상승고</dt><dd>Copernicus DEM 90m <DataTag real>실측</DataTag></dd>
          <dt>대체 이동수단</dt><dd>OSM 엘리베이터 <DataTag real>실시간</DataTag></dd>
          <dt>고령인구</dt><dd>자치구 단위 <DataTag /></dd>
          <dt>우회거리</dt><dd>기하 추정식 <DataTag>예시 추정</DataTag></dd>
        </div>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
          고령인구는 서울 열린데이터광장 행정동별 연령별 등록인구 API, 우회거리는 OSM 보행도로망
          네트워크 분석으로 교체 예정입니다. 현재 값은 실제 통계가 아닙니다.
        </p>
      </div>

      <div className="section">
        <h2>가중치 조절 (프로토타입 값)</h2>
        {METRICS.map((m) => (
          <div className="weight" key={m.key}>
            <div className="lbl">
              <span>{m.label}</span>
              <span className="mono muted">{weights[m.key]}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={weights[m.key]}
              onChange={(e) => onWeights({ ...weights, [m.key]: Number(e.target.value) })}
            />
          </div>
        ))}
        <div className="row">
          <button onClick={() => onWeights({ ...DEFAULT_WEIGHTS })}>초기값으로</button>
          <span className="small muted mono">
            합계 {Object.values(weights).reduce((a, b) => a + b, 0)} (가중 평균으로 0~100 정규화)
          </span>
        </div>
      </div>
    </div>
  )
}
