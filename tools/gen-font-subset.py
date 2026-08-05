# gen-font-subset.py — 게임이 실제로 쓰는 글자만 남긴 Pretendard 서브셋 생성
#
# 왜: 통짜 Pretendard Variable은 2,009KB로 게임 이미지 전체(1.4MB)보다 크다. CDN dynamic-subset도
#     unicode-range 청크를 십수 개 받아 500KB대가 나온다. 저속 회선에서 이 트래픽이 배경 이미지의
#     대역폭을 그대로 잠식한다(ADR-013).
# 어떻게: 렌더되는 문자열의 출처(pipeline/texts.json + src의 모든 소스 문자)를 모아 그 글자만 남긴다.
#         자체 호스팅이므로 외부 CDN 왕복·장애 표면도 함께 사라진다.
#
# 사용: python tools/gen-font-subset.py
#       (사전: pip install fonttools brotli / 원본 폰트는 자동 다운로드)

import io
import json
import os
import sys
import urllib.request
from pathlib import Path

# Windows 한국어 로캘 콘솔(cp949)에서도 로그가 깨지지 않게
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
SRC_FONT = ROOT / "tmp" / "PretendardVariable.woff2"
OUT = ROOT / "src" / "assets" / "fonts" / "pretendard-subset.woff2"
FONT_URL = (
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/"
    "packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"
)

# 정적 수집으로 놓칠 수 있는 여지를 없애기 위한 기본 세트(용량 부담이 거의 없다)
BASE = set(chr(c) for c in range(0x20, 0x7F))  # ASCII 인쇄 가능
BASE |= set("←→↑↓·…—–‘’“”₩※○●△▲□■☆★♪♬✨🔥")  # UI에 쓰일 수 있는 기호


def collect() -> set:
    chars = set(BASE)

    # 1) 게임 텍스트 원장 — 실제 화면에 찍히는 문장 전부
    texts = json.loads((ROOT / "pipeline" / "texts.json").read_text(encoding="utf-8"))
    for cat in texts["categories"]:
        for e in cat["entries"]:
            for v in e.values():
                if isinstance(v, str):
                    chars |= set(v)

    # 2) 소스에 하드코딩된 문자열(‘OK!’, 폴백 문구 등) — 파일 전체 문자를 넣어도
    #    한글 외에는 대부분 ASCII라 용량 영향이 없다. 누락 위험을 없애는 쪽을 택한다.
    for pat in ("**/*.ts", "**/*.tsx"):
        for f in (ROOT / "src").glob(pat):
            chars |= set(f.read_text(encoding="utf-8"))
    chars |= set((ROOT / "index.html").read_text(encoding="utf-8"))

    # 제어문자 제거
    return {c for c in chars if c.isprintable() and c != " "} | {" "}


def main() -> int:
    if not SRC_FONT.exists():
        SRC_FONT.parent.mkdir(parents=True, exist_ok=True)
        print(f"원본 폰트 다운로드… {FONT_URL}")
        urllib.request.urlretrieve(FONT_URL, SRC_FONT)

    chars = collect()
    hangul = sum(1 for c in chars if "가" <= c <= "힣")
    print(f"수집 문자: {len(chars)}자 (한글 음절 {hangul}자)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    from fontTools.subset import main as subset_main

    text = "".join(sorted(chars))
    subset_main(
        [
            str(SRC_FONT),
            f"--text={text}",
            "--flavor=woff2",
            f"--output-file={OUT}",
            # 가변 축(weight 45~920) 유지 — 게임이 600~900을 함께 쓴다
            "--layout-features=kern,liga,calt",
            "--no-hinting",
            "--desubroutinize",
        ]
    )

    before = SRC_FONT.stat().st_size
    after = OUT.stat().st_size
    print(f"{before // 1024}KB → {after // 1024}KB ({100 - after * 100 // before}% 감소) → {OUT.relative_to(ROOT)}")

    # 검증: 원본 폰트가 가진 글자 중 서브셋에서 빠진 것이 있는가(토푸 방지).
    # 이모지처럼 원본에 애초에 없는 글자는 지금도 시스템 폰트가 그리므로 비교 대상에서 제외한다.
    from fontTools.ttLib import TTFont

    def cmap_of(path):
        s = set()
        for t in TTFont(path)["cmap"].tables:
            s |= {chr(c) for c in t.cmap}
        return s

    src_cmap, out_cmap = cmap_of(SRC_FONT), cmap_of(OUT)
    want = {c for c in chars if c in src_cmap}
    missing = want - out_cmap
    if missing:
        print(f"!! 누락 {len(missing)}자: {''.join(sorted(missing))[:80]}", file=sys.stderr)
        return 1
    skipped = {c for c in chars if c not in src_cmap and c.strip()}
    print(f"검증 OK — 필요 {len(want)}자 전부 포함 (서브셋 cmap {len(out_cmap)}자)")
    if skipped:
        print(f"  (원본 폰트에 없어 시스템 폰트가 그리는 글자 {len(skipped)}자: 이모지 등 — 기존 동작과 동일)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
