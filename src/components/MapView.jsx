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
    const map = L.map(el.current, { zoomControl: true, preferCanvas: true }).setView(SEOUL, 12)
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

    elevators.forEach((e) => {
      L.circleMarker([e.lat, e.lon], {
        radius: 3, color: '#3a6ea5', weight: 1, fillColor: '#8fb6db', fillOpacity: 0.9,
      })
        .bindTooltip(e.kind, { direction: 'top' })
        .addTo(layer)
    })

    stairs.forEach((s, i) => {
      const g = grade(s.score)
      const isTop = i < 10
      L.polyline(s.geometry, { color: g.color, weight: isTop ? 5 : 3, opacity: 0.85 }).addTo(layer)
      const m = L.circleMarker(s.center, {
        radius: isTop ? 9 : 6,
        color: isTop ? '#111' : g.color,
        weight: isTop ? 2 : 1,
        fillColor: g.color,
        fillOpacity: 0.9,
      })
        .bindTooltip(
          `${isTop ? `TOP ${i + 1} · ` : ''}${s.name || '계단'} · 개선 필요도 ${s.score}점 (${g.label})`,
          { direction: 'top' }
        )
        .on('click', () => onSelect(s.id))
        .addTo(layer)
      if (isTop) {
        L.marker(s.center, {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<div style="font:700 10px/14px sans-serif;color:#fff;text-align:center;width:18px">${i + 1}</div>`,
            iconSize: [18, 14],
            iconAnchor: [9, 7],
          }),
        }).addTo(layer)
      }
      markersRef.current.set(s.id, m)
    })
  }, [stairs, elevators, onSelect])

  // 선택 강조
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      m.setStyle({ color: id === selected ? '#000' : m.options.fillColor, weight: id === selected ? 4 : m.options.weight })
    })
  }, [selected, stairs])

  // 지도에서 위치 보기
  useEffect(() => {
    if (!focus || !mapRef.current) return
    const s = stairs.find((x) => x.id === focus.id)
    if (s) mapRef.current.setView(s.center, Math.max(mapRef.current.getZoom(), 17), { animate: true })
  }, [focus, stairs, mapRef])

  return (
    <div className="maprel">
      <div className="map" ref={el} style={{ width: '100%' }} />
      <div className="legend">
        <div><i style={{ background: '#b00020' }} />80–100 매우 높음</div>
        <div><i style={{ background: '#d9762b' }} />60–79 높음</div>
        <div><i style={{ background: '#8a8a3f' }} />40–59 보통</div>
        <div><i style={{ background: '#7a7a7a' }} />0–39 낮음</div>
        <div><i style={{ background: '#8fb6db', border: '1px solid #3a6ea5' }} />엘리베이터</div>
      </div>
    </div>
  )
}
