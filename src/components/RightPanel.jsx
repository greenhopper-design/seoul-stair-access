import { grade, reasons } from '../scoring.js'
import { stairLabel } from '../analyze.js'
import DataTag from './DataTag.jsx'

export default function RightPanel({ stair, rank }) {
  if (!stair)
    return (
      <div className="panel right">
        <div className="section"><h2>선택한 계단 정보</h2></div>
        <p className="empty">
          지도에서 계단 마커를 클릭하거나<br />
          아래 TOP 10 목록에서 행을 선택하면<br />
          이 계단이 선정된 이유를 볼 수 있습니다.
        </p>
      </div>
    )

  const g = grade(stair.score)
  const rs = reasons(stair.parts)
  const p = Object.fromEntries(stair.parts.map((x) => [x.key, x]))

  return (
    <div className="panel right">
      <div className="section">
        <h2>선택한 계단 정보</h2>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
          {rank != null && <span className="mono muted">TOP {rank} · </span>}
          {stairLabel(stair)}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="score" style={{ fontSize: 30, lineHeight: 1 }}>{stair.score}</span>
          <span className="muted small">/ 100</span>
          <span className="badge" style={{ color: g.color, marginLeft: 6 }}>개선 필요도 {g.label}</span>
        </div>
      </div>

      <div className="section">
        <h2>계단 정보 <DataTag real>OSM 실시간</DataTag></h2>
        <dl className="kv">
          <dt>계단 수</dt>
          <dd className="mono">{stair.stepCount}단 <span className="small muted">({stair.stepCountSource})</span></dd>
          <dt>계단 길이</dt>
          <dd className="mono">{stair.lengthM.toFixed(1)} m</dd>
          <dt>총 상승고</dt>
          <dd className="mono">{stair.riseM.toFixed(1)} m <span className="small muted">({stair.riseSource})</span></dd>
          <dt>단높이(평균)</dt>
          <dd className="mono">{((stair.riseM / stair.stepCount) * 100).toFixed(0)} cm</dd>
          <dt>디딤판(평균)</dt>
          <dd className="mono">{((stair.lengthM / stair.stepCount) * 100).toFixed(0)} cm</dd>
          <dt>유효폭</dt>
          <dd className="mono">{stair.widthM ? stair.widthM.toFixed(1) + ' m' : '정보 없음'}</dd>
          <dt>난간</dt>
          <dd>{stair.handrail === true ? '있음' : stair.handrail === false ? '없음' : '정보 없음'}</dd>
          <dt>계단참</dt>
          <dd>{stair.landing === true ? '있음' : '정보 없음'}</dd>
          <dt>경사로 병설</dt>
          <dd>{stair.ramp ? '있음' : '없음'}</dd>
          <dt>OSM</dt>
          <dd className="small">
            <a href={`https://www.openstreetmap.org/way/${stair.osmId}`} target="_blank" rel="noreferrer">
              way/{stair.osmId}
            </a>
          </dd>
        </dl>
      </div>

      <div className="section">
        <h2>고령인구 <DataTag /></h2>
        <dl className="kv">
          <dt>자치구</dt><dd>{stair.gu || '확인 불가'}</dd>
          <dt>65세 이상</dt><dd className="mono">{stair.elderlyRatio} %</dd>
        </dl>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          실제 통계가 아닌 예시 데이터입니다. 서울 열린데이터광장 행정동별 등록인구 API 연결 시 대체됩니다.
        </p>
      </div>

      <div className="section">
        <h2>대체 이동수단 <DataTag real>OSM 실시간</DataTag></h2>
        <dl className="kv">
          <dt>가장 가까운</dt>
          <dd>
            {stair.nearestElevatorM == null
              ? '800 m 이내 없음'
              : `${stair.nearestElevator.kind} ${Math.round(stair.nearestElevatorM)} m`}
          </dd>
        </dl>
      </div>

      <div className="section">
        <h2>우회거리 <DataTag>예시 추정</DataTag></h2>
        <dl className="kv">
          <dt>우회 총거리</dt><dd className="mono">{stair.detour.detourM} m</dd>
          <dt>추가 이동거리</dt><dd className="mono">+{stair.detour.extraM} m</dd>
          <dt>추가 소요시간</dt><dd className="mono">+{stair.detour.extraMin} 분 <span className="small muted">(0.7 m/s)</span></dd>
        </dl>
      </div>

      <div className="section">
        <h2>이 계단이 선정된 이유</h2>
        {rs.length === 0 && <p className="small muted">두드러진 위험 요인이 없습니다.</p>}
        {rs.map((r) => (
          <div className="reason" key={r.key}>
            <span>{r.reason}</span>
            <span className="small muted mono" style={{ marginLeft: 'auto' }}>
              기여 {r.contribution.toFixed(1)}점
            </span>
          </div>
        ))}
      </div>

      <div className="section">
        <h2>지표별 정규화 점수</h2>
        {stair.parts.map((m) => (
          <div className="metric" key={m.key} title={m.help}>
            <div className="lbl">
              <span>{m.label}</span>
              <span className="mono muted">
                {m.display}{typeof m.display === 'number' ? m.unit : ''} · {m.norm}점 × 가중치 {m.weight}
              </span>
            </div>
            <div className="bar"><i style={{ width: m.norm + '%', background: grade(m.norm).color }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
