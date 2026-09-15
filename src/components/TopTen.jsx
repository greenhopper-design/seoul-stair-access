import { grade } from '../scoring.js'
import { stairLabel } from '../analyze.js'

export default function TopTen({ stairs, selected, onSelect, onFocus }) {
  const top = stairs.slice(0, 10)
  return (
    <div className="top10">
      <header>
        <h2>개선 필요 계단 TOP 10</h2>
        <span className="small muted">
          {top.length ? '개선 필요도 점수 내림차순' : '분석을 실행하면 순위가 표시됩니다.'}
        </span>
      </header>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th className="l">순위</th>
              <th className="l">위치</th>
              <th>개선 필요도</th>
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
                  <td className="l mono">{i + 1}</td>
                  <td className="l">{stairLabel(s)}</td>
                  <td>
                    <span className="score">{s.score}</span>{' '}
                    <span className="badge" style={{ color: g.color }}>{g.label}</span>
                  </td>
                  <td className="mono">{s.stepCount}단</td>
                  <td className="mono">{s.riseM.toFixed(1)} m</td>
                  <td className="mono">{s.elderlyRatio}%</td>
                  <td className="l">
                    {s.nearestElevatorM == null ? '없음' : `${Math.round(s.nearestElevatorM)} m`}
                  </td>
                  <td className="mono">+{s.detour.extraM} m</td>
                  <td className="l">
                    <button onClick={(e) => { e.stopPropagation(); onSelect(s.id); onFocus(s.id) }}>
                      지도에서 보기
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
