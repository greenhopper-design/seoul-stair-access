import { useMemo, useRef, useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import LeftPanel from './components/LeftPanel.jsx'
import MapView from './components/MapView.jsx'
import RightPanel from './components/RightPanel.jsx'
import TopTen from './components/TopTen.jsx'
import { analyzeArea } from './analyze.js'
import { scoreAll, DEFAULT_WEIGHTS } from './scoring.js'

export default function App() {
  const mapRef = useRef(null)
  const [region, setRegion] = useState(null)
  const [raw, setRaw] = useState({ stairs: [], elevators: [], total: 0 })
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS })
  const [selected, setSelected] = useState(null)
  const [focus, setFocus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  // 가중치가 바뀌면 재계산·재정렬 (재분석 불필요)
  const stairs = useMemo(() => scoreAll(raw.stairs, weights), [raw.stairs, weights])
  const selectedStair = stairs.find((s) => s.id === selected) || null
  const selectedRank = selectedStair ? stairs.indexOf(selectedStair) + 1 : null

  // 하단 상태 표시줄용 요약
  const summary = useMemo(() => {
    if (!stairs.length) return null
    return {
      count: stairs.length,
      avg: (stairs.reduce((a, s) => a + s.score, 0) / stairs.length).toFixed(1),
      critical: stairs.filter((s) => s.score >= 80).length,
      noElevator: stairs.filter((s) => s.nearestElevatorM == null).length,
      selected: selectedRank != null ? `${selectedRank}위` : null,
    }
  }, [stairs, selectedRank])

  const useMapView = useCallback(() => {
    const b = mapRef.current?.getBounds()
    if (!b) return
    setRegion({
      label: '현재 지도 영역',
      bbox: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()],
      noFit: true,
    })
  }, [])

  async function analyze() {
    if (!region) return
    setLoading(true)
    setSelected(null)
    setStatus('분석 시작')
    try {
      const r = await analyzeArea(region.bbox, setStatus)
      setRaw(r)
      setStatus(
        r.stairs.length
          ? `분석 완료 — ${r.gu ? r.gu + ' ' : ''}계단 ${r.stairs.length}개`
          : '이 영역에서 OpenStreetMap 계단(highway=steps) 데이터를 찾지 못했습니다. 영역을 넓혀 보세요.'
      )
    } catch (e) {
      setStatus('분석 실패: ' + e.message + ' — Overpass 서버가 혼잡할 수 있습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <Header />
      <div className="main">
        <LeftPanel
          region={region}
          onRegion={setRegion}
          onUseMapView={useMapView}
          onAnalyze={analyze}
          weights={weights}
          onWeights={setWeights}
          loading={loading}
          status={status}
          stats={raw.stairs.length ? { shown: raw.stairs.length, total: raw.total, elevators: raw.elevators.length } : null}
        />
        <div className="center">
          <MapView
            mapRef={mapRef}
            stairs={stairs}
            elevators={raw.elevators}
            selected={selected}
            onSelect={setSelected}
            region={region?.noFit ? null : region}
            focus={focus}
          />
          <TopTen
            stairs={stairs}
            selected={selected}
            onSelect={setSelected}
            onFocus={(id) => setFocus({ id, t: Date.now() })}
            summary={summary}
          />
        </div>
        <RightPanel stair={selectedStair} rank={selectedRank} />
      </div>
    </div>
  )
}
