# gen-cup-mask.py — 컵 내부 마스크 생성 (컵 아트 교체 시 재실행)
# 방식: 스캔라인 — 각 가로줄에서 중심으로부터 좌우로 걸어 '안쪽 벽'에 닿는 구간만 채움.
#   (플러드필은 스트로크의 안티앨리어스 틈으로 그림자 포켓까지 새는 문제가 있어 기각)
# 사용: python tools/gen-cup-mask.py
from PIL import Image, ImageFilter

SRC = r'pipeline/staging/assets/cafe-cup.png'
DEST = r'src/assets/img/cafe-cup-mask.webp'
WALL = 60  # 이 알파 초과 = 벽(스트로크)

src = Image.open(SRC).convert('RGBA')
W, H = src.size
a = src.getchannel('A').load()
mask = Image.new('L', (W, H), 0)
mp = mask.load()
cx = W // 2

for y in range(H):
    if a[cx, y] > WALL:
        continue  # 중심이 링 라인 위 — 컵 아트가 위에 덮이므로 건너뜀
    lx = rx = None
    for x in range(cx, -1, -1):
        if a[x, y] > WALL:
            lx = x + 1
            break
    for x in range(cx, W):
        if a[x, y] > WALL:
            rx = x - 1
            break
    if lx is None or rx is None:
        continue  # 벽 미발견 = 컵 세로 범위 밖
    for x in range(lx, rx + 1):
        mp[x, y] = 255

mask = mask.filter(ImageFilter.MinFilter(7))  # 벽 침범 방지 수축
out = Image.new('RGBA', (W, H), (255, 255, 255, 0))
out.putalpha(mask)
out.resize((512, int(512 * H / W)), Image.LANCZOS).save(DEST, 'WEBP', quality=90)
print('mask →', DEST, (W, H))
# 주의: cafe-cup의 deco rect는 아트 종횡비와 일치해야 마스크가 픽셀 정합됨 (levels.ts 참조)
