# 알바킹 — Mr. Alba King

> **NAN 2026 (NHN Game × AI Hackathon) 사전 과제 출품작.**
> 5~10초 마이크로 알바 체험 연발 게임 — AI를 알바처럼 지휘해 만든 게임.

<!-- 배포 후: PLAY NOW 버튼 + 영상 썸네일이 이 자리에 -->

## 개발 원칙

- 모든 AI 공정(아트·오디오·레벨·QA)은 발주 데이터([pipeline/orders/](pipeline/orders/))로 기록되고, 상태 전이는 이벤트 스토어([pipeline/events/](pipeline/events/))에 자동 축적됩니다.
- 최종 결정은 항상 디렉터(사람)가 합니다 — 승인/반려 기록이 곧 개발기입니다.
- 문서: [docs/STRATEGY.md](docs/STRATEGY.md) (전략) · [docs/DESIGN.md](docs/DESIGN.md) (게임 설계) · [docs/PIPELINE.md](docs/PIPELINE.md) (AI 파이프라인) · [docs/DECISIONS.md](docs/DECISIONS.md) (의사결정 기록)

## 실행

```
pnpm install
pnpm dev      # 개발 서버
pnpm build    # 정적 빌드 (GitHub Pages)
pnpm order pipeline/orders/<order>.json   # AI 에셋 발주 실행
```
