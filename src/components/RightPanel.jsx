import { grade, reasons } from '../scoring.js'
import { stairLabel } from '../analyze.js'
import DataTag from './DataTag.jsx'

export default function RightPanel({ stair, rank }) {
  if (!stair)
    return (
      <div className="panel right">
        <div className="block tight"><h2>선택 계단</h2></div>
        <p className="empty">
          지도에서 계단 마커를 클릭하거나
          <br />
          하단 TOP 10에서 행을 선택하면
          <br />
          선정 이유와 지표가 표시됩니다.
        </p>
      </div>
    )

  const g = grade(stair.score)
  const key = new Set(reasons(stair.parts).map((r) => r.key))

  return (
    <div className="panel right">
      <div className="detail-head">
        {rank != null && rank <= 10 && <div className="rank-tag">Top {rank}</div>}
        <h2>{stairLabel(stair)}</h2>
      </div>

      <div className="figures">
        <div className="primary-figure">
          <b>{stair.score}</b>
          <span>개선 필요도</span>
        </div>
        <div>
          <b>{stair.stepCount}<u>단</u></b>
          <span>계단 수</span>
        </div>
        <div>
          <b>{stair.riseM.toFixed(1)}<u>m</u></b>
          <span>총 상승고</span>
        </div>
      </div>

      <div className="block tight">
        <span className="grade"><i style={{ background: g.color }} />개선 필요도 {g.label} · {stair.gu || '자치구 확인 불가'}</span>
      </div>

      <div className="block">
        <h2>선정 이유 · 지표</h2>
        {stair.parts.map((m) => (
          <div className={'metric' + (key.has(m.key) ? ' key' : '')} key={m.key} title={m.help}>
            <div className="lbl">
              <span>{m.label}</span>
              <em>{m.norm}점 × {m.weight}</em>
            </div>
            <div className="bar"><i style={{ width: m.norm + '%', background: grade(m.norm).color }} /></div>
            <div className="sub">
              {m.display}
              {typeof m.display === 'number' ? m.unit : ''}
              {key.has(m.key) && ` · ${m.reason} · 기여 ${m.contribution.toFixed(1)}점`}
            </div>
          </div>
        ))}
      </div>

      <div className="block">
        <h2>계단 정보 <DataTag real>OSM 실시간</DataTag></h2>
        <dl className="kv">
          <dt>계단 수</dt>
          <dd className="num">{stair.stepCount}단 <span className="small muted">{stair.stepCountSource}</span></dd>
          <dt>계단 길이</dt>
          <dd className="num">{stair.lengthM.toFixed(1)} m</dd>
          <dt>총 상승고</dt>
          <dd className="num">{stair.riseM.toFixed(1)} m <span className="small muted">{stair.riseSource}</span></dd>
          <dt>단높이 평균</dt>
          <dd className="num">{((stair.riseM / stair.stepCount) * 100).toFixed(0)} cm</dd>
          <dt>디딤판 평균</dt>
          <dd className="num">{((stair.lengthM / stair.stepCount) * 100).toFixed(0)} cm</dd>
          <dt>유효폭</dt>
          <dd className="num">{stair.widthM ? stair.widthM.toFixed(1) + ' m' : '정보 없음'}</dd>
          <dt>난간</dt>
          <dd>{stair.handrail === true ? '있음' : stair.handrail === false ? '없음' : '정보 없음'}</dd>
          <dt>계단참</dt>
          <dd>{stair.landing === true ? '있음' : '정보 없음'}</dd>
          <dt>경사로 병설</dt>
          <dd>{stair.ramp ? '있음' : '없음'}</dd>
          <dt>원본</dt>
          <dd className="small">
            <a href={`https://www.openstreetmap.org/way/${stair.osmId}`} target="_blank" rel="noreferrer">
              OSM way/{stair.osmId}
            </a>
          </dd>
        </dl>
      </div>

      <div className="block">
        <h2>주변 고령인구 <DataTag /></h2>
        <dl className="kv">
          <dt>자치구</dt><dd>{stair.gu || '확인 불가'}</dd>
          <dt>65세 이상</dt><dd className="num">{stair.elderlyRatio} %</dd>
        </dl>
        <p className="note-text">
          실제 통계가 아닌 예시 데이터. 서울 열린데이터광장 행정동별 등록인구 API 연결 시 대체됨.
        </p>
      </div>

      <div className="block">
        <h2>대체 이동수단 <DataTag real>OSM 실시간</DataTag></h2>
        <dl className="kv">
          <dt>최근접</dt>
          <dd>
            {stair.nearestElevatorM == null
              ? '800 m 이내 없음'
              : `${stair.nearestElevator.kind} ${Math.round(stair.nearestElevatorM)} m`}
          </dd>
        </dl>
      </div>

      <div className="block">
        <h2>우회 이동 <DataTag>예시 추정</DataTag></h2>
        <dl className="kv">
          <dt>우회 총거리</dt><dd className="num">{stair.detour.detourM} m</dd>
          <dt>추가 거리</dt><dd className="num">+{stair.detour.extraM} m</dd>
          <dt>추가 시간</dt><dd className="num">+{stair.detour.extraMin} 분 <span className="small muted">0.7 m/s</span></dd>
        </dl>
      </div>
    </div>
  )
}
