import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { grade } from '../scoring.js'

const SEOUL = [37.5665, 126.978]

export default function MapView({ mapRef, stairs, elevators, selected, onSelect, region, focus }) {
  const el = useRef(null)
  const layerRef = useRef(null)
  const markersRef = useRef(new Map())

  // 지도 초기화 (1회)
  useEffect(() => {
    const map = L.map(el.current, {
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    }).setView(SEOUL, 12)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => map.remove()
  }, [mapRef])

  // 선택 지역으로 이동
  useEffect(() => {
    if (region && mapRef.current) {
      const [s, w, n, e] = region.bbox
      mapRef.current.fitBounds([[s, w], [n, e]], { padding: [20, 20] })
    }
  }, [region, mapRef])

  // 계단·엘리베이터 렌더
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    markersRef.current.clear()

    // 대체 이동수단은 참조 정보이므로 무채색 작은 표식
    elevators.forEach((e) => {
      L.circleMarker([e.lat, e.lon], {
        radius: 3,
        color: '#6b6b6b',
        weight: 1,
        fillColor: '#ffffff',
        fillOpacity: 1,
      })
        .bindTooltip(e.kind, { direction: 'top' })
        .addTo(layer)
    })

    stairs.forEach((s, i) => {
      const g = grade(s.score)
      const isTop = i < 10
      L.polyline(s.geometry, {
        color: g.color,
        weight: isTop ? 4 : 2.5,
        opacity: 0.9,
      }).addTo(layer)

      const m = L.circleMarker(s.center, {
        radius: isTop ? 8 : 5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: g.color,
        fillOpacity: 1,
      })
        .bindTooltip(
          `${isTop ? `TOP ${i + 1} · ` : ''}${s.name || '계단'} · 개선 필요도 ${s.score} (${g.label})`,
          { direction: 'top' }
        )
        .on('click', () => onSelect(s.id))
        .addTo(layer)
      m._gradeColor = g.color
      m._baseRadius = isTop ? 8 : 5

      if (isTop) {
        L.marker(s.center, {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<div style="font:600 10px/14px Pretendard,Inter,sans-serif;color:#fff;text-align:center;width:16px">${i + 1}</div>`,
            iconSize: [16, 14],
            iconAnchor: [8, 7],
          }),
        }).addTo(layer)
      }
      markersRef.current.set(s.id, m)
    })
  }, [stairs, elevators, onSelect])

  // 선택된 대상만 명확히 강조
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const on = id === selected
      m.setStyle({ color: on ? '#171717' : '#ffffff', weight: on ? 3 : 1.5 })
      m.setRadius(on ? m._baseRadius + 2 : m._baseRadius)
      if (on) m.bringToFront()
    })
  }, [selected, stairs])

  // 지도에서 위치 보기
  useEffect(() => {
    if (!focus || !mapRef.current) return
    const s = stairs.find((x) => x.id === focus.id)
    if (s) mapRef.current.setView(s.center, Math.max(mapRef.current.getZoom(), 17), { animate: true })
  }, [focus, stairs, mapRef])

  return (
    <div className="canvas">
      <div className="map" ref={el} />
      <div className="legend">
        <b>개선 필요도</b>
        <div><i style={{ background: '#c2410c' }} />80–100 매우 높음</div>
        <div><i style={{ background: '#d9784f' }} />60–79 높음</div>
        <div><i style={{ background: '#e0b19b' }} />40–59 보통</div>
        <div><i style={{ background: '#b5b3ad' }} />0–39 낮음</div>
        <div><i style={{ background: '#fff', border: '1px solid #6b6b6b', borderRadius: '50%' }} />엘리베이터</div>
      </div>
    </div>
  )
}
