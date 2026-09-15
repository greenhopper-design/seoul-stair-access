/** 데이터 출처 표시 — 실제 연동 데이터와 예시 데이터를 명확히 구분한다. */
export default function DataTag({ real, children }) {
  return <span className={'tag ' + (real ? 'real' : 'sample')}>{children ?? (real ? '실제 데이터' : '예시 데이터')}</span>
}
