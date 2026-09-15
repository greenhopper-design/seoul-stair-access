# 계단 접근성 분석 지도 (Vertical Accessibility Finder)

서울의 도시 계단 중 고령자 이동을 가장 크게 방해하는 계단을 찾아 개선 우선순위를 매기는 지도 웹앱.

```bash
npm install
npm run dev     # http://localhost:5199
npm test        # 점수 계산 로직 자체검증
```

## 사용 흐름
1. 왼쪽 패널에서 지역 검색(예: 창신동) 또는 지도를 이동한 뒤 `현재 지도 영역`
2. `분석 시작` → Overpass에서 해당 영역의 `highway=steps` 수집
3. 지도 마커 클릭 또는 TOP 10 행 클릭 → 오른쪽에 선정 이유 표시
4. 가중치 슬라이더 조절 → 재분석 없이 즉시 재계산·재정렬

## 데이터 출처 (화면에도 동일하게 표기)

| 항목 | 현재 | 모듈 |
|---|---|---|
| 계단 위치·길이·속성 | **실제** OSM Overpass API | `src/data/overpass.js` |
| 총 상승고 | **실제** Open-Meteo Elevation (Copernicus DEM 90m) | `src/data/elevation.js` |
| 대체 이동수단(엘리베이터) | **실제** OSM `highway=elevator` | `src/data/overpass.js` |
| 고령인구 | **예시 데이터** (자치구 단위 자리표시값) | `src/data/elderly.js` |
| 우회거리·추가시간 | **예시 추정** (기하 추정식) | `src/data/detour.js` |

예시 데이터는 실제 통계가 아니며 화면에서 항상 `예시 데이터` / `예시 추정` 태그로 표기된다.

### 실제 API 연결 지점
- 고령인구 → `elderly.js`의 `elderlyRatioAt()`을 서울 열린데이터광장 행정동별 연령별 등록인구 API 호출로 교체
- 우회거리 → `detour.js`의 `estimateDetour()`를 OSRM/GraphHopper foot 프로파일 라우팅으로 교체
- 고정밀 상승고 → `elevation.js`의 `openMeteoElevations()`를 서울시/VWorld DEM으로 교체

## 점수 구조 (`src/scoring.js`)
각 지표를 0~100으로 정규화 후 가중 평균. 가중치는 **연구 확정값이 아닌 프로토타입 값**이며 UI에서 조절 가능.

| 지표 | 100점 기준 | 기본 가중치 |
|---|---|---|
| 계단 부담도 | 60단 이상 | 25 |
| 총 상승고 | 20 m 이상 | 20 |
| 주변 고령인구 | 65세 이상 30% | 20 |
| 난간·계단참 부족 | 없음 100 / 정보없음 60 / 있음 0 | 10 |
| 대체 이동수단 부족 | 엘리베이터 400 m 이상 | 15 |
| 우회거리 증가 | 추가 600 m 이상 | 10 |

등급: 80~100 매우 높음 / 60~79 높음 / 40~59 보통 / 0~39 낮음

## 구조
```
src/
  App.jsx              상태 연결
  analyze.js           수집 → 상승고 → 고령인구 → 대체수단 → 우회 파이프라인
  scoring.js           지표 정규화·가중 평균·등급·선정 이유
  scoring.test.mjs     자체검증 (node src/scoring.test.mjs)
  data/                외부 데이터 모듈 (교체 지점)
  components/          Header / LeftPanel / MapView / RightPanel / TopTen
```

## 알려진 제약
- 한 번에 분석하는 계단은 최대 200개(길이 상위순). 서울 전역 일괄 분석은 미지원.
- DEM 해상도가 90m라 짧은 계단의 상승고는 오차가 있다. 상승고 1m 미만이면 OSM `step_count` 또는 경사 추정으로 대체하고 출처를 함께 표시한다.

## 배포 (Vercel)

`main` 에 push하면 Vercel이 자동으로 빌드·배포한다. 별도 워크플로 파일은 없다.

- 운영 주소: https://seoul-stair-access.vercel.app
- 저장소: https://github.com/greenhopper-design/seoul-stair-access

```bash
git add -A && git commit -m "메시지" && git push   # 1~2분 뒤 자동 반영
```

### Overpass 호출 구조 — 왜 이렇게 되어 있나
공개 Overpass 인스턴스는 시점마다 살아있는 곳이 다르다. 실측한 실패 양상:

| 원인 | 사례 |
|---|---|
| 배포 도메인에 대한 CORS 거부 | overpass-api.de |
| 과부하 무응답 / 504 | kumi.systems, private.coffee |
| 지역 한정 데이터 | osm.ch (스위스만 보유, 서울 계단 0개) |
| 클라우드 IP 요청 제한 | 서버리스에서 호출 시 429 |

그래서 `src/data/overpass.js` 는 서로 다른 서버 4곳에 **동시에** 요청하고 가장 먼저
성공한 응답을 쓴다(`Promise.any`). 목록에는 같은 도메인의 서버리스 프록시
`api/overpass.js` 도 포함되어 있어, 브라우저 CORS가 막히는 경우의 우회로가 된다
(로컬 개발에서는 `/api` 가 없어 404 → 나머지 경로가 처리).
각 서버가 받는 동시 요청은 1건이라 이용 정책에 어긋나지 않는다.

트래픽이 커지면 자체 Overpass 인스턴스를 띄우고 이 목록을 교체하는 것이 정답이다.

### 공개 시 유의
- 지도 타일(OpenStreetMap), Overpass, Nominatim, Open-Meteo 모두 브라우저에서 직접
  호출하는 무료 공개 API다. 서버·API 키가 필요 없는 대신 대량 트래픽에는 적합하지 않다.
- Nominatim은 초당 1회 이상 호출을 금지한다. 검색 버튼을 연타하지 않는다.
- 모든 외부 요청에 타임아웃이 걸려 있다(Overpass 40s, Open-Meteo 20s, Nominatim 15s).
  응답이 없으면 다음 서버 또는 대체 추정으로 넘어가고, 무한 로딩에 빠지지 않는다.
