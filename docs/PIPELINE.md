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
```

## 골든 레퍼런스 규약 (승인 후)

- 승인된 1장 = `pipeline/refs/style-ref.png`. 이후 모든 이미지 발주는 이 파일을 `codex exec -i`로 앵커.
- 표준 스타일 문구는 승인된 톤 기준으로 확정해 이 문서에 기록한다.
- 텍스트는 이미지에 굽지 않는다(한글 렌더 불안정·i18n) — 글자는 항상 코드.
- IP-safe: 스튜디오/작가/브랜드 이름 금지, 스타일은 묘사로만.
