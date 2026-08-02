# PIPELINE — AI 공정 파이프라인

> 설계 원칙은 STRATEGY.md §7·§8. 이 문서는 구현 상세·사용법을 기록한다. (P2에서 본격 확장)

## 디렉터리

```
pipeline/
  orders/     # 발주 데이터 (Order-as-Data) — order#번호-이름.json
  events/     # 이벤트 스토어 (events.jsonl, append-only) — 수동 기록 금지
  staging/    # 생성물 검수 대기 구역 (승인 전 에셋)
tools/
  run-order.mjs  # 발주 실행기 — kind별 어댑터(image=codex / audio=fal / text=claude)
```

## 자산 생애주기

`draft → ordered → generated → in-review → approved | rejected(reason) → re-ordered`

모든 전이는 `pipeline/events/events.jsonl`에 1줄 append. 문서·스태프롤의 모든 숫자는 이 파일의 쿼리 결과다.

## 사용법 (현재 구현 수준)

```
pnpm order pipeline/orders/000-tone-audition.json   # 발주 실행 (있는 산출물은 스킵)
pnpm order <order.json> --force                     # 재생성
pnpm studio                                         # 디렉터 스튜디오 → http://localhost:4900/
```

## 디렉터 스튜디오 (tools/studio-server.mjs + tools/studio/) — 게임 전반의 관제탑

검수마다 임시 페이지를 만들지 않는다. 게임 제작의 모든 과정·원인·결과가 이 한 툴에 모인다.

**제작**
- **📊 대시보드**: D-day · 페이즈 진행(P0~P8, `pipeline/status.json`) · 골든 ref 상태 · 에셋 커버리지 바 · 공정 실측 카운트 · 최근 이벤트/커밋.
- **🧩 에셋 현황**: `pipeline/manifest.json` — 게임에 필요한 전 에셋 슬롯의 단일 목록. 슬롯별 상태(기획됨→발주됨→검수 대기→승인/★골든)는 이벤트에서 파생. 카테고리별 확보율.
- **🎮 게임**: 개발 서버 임베드(`pnpm dev` 필요).

**검수**
- **🖼 이미지 / 🔊 오디오**: 상단에 **검수 기준(`pipeline/criteria.json`) 표시** — 반려 사유는 이 기준의 언어로 쓴다. 배경 4종 · 72px 게임 스케일 미니뷰 · 클릭 확대 라이트박스 · **승인/반려(사유)/★골든 지정**. 골든 지정 = `pipeline/refs/style-ref.png` 승격.
- **✏️ 텍스트**: `pipeline/texts.json` — 게임 내 모든 카피의 단일 소스(이미지에 굽지 않음). 문구·컨텍스트·**상황 캡처**(`pipeline/staging/shots/<id>.png`, P1 이후 Playwright 자동화)와 함께 검수. 결정은 이벤트(order:'texts')로 기록.

**기록**
- **🕘 히스토리**: 아이템별 스레드(발주→생성→반려·사유→재발주→승인 — 원인과 결과) + 공정 카운트 + git 커밋 로그. 기술 문서가 여기서 조립된다.
- **📄 문서**: docs/*.md 렌더링 열람.

모든 결정은 이벤트로 append되며 **최신 결정이 이긴다 = 언제든 번복 가능**(골든 ref 교체 포함). 반려 사유는 재발주의 입력이 된다.

## 골든 레퍼런스 규약

- **확정: `tone-a-pop-comic` (팝 코믹 카툰) — ADR-008.** `pipeline/refs/style-ref.png`에 승격됨.
- 이후 모든 이미지 발주는 이 파일을 `codex exec -i`로 앵커.
- 표준 스타일 문구는 승인된 톤 기준으로 확정해 이 문서에 기록한다.
- 텍스트는 이미지에 굽지 않는다(한글 렌더 불안정·i18n) — 글자는 항상 코드.
- IP-safe: 스튜디오/작가/브랜드 이름 금지, 스타일은 묘사로만.
