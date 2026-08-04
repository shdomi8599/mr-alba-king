# gen-cup-mask.py — 컵 내부 마스크 생성 (컵 아트 교체 시 재실행)
# 방식: 실루엣 침식 — 외곽 실루엣(그림자 포함)을 잡아 벽 두께+그림자 여유만큼 균일 침식.
#   내부 디테일(링 라인·광택 스트로크·그 테두리)에 완전 무관 → 스캔라인/플러드필의 오염 문제 원천 회피.
# 사용: python tools/gen-cup-mask.py
from PIL import Image, ImageDraw, ImageFilter

SRC = r'pipeline/staging/assets/cafe-cup.png'
DEST = r'src/assets/img/cafe-cup-mask.webp'
ERODE_PASSES = 3  # MinFilter(15) 1회 ≈ 7px 침식 — 벽(~15px)+외곽 그림자(~15px) 커버는 3회부터 조정

src = Image.open(SRC).convert('RGBA')
W, H = src.size

# 1) 실루엣: 스트로크 틈 봉합(팽창) 후 바깥 플러드 — 도달 못한 모든 픽셀 = 실루엣(내부 포함)
bar = src.getchannel('A').point(lambda v: 255 if v > 20 else 0, 'L').filter(ImageFilter.MaxFilter(7))
m = bar.point(lambda v: 0 if v else 255, 'L')  # 열린 곳 255
for seed in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    if m.getpixel(seed) == 255:
        ImageDraw.floodfill(m, seed, 128)
sil = m.point(lambda v: 0 if v == 128 else 255, 'L')  # 바깥(128)만 제외 = 실루엣

# 2) 균일 침식 — 벽 안쪽으로
inner = sil
for _ in range(ERODE_PASSES):
    inner = inner.filter(ImageFilter.MinFilter(15))

# 3) 라운딩
inner = inner.filter(ImageFilter.GaussianBlur(4)).point(lambda v: 255 if v > 140 else 0, 'L')

out = Image.new('RGBA', (W, H), (255, 255, 255, 0))
out.putalpha(inner)
out.resize((512, int(512 * H / W)), Image.LANCZOS).save(DEST, 'WEBP', quality=90)
print('mask →', DEST, (W, H), 'bbox:', inner.getbbox())
# 주의: cafe-cup의 deco rect는 아트 종횡비와 일치해야 픽셀 정합 (levels.ts)
