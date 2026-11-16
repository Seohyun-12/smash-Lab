# 판교이노밸리 지도 원본

`innovalley-osm.json`은 2026-11-16에 공식 OpenStreetMap API에서 받은 영역 응답이다.

- 조회: https://api.openstreetmap.org/api/0.6/map.json?bbox=127.1000,37.4025,127.1052,37.4062
- E동: https://www.openstreetmap.org/way/684716463 — `building:levels=10`, `height=44`
- F동: https://www.openstreetmap.org/way/684716461 — `building:levels=9`, `height=43`
- 위 수치는 OSM 편집 정보다. 건축물대장 또는 실측 검증을 마친 수치로 표현하지 않는다.
- 저작자: © OpenStreetMap contributors. 라이선스: [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- 재배포한 원본 및 파생 지도 데이터에도 출처와 라이선스를 유지한다. 이 데이터 라이선스는 별도로 작성한 게임 코드의 라이선스를 정하는 문서가 아니다.

다음 명령으로 네트워크 없이 동일한 지도 파일을 생성한다.

```sh
python3 tools/osm_site.py --input data/innovalley-osm.json --output dist/site.js
```

두 대상은 동일한 좌표계와 미터 비율을 사용한다. E동 기준으로 좌표를 회전·이동했으며 임의로 F동 간격이나 높이를 조정하지 않는다. 주변 건물 높이에 `height` 태그가 없으면 층수 또는 기본값으로 추정하며 `heightEstimated`에 기록한다.

사옥 외관 사진 참고: [코스맥스 제공 전경, 서울신문 2026-05-12](https://www.seoul.co.kr/news/economy/2026/05/12/20260512500229). 유리색·프레임·원형창 등 시각적 특징의 참고 자료이며 사진 파일을 게임에 복제하거나 텍스처로 포함하지 않는다. 사진 속 개별 동의 대응과 각 면의 창문 개수는 아직 검증하지 않았다.
