import { grade } from '../scoring.js'
import { stairLabel } from '../analyze.js'

export default function TopTen({ stairs, selected, onSelect, onFocus, summary }) {
  const top = stairs.slice(0, 10)
  return (
    <div className="results-panel">
      <header>
        <h2>개선 필요 계단 TOP 10</h2>
        {summary ? (
          <div className="stats">
            <span>분석 계단 <b>{summary.count}</b></span>
            <span>평균 점수 <b>{summary.avg}</b></span>
            <span>80점 이상 <b>{summary.critical}</b></span>
            <span>대체수단 없음 <b>{summary.noElevator}</b></span>
            <span>{summary.selected ? `선택 ${summary.selected}` : '선택 없음'}</span>
          </div>
        ) : (
          <div className="stats"><span>분석 전</span></div>
        )}
      </header>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th className="l">순위</th>
              <th className="l">위치</th>
              <th>개선 필요도</th>
              <th className="l">등급</th>
              <th>계단 수</th>
              <th>총 상승고</th>
              <th>고령인구</th>
              <th className="l">대체 이동수단</th>
              <th>우회 추가거리</th>
              <th className="l"></th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, i) => {
              const g = grade(s.score)
              return (
                <tr
                  key={s.id}
                  className={s.id === selected ? 'sel' : ''}
                  onClick={() => onSelect(s.id)}
                >
                  <td className="l rank">{i + 1}</td>
                  <td className="l">{stairLabel(s)}</td>
                  <td><span className="score">{s.score}</span></td>
                  <td className="l">
                    <span className="grade"><i style={{ background: g.color }} />{g.label}</span>
                  </td>
                  <td className="num">{s.stepCount}단</td>
                  <td className="num">{s.riseM.toFixed(1)} m</td>
                  <td className="num">{s.elderlyRatio}%</td>
                  <td className="l">
                    {s.nearestElevatorM == null ? '없음' : `${Math.round(s.nearestElevatorM)} m`}
                  </td>
                  <td className="num">+{s.detour.extraM} m</td>
                  <td className="l">
                    <button
                      title="지도에서 위치 보기"
                      onClick={(e) => { e.stopPropagation(); onSelect(s.id); onFocus(s.id) }}
                    >
                      위치
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
