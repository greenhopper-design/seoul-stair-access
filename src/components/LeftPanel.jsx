import { useState } from 'react'
import { searchPlace } from '../data/overpass.js'
import { METRICS, DEFAULT_WEIGHTS } from '../scoring.js'
import DataTag from './DataTag.jsx'

export default function LeftPanel({ region, onRegion, onAnalyze, onUseMapView, weights, onWeights, loading, status, stats, elderly }) {
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
      if (!r.length) setErr('검색 결과 없음. 예: 해방촌, 창신동, 이화동, 금호동')
    } catch (e2) {
      setErr('지역 검색 실패: ' + e2.message)
    } finally {
      setSearching(false)
    }
  }

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)

  return (
    <div className="panel left">
      <div className="block">
        <h2>분석 영역</h2>
        <form onSubmit={search}>
          <input
            type="text"
            value={q}
            placeholder="동·역·지역명"
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="row" style={{ marginTop: 5 }}>
            <button type="submit" disabled={searching} style={{ flex: 1 }}>
              {searching ? '검색 중' : '검색'}
            </button>
            <button type="button" onClick={onUseMapView} style={{ flex: 1 }}>
              현재 지도 영역
            </button>
          </div>
        </form>
        {err && <p className="status err">{err}</p>}
        {results?.length > 0 && (
          <div className="results">
            {results.map((r, i) => (
              <button key={i} onClick={() => { onRegion(r); setResults(null) }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <p className={'region' + (region ? ' set' : '')}>
          {region ? region.label : '영역 미선택 — 지역을 검색하거나 지도를 이동한 뒤 현재 지도 영역을 사용'}
        </p>
      </div>

      <div className="block tight">
        <button className="btn-primary" onClick={onAnalyze} disabled={loading || !region}>
          {loading ? '분석 중' : '분석 시작'}
        </button>
        {status && <p className={'status' + (status.startsWith('분석 실패') ? ' err' : '')}>{status}</p>}
        {stats && (
          <p className="status">
            대체 이동수단 {stats.elevators}개
            {stats.total > stats.shown && ` · 영역 내 계단 ${stats.total}개 중 길이 상위 ${stats.shown}개만 분석`}
          </p>
        )}
      </div>

      <div className="block">
        <h2>데이터 출처</h2>
        <dl className="src">
          <dt>계단 위치·속성</dt><dd>OpenStreetMap <DataTag real>실시간</DataTag></dd>
          <dt>총 상승고</dt><dd>Copernicus DEM 90m <DataTag real>실측</DataTag></dd>
          <dt>대체 이동수단</dt><dd>OSM 엘리베이터·에스컬레이터 <DataTag real>실시간</DataTag></dd>
          <dt>고령인구</dt>
          <dd>
            {elderly?.real ? (
              <>생활인구 자치구 단위 <DataTag real>실측</DataTag></>
            ) : (
              <>자치구 단위 <DataTag /></>
            )}
          </dd>
          <dt>우회거리</dt><dd>보행도로망 경로탐색 <DataTag real>상위 10개</DataTag></dd>
          <dt>보행속도</dt><dd>Tobler 함수 <DataTag real>문헌</DataTag></dd>
          <dt>안전기준</dt><dd>피난·방화구조 규칙 제15조 <DataTag real>법령</DataTag></dd>
        </dl>
        <p className="note-text">
          우회거리는 상위 10개 계단만 실제 보행도로망 경로탐색으로 계산하고, 나머지는 기하
          추정값이다. 고령인구는 자치구 단위이며, 행정동 단위로 올리려면 행정동 경계 데이터가
          필요하다.
        </p>
      </div>

      <div className="block">
        <h2>
          가중치 <span className="small muted" style={{ textTransform: 'none', letterSpacing: 0 }}>프로토타입 값</span>
        </h2>
        {METRICS.map((m) => (
          <div className="weight" key={m.key}>
            <div className="lbl">
              <b>{m.label}</b>
              <span>{weights[m.key]}</span>
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
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => onWeights({ ...DEFAULT_WEIGHTS })}>초기값</button>
          <span className="small muted num">합계 {weightSum} · 가중평균으로 0–100 정규화</span>
        </div>
      </div>
    </div>
  )
}
