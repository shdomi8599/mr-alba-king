# 알바킹 — Mr. Alba King

> **NAN 2026 (NHN Game × AI Hackathon) 사전 과제 출품작.**
> 5~10초 마이크로 알바 체험 연발 게임 — AI를 알바처럼 지휘해 만든 게임.

<!-- 배포 후: PLAY NOW 버튼 + 영상 썸네일이 이 자리에 -->

## 🎛 디렉터 스튜디오 — AI를 지휘한 흔적을 직접 보세요

이 게임의 모든 AI 산출물(아트 88건·오디오·카피)은 **디렉터 스튜디오**에서 검수됐습니다. 심사용 읽기 전용 스냅샷이 게임과 함께 배포됩니다: **`<플레이 URL>/studio/`**

- **대시보드**: 공정 실측(발주 91·생성 88·승인 105·반려 17 — 전부 이벤트 스토어 자동 집계)
- **에셋 현황**: 게임에 필요한 슬롯 59개의 장부 — 썸네일·상태가 발주 이벤트에서 자동 파생
- **오디오**: 낙선한 BGM 후보까지 직접 들어볼 수 있습니다 (경쟁 선정의 증거)
- **히스토리**: 에셋별 발주→반려(사유)→재발주→승인 스레드 + 커밋 로그
- **게임 탭**: 스튜디오 안에서 배포된 게임이 그대로 돌아갑니다

반려 사유 10건("오브젝트가 공중에 뜸", "9-slice로 늘리면 질감 소실"…)이 곧 이 게임의 품질 관리 기록입니다.

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
