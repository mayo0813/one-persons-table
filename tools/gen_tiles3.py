"""타일셋 v3 — 고딕풍 디테일 도트 (48px 원본, 1px 단위).
참고: 금장·조각·짙은 나무·벨벳의 고딕 소품 느낌. 그림은 전부 새로 그린 것이다.
원칙: 점 노이즈 대신 명암 단계·패턴으로 질감 / 따뜻한 갈색 외곽선 / 위·왼쪽 광원 / 금색 강조.
칸 번호 0~31은 기존과 같다(맵 그대로). 시트는 8×8칸:
  32~35 첫째 바닥 변형, 36~37 둘째 바닥 변형, 38~39 칠판 변형(교실), 40~45 벽 장식 변형, 46~47 윗벽 변형.
  오염 단계 시트(_s2/_s3/_s4)는 0~47을 같은 자리에 오염시켜 그리고, 48~63에 오염 변형을 더 둔다:
  48~54 첫째 바닥, 55~57 둘째 바닥, 58~61 벽, 62~63 윗벽.
사용: python3 gen_tiles3.py <출력 폴더>"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

OUT = sys.argv[1]
T = 48
os.makedirs(os.path.join(OUT, 'tilesets'), exist_ok=True)

# ------------------------------------------------------------------ 팔레트 (어두운→밝은 7단계, 손으로 고른 색)
def H(s): s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)
def RP(*hs): return [H(h) for h in hs]
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def A(c, a): return c[:3] + (a,)
OUTL  = H('140A0A')
WOOD  = RP('1C100C', '2C1912', '42261A', '5A3524', '74462E', '925C3A', 'B47A4E')   # 짙은 호두나무
OAK   = RP('2A1A10', '3E2716', '573820', '6F4828', '8A5C34', 'A87444', 'C99460')   # 책상 참나무
GOLD  = RP('2A1C08', '4E3510', '7A5418', 'A67722', 'CC9C34', 'E8C25A', 'FFEDA8')
CRIM  = RP('1C060A', '300A12', '4C101C', '6C1828', '8C2434', 'AE3A48', 'CC5E66')
NAVYV = RP('0E1018', '161A2A', '1E2438', '28304A', '343E5C', '485272', '66708E')
STONE = RP('141319', '201F28', '2E2D38', '403F4E', '565566', '727184', '9A99AA')
MARB  = RP('4A4852', '625F6A', '7C7984', '98959E', 'B2AFB8', 'CCC9D0', 'E6E3E8')
IRON  = RP('0C0C10', '18181E', '26262E', '363640', '4A4A56', '64646E', '8C8C98')
GREEN = RP('0C1410', '14201A', '1C2C24', '25392E', '304A3A', '426048', '5C7C5E')
NAVY  = RP('0C0E16', '141824', '1C2232', '252D42', '303A54', '424E6C', '5E6A88')
WINE  = RP('140608', '22090E', '340E16', '48141E', '5E1C28', '7A2A36', '9A4048')
CREAM = RP('3E3830', '5C5446', '7C725E', '9C9078', 'B8AC92', 'D2C7AE', 'ECE4CE')
TEAL  = RP('0C1A1C', '142628', '1C3436', '264446', '325858', '467272', '64908E')
PAPER = RP('6E6656', '948A76', 'B4AA94', 'CEC4AE', 'E2DAC6', 'F0EADA', 'FFFCF2')
LEATH = [RP('1A0C0A', '2C1410', '421E16', '5A2A1E', '743828', '904A34', 'AE6046'),
         RP('0E1412', '18221E', '22302A', '2E3E36', '3C5044', '506656', '6A806C'),
         RP('10101C', '1A1A2C', '24243E', '303052', '3E3E68', '525282', '6E6EA0'),
         RP('1C0A10', '2E1018', '461824', '5E2030', '782A3C', '94384C', 'B04C60'),
         RP('1C140A', '2E2210', '463418', '5E4620', '785A2A', '947036', 'B08A48')]
SKY   = RP('1A2034', '263050', '34426A', '4A5A84', '6A7EA4', '94A6C4', 'C4D0E2')
FLESH = RP('2A0A10', '46121C', '64202A', '843440', '9E4A54', 'BC6870', 'DC9298')
BLOOD = RP('1E0408', '36080E', '520C14', '6E121C', '8A1A24', 'A82A32', 'CC4A50')
DRYB  = RP('1A0A0A', '2A100E', '3C1814', '4E201A', '602A22', '74362C', '8A4636')
VEINC = RP('12040C', '220812', '360E1C', '4A1426', '601C32', '7A2A42', '9A4058')

# ------------------------------------------------------------------ 붓 (칸마다 따로 그려 잘림이 자연스러움)
class Pen:
    def __init__(self, seed=0):
        self.im = Image.new('RGB', (T, T), (0, 0, 0))
        self.d = ImageDraw.Draw(self.im, 'RGBA')
        self.r = random.Random(seed)
    def p(self, x, y, c):
        if 0 <= x < T and 0 <= y < T: self.d.point((x, y), fill=c)
    def rect(self, x0, y0, x1, y1, c):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        self.d.rectangle([x0, y0, x1, y1], fill=c)
    def box(self, x0, y0, x1, y1, c): self.d.rectangle([x0, y0, x1, y1], outline=c)
    def h(self, x0, x1, y, c): self.rect(x0, y, x1, y, c)
    def v(self, x, y0, y1, c): self.rect(x, y0, x, y1, c)
    def line(self, x0, y0, x1, y1, c, w=1): self.d.line([x0, y0, x1, y1], fill=c, width=w)
    def ell(self, x0, y0, x1, y1, c=None, o=None): self.d.ellipse([x0, y0, x1, y1], fill=c, outline=o)
    def poly(self, pts, c=None, o=None): self.d.polygon(pts, fill=c, outline=o)
    def shadow(self, x0, y0, x1, y1, a=70): self.rect(x0, y0, x1, y1, (0, 0, 0, a))
    def glow(self, cx, cy, r, col, a=60):
        for k in range(r, 0, -2):
            self.ell(cx - k, cy - k, cx + k, cy + k, A(col, int(a * (1 - k / r) ** 1.4) + 4))
    def bevel(self, x0, y0, x1, y1, R, i=3, o=None):
        self.rect(x0, y0, x1, y1, R[i])
        self.h(x0, x1 - 1, y0, R[i + 1]); self.v(x0, y0, y1 - 1, R[i + 1])
        self.h(x0 + 1, x1, y1, R[i - 1]); self.v(x1, y0 + 1, y1, R[i - 1])
        if o: self.box(x0 - 1, y0 - 1, x1 + 1, y1 + 1, o)
    def blit(self, other): self.im.paste(other.im, (0, 0))

def tile(fn):
    def p(seed=0):
        P = Pen(seed); fn(P); return P.im
    p._fn = fn
    return p
def over(*fs):
    def p(seed=0):
        P = Pen(seed)
        for f in fs:
            im = f(seed) if not isinstance(f, Image.Image) else f
            if isinstance(im, Image.Image) and f is fs[0]: P.im.paste(im)
            elif callable(f) and getattr(f, '_layer', False): f._draw(P)
        return P.im
    return p
def layer(fn):
    """바탕 위에 덧그리는 층."""
    def p(seed=0):
        P = Pen(seed); fn(P); return P.im
    p._layer = True; p._draw = fn
    return p
def on(base, *layers):
    """base 칸 위에 layer들을 차례로 덧그린다."""
    def p(seed=0):
        P = Pen(seed); P.im.paste(base(seed))
        for l in layers: l._draw(P)
        return P.im
    return p

# ------------------------------------------------------------------ 공통 장식
def gold_bead(P, x0, x1, y):
    """3px 금 띠: 위 빛 / 몸 / 아래 그늘 + 4px마다 구슬."""
    P.h(x0, x1, y, GOLD[5]); P.h(x0, x1, y + 1, GOLD[3]); P.h(x0, x1, y + 2, GOLD[1])
    for x in range(x0 + 1, x1, 4): P.p(x, y + 1, GOLD[6]); P.p(x + 1, y + 1, GOLD[4])
def rosette(P, cx, cy, G=GOLD):
    P.p(cx, cy - 2, G[4]); P.p(cx, cy + 2, G[2]); P.p(cx - 2, cy, G[4]); P.p(cx + 2, cy, G[2])
    P.rect(cx - 1, cy - 1, cx + 1, cy + 1, G[3]); P.p(cx - 1, cy - 1, G[5]); P.p(cx, cy, G[6]); P.p(cx + 1, cy + 1, G[1])
def candle(P, cx, top, h=7):
    P.glow(cx, top - 2, 9, H('FFB050'), 70)
    P.rect(cx - 1, top, cx + 1, top + h, PAPER[5]); P.v(cx - 1, top, top + h, PAPER[6]); P.v(cx + 1, top + 1, top + h, PAPER[3])
    P.p(cx, top - 1, OUTL)
    P.p(cx, top - 4, H('FFF2C0')); P.p(cx, top - 3, H('FFD070')); P.p(cx, top - 2, H('FF9A30')); P.p(cx - 1, top - 2, H('E86A20')); P.p(cx + 1, top - 3, H('FFB040'))
def arch_top(x0, x1, y_spring, y_apex):
    """뾰족 아치 윤곽: x -> 이 x에서 아치 안쪽이 시작하는 y."""
    cx = (x0 + x1) / 2; half = (x1 - x0) / 2
    def f(x):
        t = abs(x - cx) / half
        return int(y_apex + (y_spring - y_apex) * (t ** 1.6))
    return f

# ------------------------------------------------------------------ 바닥
def parquet(R=OAK, polish=True):
    """쪽모이(바스켓 위브): 12px 블록 안에 4px 판자 3장, 블록마다 방향이 바뀜. 48칸에서 이어짐."""
    def f(P):
        for by in range(4):
            for bx in range(4):
                x0, y0 = bx * 12, by * 12
                horiz = (bx + by) % 2 == 0
                for k in range(3):
                    tone = [0, -1, 0][(k + bx * 2 + by) % 3]
                    for j in range(12):
                        for i in range(4):
                            x, y = (x0 + j, y0 + k * 4 + i) if horiz else (x0 + k * 4 + i, y0 + j)
                            c = [mix(R[3 + tone], R[4 + tone], 0.6), R[3 + tone], R[3 + tone], mix(R[2 + tone], R[3 + tone], 0.35)][i]
                            if i in (1, 2) and (j * 5 + k * 3 + bx * 7 + by * 11) % 9 == 0: c = R[2 + tone]   # 결
                            P.p(x, y, c)
                    if polish and (bx * 3 + by * 5 + k) % 7 == 0:   # 광택
                        for j in range(3, 8):
                            x, y = (x0 + j, y0 + k * 4) if horiz else (x0 + k * 4, y0 + j)
                            P.p(x, y, R[5])
                P.box(x0, y0, x0 + 11, y0 + 11, A(R[0], 55))
    return tile(f)
def long_boards(R=WOOD):
    """기숙사: 길고 반들반들한 짙은 판자. 8px 판 6장."""
    def f(P):
        for k in range(6):
            y0 = k * 8; tone = [0, -1, 0, 0, -1, 0][k]
            P.rect(0, y0, 47, y0 + 7, R[3 + tone])
            P.h(0, 47, y0, R[1]); P.h(0, 47, y0 + 1, R[4 + tone]); P.h(0, 47, y0 + 7, R[2 + tone])
            for g in range(3):
                gy = y0 + 3 + (g + k) % 3; gx = (k * 13 + g * 17) % 40
                P.h(gx, gx + 7, gy, R[2 + tone])
            cut = (k * 19 + 7) % 44 + 2
            if k % 2: P.v(cut, y0 + 1, y0 + 7, R[1]); P.p(cut + 1, y0 + 2, R[5]); P.p(cut - 2, y0 + 4, R[1])
        for x in range(6, 18): P.p(x, 9 + (x - 6) // 4, A(R[6], 80))       # 비친 창빛
    return tile(f)
def marble_check(Rw=MARB, Rd=STONE):
    """복도: 24px 대리석 체크, 결이 지나감."""
    def f(P):
        for sy in range(2):
            for sx in range(2):
                R = Rw if (sx + sy) % 2 == 0 else Rd
                x0, y0 = sx * 24, sy * 24
                P.rect(x0, y0, x0 + 23, y0 + 23, R[3])
                for y in range(24):
                    for x in range(24):
                        t = (x + y) / 46
                        if (x + y * 2) % 13 == 0: P.p(x0 + x, y0 + y, R[4] if R is Rw else R[2])
                # 결
                rnd = random.Random(sx * 7 + sy * 3 + 1)
                vx, vy = rnd.randint(2, 10), 0
                for k in range(30):
                    P.p(x0 + vx, y0 + vy, R[2] if R is Rw else R[4])
                    if k % 3 == 0: P.p(x0 + vx + 1, y0 + vy, R[1] if R is Rw else R[5])
                    vx = max(1, min(22, vx + rnd.choice([0, 1, 1]))); vy += 1
                    if vy > 22: break
                P.h(x0, x0 + 22, y0, R[5]); P.v(x0, y0, y0 + 22, R[4])
                P.h(x0 + 1, x0 + 23, y0 + 23, R[1]); P.v(x0 + 23, y0 + 1, y0 + 23, R[1])
                P.p(x0 + 2, y0 + 2, R[6])
    return tile(f)
def victorian_tile(Rc=CREAM, Rt=TEAL):
    """급식실: 12px 크림 타일 + 모서리마다 청록 마름모 상감."""
    def f(P):
        for ty in range(4):
            for tx in range(4):
                x0, y0 = tx * 12, ty * 12
                P.rect(x0, y0, x0 + 11, y0 + 11, Rc[4])
                P.h(x0, x0 + 10, y0, Rc[5]); P.v(x0, y0, y0 + 10, Rc[5])
                P.h(x0 + 1, x0 + 11, y0 + 11, Rc[2]); P.v(x0 + 11, y0 + 1, y0 + 11, Rc[2])
                P.p(x0 + 2, y0 + 2, Rc[6])
        for cy in range(0, 49, 12):
            for cx in range(0, 49, 12):
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        if abs(dx) + abs(dy) <= 3:
                            c = Rt[3] if abs(dx) + abs(dy) < 3 else Rt[1]
                            if dx + dy == -2: c = Rt[5]
                            P.p(cx + dx, cy + dy, c)
    return tile(f)
def chapel_floor(R=STONE):
    """예배당: 24px 판석 + 판석 모서리마다 금 십자 상감."""
    def f(P):
        for sy in range(2):
            for sx in range(2):
                x0, y0 = sx * 24, sy * 24; t = 3 if (sx + sy) % 2 == 0 else 2
                P.rect(x0, y0, x0 + 23, y0 + 23, R[t])
                for k in range(0, 24, 4): P.h(x0 + 2, x0 + 21, y0 + 2 + k, R[t])
                P.rect(x0 + 3, y0 + 3, x0 + 20, y0 + 20, R[t]); P.box(x0 + 3, y0 + 3, x0 + 20, y0 + 20, R[t - 1])
                P.h(x0 + 4, x0 + 19, y0 + 4, R[t + 1]); P.v(x0 + 4, y0 + 4, y0 + 19, R[t + 1])
                P.h(x0, x0 + 22, y0, R[t + 2]); P.v(x0, y0, y0 + 22, R[t + 1])
                P.h(x0 + 1, x0 + 23, y0 + 23, R[0]); P.v(x0 + 23, y0 + 1, y0 + 23, R[0])
        for cy in (0, 24, 48):
            for cx in (0, 24, 48):
                for d in range(-3, 4):
                    P.p(cx + d, cy, GOLD[3]); P.p(cx, cy + d, GOLD[3])
                P.p(cx, cy, GOLD[6]); P.p(cx - 1, cy, GOLD[5]); P.p(cx, cy - 1, GOLD[5])
                for d in (-3, 3): P.p(cx + d, cy, GOLD[1]); P.p(cx, cy + d, GOLD[1])
    return tile(f)
def flagstones(R=STONE, seed=0):
    """지하: 큰 판석(24×24, 줄마다 12 어긋남), 모서리 깎임과 이끼만 — 노이즈 없음."""
    def f(P):
        P.rect(0, 0, 47, 47, R[0])
        for row in range(2):
            off = 0 if row == 0 else 12
            for k in range(-1, 3):
                x0, y0 = k * 24 + off + 1, row * 24 + 1
                x1, y1 = x0 + 21, y0 + 21
                t = 3
                P.rect(x0, y0, x1, y1, R[t])
                P.h(x0 + 1, x1 - 1, y0, R[t + 1]); P.v(x0, y0 + 1, y1 - 1, R[t + 1])
                P.h(x0 + 1, x1, y1, R[t - 1]); P.v(x1, y0 + 1, y1, R[t - 1])
                P.p(x0, y0, R[0]); P.p(x1, y1, R[0]); P.p(x1, y0, R[t - 1]); P.p(x0, y1, R[t - 1])

        for (mx, my) in [(23, 23), (11, 47), (35, 0)]:                  # 줄눈 이끼
            for d in range(-3, 4): P.p(mx + d, my + (d % 2), H('34442E'))
            P.p(mx, my - 1, H('4C6040'))
    return tile(f)
def grass(seed=0, flowers=False, tuft=False):
    """풀: 3톤 잎 무리를 규칙적으로 흩음(노이즈 아님)."""
    G = RP('16220E', '22341A', '2E4624', '3C5A2E', '4C6E3A', '608648', '7EA05E')
    def f(P):
        P.rect(0, 0, 47, 47, G[3])
        for y in range(0, 48, 6):
            for x in range(0, 48, 6):
                ox = (x + y * 3 + seed * 5) % 5; oy = (x * 2 + seed) % 3
                bx, by = x + ox, y + oy
                P.p(bx, by + 2, G[2]); P.p(bx + 1, by + 1, G[4]); P.p(bx + 1, by + 2, G[3]); P.p(bx + 2, by, G[5]); P.p(bx + 2, by + 1, G[4])
                if (x + y) % 18 == 0: P.p(bx + 3, by + 2, G[1])
        if flowers:
            for (fx, fy, c) in [(10, 30, 'E8E0EC'), (33, 12, 'D8B0C0'), (24, 38, 'E8D888')]:
                P.p(fx, fy - 1, H(c)); P.p(fx - 1, fy, H(c)); P.p(fx + 1, fy, H(c)); P.p(fx, fy + 1, H(c)); P.p(fx, fy, GOLD[5])
        if tuft:
            for k in range(7): P.line(17 + k * 2, 34, 15 + k * 3, 24 + (k % 3) * 2, G[5 if k % 2 else 4])
    return tile(f)
def dirt(seed=0, pebbles=False, ruts=False):
    D = RP('2E2418', '443624', '5C4A32', '74603F', '8C7650', 'A68E64', 'C2AA80')
    def f(P):
        P.rect(0, 0, 47, 47, D[3])
        rnd = random.Random(seed * 13 + 1)
        for _ in range(26):                                   # 흩어진 흙 알갱이(밝은 점 + 그늘)
            x, y = rnd.randint(1, 46), rnd.randint(1, 46)
            P.p(x, y, D[4]); P.p(x, y + 1, D[2])
        for _ in range(3):                                    # 작은 돌
            x, y = rnd.randint(3, 43), rnd.randint(3, 43)
            P.p(x, y, D[1]); P.p(x + 1, y, D[2]); P.p(x, y - 1, D[5])
        if pebbles:
            for (a, b) in [(9, 30), (32, 12), (38, 38), (19, 8)]:
                P.ell(a, b, a + 4, b + 3, D[1]); P.ell(a, b, a + 3, b + 2, D[5]); P.p(a + 1, b, D[6])
        if ruts:
            for x in range(4, 44): P.p(x, 22 + int(2 * math.sin(x / 6)), D[1]); P.p(x, 23 + int(2 * math.sin(x / 6)), D[5])
    return tile(f)
def sand_t(P):
    S = RP('6E5A3A', '8C7650', 'A69066', 'BCA67A', 'D0BA8E', 'E2CEA4', 'F2E2BE')
    P.rect(0, 0, 47, 47, S[3])
    for y in range(0, 48, 3):
        for x in range(0, 48, 3):
            if (x * 5 + y * 3) % 7 == 0: P.p(x + (y % 2), y, S[2])
            elif (x + y * 7) % 11 == 0: P.p(x, y + 1, S[5])

# ------------------------------------------------------------------ 차분한 바닥 (v2.8: 눈이 편하게 — 대비 낮춤, 무늬 최소)
def calm_boards(R, seed=0, knot=False, scratch=False, h=12):
    """긴 판자. 이음매는 같은 색 계열로 한 단계만 어둡게, 결은 드물게."""
    def f(P):
        n = 48 // h
        for k in range(n):
            y0 = k * h
            base = R[3] if k % 2 == 0 else mix(R[3], R[2], 0.25)
            P.rect(0, y0, 47, y0 + h - 1, base)
            P.h(0, 47, y0, mix(base, R[1], 0.55))                                  # 판 사이 홈
            P.h(0, 47, y0 + 1, mix(base, R[4], 0.35))
            cut = (k * 29 + 11 + seed * 7) % 40 + 4
            if k % 2 == 1:
                P.v(cut, y0 + 1, y0 + h - 1, mix(base, R[1], 0.45))
            for g in range(2):                                                    # 드문 나뭇결
                gx = (k * 17 + g * 23 + seed * 5) % 36; gy = y0 + 4 + (g * 3 + k) % (h - 6)
                P.h(gx, gx + 9, gy, mix(base, R[2], 0.35))
        if knot:
            P.ell(30, 17, 35, 20, mix(R[3], R[2], 0.5)); P.p(32, 18, mix(R[3], R[1], 0.5))
        if scratch:
            for k in range(10): P.p(8 + k, 33 + k // 5, mix(R[3], R[5], 0.35))
    return tile(f)
def calm_tiles(R, size=24, seed=0, chip=False, crack=False, inlay=None):
    """큰 타일/판석. 줄눈은 한 단계만 어둡게, 빛은 윗선 1px만 살짝."""
    def f(P):
        P.rect(0, 0, 47, 47, R[3])
        for y0 in range(0, 48, size):
            for x0 in range(0, 48, size):
                P.h(x0, x0 + size - 1, y0, mix(R[3], R[1], 0.5))
                P.v(x0, y0, y0 + size - 1, mix(R[3], R[1], 0.5))
                P.h(x0 + 1, x0 + size - 1, y0 + 1, mix(R[3], R[4], 0.4))
                P.v(x0 + 1, y0 + 1, y0 + size - 1, mix(R[3], R[4], 0.2))
        if inlay:                                                                 # 48칸 모서리에만 작은 금 점
            for (cx, cy) in [(0, 0), (48, 0), (0, 48), (48, 48)]:
                for (dx, dy) in [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)]:
                    P.p(cx + dx, cy + dy, inlay[3] if (dx, dy) != (0, 0) else inlay[5])
        if chip: P.p(31, 14, R[1]); P.p(32, 14, R[2]); P.p(31, 15, R[2])
        if crack:
            x, y = 12, 26
            for k in range(9): P.p(x, y, mix(R[3], R[1], 0.6)); x += 1; y += (1 if k % 3 == 0 else 0)
    return tile(f)

# ------------------------------------------------------------------ 벽지
def damask(R):
    """16px 주기 다마스크: 마름모 격자 + 가운데 세 잎 무늬. y 위상은 전역(윗칸·아랫칸 이어짐)."""
    def paint(P, y0, y1):
        for y in range(y0, y1 + 1):
            for x in range(48):
                u, v = x % 16, y % 16
                c = R[2]
                d1 = abs(u - 8) + abs(v - 8)
                if d1 == 8 or (u == 0 and v == 0): c = mix(R[2], R[3], 0.45)        # 격자
                if (u in (7, 8, 9) and 4 <= v <= 11) or (v in (7, 8) and 5 <= u <= 11):   # 가운데 무늬
                    if d1 <= 4: c = mix(R[2], R[4], 0.5)
                if (u, v) in ((8, 3), (8, 12), (4, 8), (12, 8)): c = mix(R[2], R[4], 0.5)
                if (u, v) in ((7, 6), (8, 5)): c = mix(R[3], R[5], 0.5)
                if (u, v) in ((9, 10), (8, 11)): c = R[1]
                if d1 == 7 and (u + v) % 2 == 0: c = mix(R[2], R[3], 0.5)
                P.p(x, y, c)
    return paint
def wainscot(P, y0, R=WOOD, carved=True):
    """y0~47: 금 띠 의자 레일 + 아치형 조각 판 2장 + 걸레받이."""
    P.rect(0, y0, 47, 47, R[2])
    for k in (0, 24):
        x0, x1 = k + 3, k + 20
        top = y0 + 5
        P.rect(x0, top, x1, 43, R[1])
        f = arch_top(x0 + 1, x1 - 1, top + 4, top)
        for x in range(x0 + 1, x1):
            yt = f(x) + 1
            P.v(x, yt, 42, R[3]); P.p(x, yt, R[5])
            if (x - x0) % 4 == 1: P.v(x, yt + 2, 41, mix(R[3], R[2], 0.4))
        P.v(x0 + 1, top + 4, 42, R[4]); P.v(x1 - 1, top + 4, 42, R[2]); P.h(x0 + 1, x1 - 1, 42, R[1])
        if carved: rosette(P, (x0 + x1) // 2, top + 8)
    P.v(23, y0 + 3, 44, R[1]); P.v(24, y0 + 3, 44, R[4]); P.v(47, y0 + 3, 44, R[1]); P.v(0, y0 + 3, 44, R[4])
    P.rect(0, 44, 47, 47, R[1]); P.h(0, 47, 44, R[4]); P.h(0, 47, 45, R[2]); P.h(0, 47, 47, OUTL)
    P.rect(0, y0 - 1, 47, y0 + 1, R[3]); P.h(0, 47, y0 - 2, R[5])
    gold_bead(P, 0, 47, y0 + 1)
    P.h(0, 47, y0 + 4, A(OUTL, 120))
def wall_tile(paper, R=WOOD, carved=True):
    def f(P):
        paper(P, 0, 28)
        for y in range(0, 6): P.h(0, 47, y, A(OUTL, 0))
        wainscot(P, 30, R, carved)
    return tile(f)
def upper_tile(paper, R=WOOD):
    def f(P):
        paper(P, 17, 47)
        P.rect(0, 0, 47, 8, R[1])
        P.rect(0, 9, 47, 15, R[3]); P.h(0, 47, 9, R[1]); P.h(0, 47, 10, R[5]); P.h(0, 47, 11, R[4])
        for x in range(0, 48, 4): P.rect(x + 1, 12, x + 2, 14, R[2]); P.p(x + 1, 12, R[5])    # 치아 장식
        gold_bead(P, 0, 47, 15)
        P.h(0, 47, 18, A(OUTL, 110)); P.h(0, 47, 19, A(OUTL, 50))
    return tile(f)
def stone_wall_paint(P, y0, y1, R=STONE):
    P.rect(0, y0, 47, y1, R[0])
    for row, yy in enumerate(range(y0 - (y0 % 8), y1 + 1, 8)):
        off = 0 if (yy // 8) % 2 == 0 else 8
        for xx in range(-16 + off, 48, 16):
            a, b = xx + 1, xx + 15
            t = 3 if ((xx // 16) + (yy // 8)) % 3 else 2
            for y in range(max(y0, yy + 1), min(y1, yy + 7) + 1):
                for x in range(max(0, a), min(47, b) + 1):
                    c = R[t]
                    if y == yy + 1: c = R[t + 1]
                    elif y == yy + 7 or x == b: c = R[t - 1]
                    elif x == a: c = R[t + 1] if y < yy + 4 else R[t]
                    P.p(x, y, c)
            if a + 3 <= 47 and yy + 2 >= y0: P.p(max(0, a + 2), yy + 2, R[t + 2])
    for (sx, ln) in [(9, 18), (31, 12), (42, 22)]:                     # 스민 물자국
        for k in range(ln):
            if y0 + k <= y1: P.p(sx + (k // 9) % 2, y0 + k, A(H('0A1418'), 120))

# ------------------------------------------------------------------ 창·문
def gothic_window_lower(curtain=CRIM):
    """2칸 높이 아치창의 아랫칸: 마름모 납창 + 눈 덮인 바깥 + 벨벳 커튼(금 끈) + 창턱."""
    def f(P):
        P.rect(7, 0, 40, 28, OUTL)
        P.rect(8, 0, 39, 27, WOOD[3]); P.v(8, 0, 27, WOOD[5]); P.v(39, 0, 27, WOOD[1])
        for y in range(0, 25):
            for x in range(11, 37):
                t = y / 25
                c = mix(SKY[4], SKY[5], t)
                if y > 17 - int(3 * math.sin(x / 4)): c = mix(H('DDE4EE'), H('B8C4D4'), (x % 5) / 5)   # 눈 언덕
                P.p(x, y, c)
        for x in range(11, 37):                                           # 마름모 납선
            for y in range(0, 25):
                if (x + y) % 8 == 0 or (x - y) % 8 == 0: P.p(x, y, mix(WOOD[1], SKY[3], 0.3))
        P.v(23, 0, 24, WOOD[2]); P.v(24, 0, 24, WOOD[4])
        for (sx, sy) in [(14, 4), (29, 7), (19, 11), (33, 2)]: P.p(sx, sy, H('FFFFFF'))
        P.rect(5, 25, 42, 28, WOOD[4]); P.h(5, 42, 25, WOOD[6]); P.h(5, 42, 28, WOOD[1]); P.h(6, 41, 29, A(OUTL, 100))
        for side in (0, 1):                                               # 커튼
            for y in range(0, 31):
                w = 6 + (1 if y > 20 else 0) - (2 if 14 <= y <= 17 else 0)
                for k in range(w):
                    x = 4 + k if side == 0 else 43 - k
                    c = curtain[3] if (k + (y // 3)) % 4 else curtain[2]
                    if k == 0: c = curtain[1]
                    if k == 2: c = curtain[4]
                    P.p(x, y, c)
            tx = 6 if side == 0 else 41
            P.rect(tx - 2, 14, tx + 2, 17, GOLD[3]); P.h(tx - 2, tx + 2, 14, GOLD[5]); P.p(tx, 18, GOLD[2]); P.p(tx, 19, GOLD[4])
    return tile(f)
def gothic_window_upper(curtain=CRIM):
    def f(P):
        f_arch = arch_top(8, 39, 34, 16)
        for x in range(7, 41):
            yt = f_arch(x) if 8 <= x <= 39 else 34
            P.v(x, max(17, yt - 1), 47, OUTL)
        for x in range(8, 40):
            yt = f_arch(x)
            P.v(x, yt, 47, WOOD[3])
        for x in range(11, 37):
            yt = f_arch(x) + 3
            for y in range(yt, 48):
                c = mix(SKY[3], SKY[4], (y - 18) / 30)
                if (x + y) % 8 == 0 or (x - y) % 8 == 0: c = mix(WOOD[1], SKY[3], 0.3)
                P.p(x, y, c)
        for x in range(8, 40): P.p(x, f_arch(x), WOOD[5])
        P.v(23, 22, 47, WOOD[2]); P.v(24, 22, 47, WOOD[4])
        P.ell(19, 26, 28, 35, None, WOOD[2]); P.p(23, 30, GOLD[5])                 # 장미창 고리
        P.rect(2, 19, 45, 21, WOOD[2]); P.h(2, 45, 19, GOLD[5]); P.p(2, 20, GOLD[4]); P.p(45, 20, GOLD[4])   # 커튼봉
        for side in (0, 1):
            for y in range(22, 48):
                w = 6
                for k in range(w):
                    x = 4 + k if side == 0 else 43 - k
                    c = curtain[3] if (k + (y // 3)) % 4 else curtain[2]
                    if k == 0: c = curtain[1]
                    if k == 2: c = curtain[4]
                    P.p(x, y, c)
        for x in range(4, 44, 3): P.p(x, 22, GOLD[3])                              # 술
    return tile(f)
def gothic_door(R=WOOD, sign=None, glass=False):
    def f(P):
        fa = arch_top(6, 41, 12, 0)
        for x in range(5, 43):
            P.v(x, max(0, fa(min(max(x, 6), 41)) - 1), 47, OUTL)
        for x in range(6, 42):
            P.v(x, fa(x), 47, R[4] if x < 9 else (R[2] if x > 38 else R[3]))
        for x in range(9, 39):                                                     # 세로 판자
            yt = fa(x) + 2
            c = R[3] if (x - 9) % 6 else R[1]
            P.v(x, yt, 46, c)
            if (x - 9) % 6 == 1: P.v(x, yt, 46, R[4])
        for x in range(6, 42): P.p(x, fa(x), R[5])
        if glass:
            fg = arch_top(16, 31, 12, 5)
            for x in range(16, 32):
                for y in range(fg(x), 17): P.p(x, y, mix(SKY[2], SKY[4], (y - 5) / 12))
            P.v(23, 6, 16, R[1])
        for yy in (14, 34):                                                        # 쇠 띠 경첩
            P.rect(9, yy, 30, yy + 2, IRON[3]); P.h(9, 30, yy, IRON[5]); P.h(9, 30, yy + 2, IRON[1])
            P.ell(28, yy - 1, 33, yy + 3, IRON[3]); P.p(29, yy, IRON[5])
            for x in range(11, 30, 5): P.p(x, yy + 1, IRON[6])
        P.ell(31, 23, 37, 29, None, GOLD[3]); P.ell(32, 24, 36, 28, None, GOLD[1]); P.p(32, 24, GOLD[6])   # 고리 손잡이
        P.rect(33, 21, 35, 23, GOLD[4])
        if sign: sign(P)
        P.shadow(6, 46, 41, 47, 100)
    return tile(f)

# ------------------------------------------------------------------ 벽 장식 변형
def portrait(P):
    P.shadow(13, 5, 36, 28, 60)
    P.ell(11, 2, 35, 27, OUTL); P.ell(12, 3, 34, 26, GOLD[3])
    P.ell(13, 4, 33, 25, GOLD[2]); P.ell(14, 5, 32, 24, H('1A1416'))
    for k in range(0, 360, 30):
        a = math.radians(k); P.p(int(23 + 10.5 * math.cos(a)), int(14.5 + 11 * math.sin(a)), GOLD[5])
    P.ell(19, 8, 27, 17, H('3A2E2C')); P.ell(16, 16, 30, 28, H('2A2224'))      # 얼굴 없는 인물
    P.rect(16, 22, 30, 24, H('2A2224'))
    P.p(20, 10, H('4A3C38')); P.p(21, 9, H('4A3C38'))
    P.p(13, 9, GOLD[6]); P.p(14, 7, GOLD[5])
def landscape(P):
    P.shadow(8, 6, 41, 27, 60)
    P.rect(6, 3, 41, 25, OUTL); P.rect(7, 4, 40, 24, GOLD[3])
    P.h(7, 40, 4, GOLD[5]); P.v(7, 4, 24, GOLD[4]); P.h(7, 40, 24, GOLD[1]); P.v(40, 4, 24, GOLD[2])
    for x in range(9, 39, 3): P.p(x, 5, GOLD[6]); P.p(x, 23, GOLD[2])
    for y in range(7, 22):
        P.h(10, 37, y, mix(H('1E2234'), H('3A3048'), (y - 7) / 15))
    P.ell(29, 9, 33, 13, H('D8D0B0')); P.p(30, 10, H('FFF8E0'))
    for x in range(10, 38):                                                         # 숲 실루엣
        hgt = 15 + int(3 * abs(math.sin(x * 1.3))) - (2 if x % 5 == 0 else 0)
        P.v(x, hgt, 21, H('120E14'))
    P.h(10, 37, 21, H('1A1418'))
def sconce(P):
    P.glow(23, 12, 18, H('FFB060'), 46)
    P.rect(21, 14, 26, 24, OUTL); P.rect(22, 15, 25, 23, GOLD[3]); P.v(22, 15, 23, GOLD[5])
    P.ell(19, 21, 28, 27, OUTL); P.ell(20, 22, 27, 26, GOLD[3]); P.h(21, 26, 22, GOLD[5])
    P.rect(18, 12, 29, 14, OUTL); P.rect(19, 12, 28, 13, GOLD[4]); P.h(19, 28, 12, GOLD[6])
    candle(P, 23, 5, 6)
    P.p(23, 27, GOLD[2]); P.p(23, 28, GOLD[4])
def crest(P):
    P.shadow(16, 5, 33, 26, 60)
    P.poly([(14, 3), (33, 3), (33, 14), (23, 25), (14, 14)], c=OUTL)
    P.poly([(15, 4), (32, 4), (32, 14), (23, 23), (15, 14)], c=WINE[4])
    P.h(15, 32, 4, WINE[6]); P.v(15, 4, 14, WINE[5])
    P.poly([(15, 4), (32, 4), (32, 14), (23, 23), (15, 14)], o=GOLD[4])
    P.rect(22, 7, 25, 19, GOLD[3]); P.rect(18, 10, 29, 12, GOLD[3]); P.v(22, 7, 19, GOLD[5]); P.h(18, 29, 10, GOLD[5])
    P.p(23, 11, GOLD[6])
    for (x, y) in [(13, 3), (34, 3)]: rosette(P, x, y)
def wood_cross(P):
    P.shadow(21, 6, 28, 28, 50)
    P.rect(21, 3, 26, 27, OUTL); P.rect(15, 9, 32, 14, OUTL)
    P.rect(22, 4, 25, 26, WOOD[4]); P.rect(16, 10, 31, 13, WOOD[4])
    P.v(22, 4, 26, WOOD[5]); P.h(16, 31, 10, WOOD[5]); P.v(25, 4, 26, WOOD[2]); P.h(16, 31, 13, WOOD[2])
    P.rect(22, 10, 25, 13, GOLD[3]); P.p(23, 11, GOLD[6])
def torn_paper(P, R):
    """벽지가 찢겨 회반죽이 드러난 자리."""
    pts = [(28, 6), (40, 4), (44, 12), (41, 22), (32, 20), (30, 13)]
    P.poly(pts, c=CREAM[3]); P.poly(pts, o=R[1])
    P.line(30, 13, 41, 22, CREAM[2]); P.p(33, 8, CREAM[5])
    P.poly([(40, 4), (44, 3), (44, 12)], c=R[4])                                    # 말려 들린 끝
def molding_medallion(P):
    P.ell(17, 22, 30, 35, OUTL); P.ell(18, 23, 29, 34, GOLD[3]); P.ell(20, 25, 27, 32, WOOD[2])
    P.p(23, 28, GOLD[6]); P.p(21, 24, GOLD[5]); P.p(26, 33, GOLD[1])
    for k in range(0, 360, 45):
        a = math.radians(k); P.p(int(23.5 + 7 * math.cos(a)), int(28.5 + 7 * math.sin(a)), GOLD[5])
def water_stain(P):
    for k in range(18):
        a = max(0, 60 - k * 3)
        for x in range(14 + k // 4, 34 - k // 3): P.p(x, 20 + k, A(H('3A2A18'), a))

# ------------------------------------------------------------------ 교실 소품
def blackboard(variant=0):
    def f(P):
        P.rect(0, 2, 47, 27, OUTL)
        P.rect(0, 3, 47, 26, WOOD[3]); P.h(0, 47, 3, WOOD[5]); P.h(0, 47, 4, WOOD[4])
        gold_bead(P, 0, 47, 5)
        B = RP('0C1612', '14221C', '1C2E26', '243A30', '2E483C', '3C5A4C', '507060')
        for y in range(8, 23):
            for x in range(48): P.p(x, y, B[3] if (x * 3 + y * 7) % 23 else B[2])
        chalk = H('D8E2DA'); faint = A(H('D8E2DA'), 70)
        rows = [[(3, 10, 22), (3, 14, 30), (3, 18, 12), (20, 18, 20)],
                [(5, 10, 14), (24, 10, 18), (5, 15, 34)],
                [(2, 11, 40), (2, 16, 18), (26, 16, 8)]][variant]
        for (x0, y0, w) in rows:
            for k in range(w):
                if (k * 7 + y0) % 5 != 0 and (k % 6) != 5: P.p(x0 + k, y0 + (1 if k % 6 == 2 else 0), chalk)
        if variant == 1: P.ell(36, 13, 44, 20, None, faint); P.line(40, 13, 40, 20, faint)
        if variant == 2: P.rect(30, 9, 44, 13, faint)
        P.rect(0, 23, 47, 26, WOOD[4]); P.h(0, 47, 23, WOOD[6]); P.h(0, 47, 26, WOOD[1])
        P.rect(30, 21, 35, 22, PAPER[6]); P.rect(9, 21, 13, 22, H('E8C4C8'))
        P.rect(17, 20, 24, 22, WOOD[1]); P.h(17, 24, 20, CREAM[4])
        P.h(0, 47, 28, A(OUTL, 110))
    return tile(f)
def clock(P):
    P.shadow(12, 4, 37, 29, 60)
    for k in range(0, 360, 20):                                                       # 햇살 테
        a = math.radians(k); P.line(23.5, 14.5, 23.5 + 14 * math.cos(a), 14.5 + 13 * math.sin(a), GOLD[3 if k % 40 else 4])
    P.ell(12, 3, 35, 26, OUTL); P.ell(13, 4, 34, 25, GOLD[3]); P.ell(14, 5, 33, 24, GOLD[5])
    P.ell(15, 6, 32, 23, PAPER[4]); P.ell(16, 7, 31, 22, PAPER[5])
    for k in range(12):
        a = math.radians(k * 30 - 90); P.p(int(23.5 + 6.6 * math.cos(a)), int(14.5 + 6.6 * math.sin(a)), OUTL)
    P.line(23, 14, 20, 18, OUTL, 2); P.line(23, 14, 25, 8, WOOD[1]); P.p(23, 14, CRIM[4])
    P.p(17, 8, (255, 255, 255, 200))
def school_desk(kind=0):
    def f(P):
        R = OAK
        for lx in (6, 39):                                                            # 돌림 다리
            P.rect(lx, 28, lx + 3, 44, OUTL)
            for y in range(29, 44): P.h(lx + 1, lx + 2, y, R[2] if y % 5 else R[4])
            P.v(lx + 1, 29, 43, R[3]); P.rect(lx, 43, lx + 3, 45, R[1])
        P.rect(6, 37, 42, 38, R[1]); P.h(6, 42, 37, R[3])
        P.rect(4, 20, 43, 30, OUTL); P.rect(5, 21, 42, 29, R[2])                     # 앞판
        P.rect(8, 23, 39, 27, R[1]); P.h(8, 39, 23, R[3]); rosette(P, 23, 25)
        P.rect(2, 6, 45, 21, OUTL); P.rect(3, 7, 44, 20, R[4])                       # 상판
        for y in range(8, 20):
            for x in range(3, 45):
                if (x + y * 9) % 17 == 0 or (x * 2 + y) % 23 == 0: P.p(x, y, R[3])
        P.h(3, 44, 7, R[6]); P.v(3, 7, 20, R[5]); P.h(3, 44, 20, R[2]); P.v(44, 7, 20, R[3])
        P.h(5, 20, 8, A(R[6], 140))
        P.ell(37, 9, 41, 12, OUTL); P.ell(38, 10, 40, 11, GOLD[3])                   # 잉크병 자리
        if kind == 1:
            P.line(10, 12, 19, 16, R[1]); P.line(24, 10, 27, 18, R[1]); P.line(28, 13, 34, 13, R[1]); P.p(15, 17, R[1])
        if kind == 2:                                                                 # 화장대 거울
            P.ell(15, 0, 32, 16, OUTL); P.ell(16, 1, 31, 15, GOLD[3])
            P.ell(17, 2, 30, 14, SKY[3]); P.ell(18, 3, 26, 9, SKY[4]); P.p(19, 4, (255, 255, 255, 200))
            P.rect(22, 15, 25, 18, GOLD[2])
        P.shadow(5, 45, 42, 47, 80)
    return tile(f)
def chair(P):
    R = OAK
    P.rect(13, 0, 34, 12, OUTL)
    P.rect(14, 1, 33, 11, R[3]); P.h(14, 33, 1, R[5])
    for x in (18, 23, 28): P.rect(x, 3, x + 1, 10, R[1]); P.p(x, 3, R[4])
    P.p(14, 0, GOLD[5]); P.p(33, 0, GOLD[5])
    P.rect(11, 12, 36, 26, OUTL); P.rect(12, 13, 35, 25, CRIM[3])                  # 벨벳 좌판
    P.rect(12, 13, 35, 14, CRIM[5]); P.h(12, 35, 25, CRIM[1])
    for x in range(14, 35, 5): P.p(x, 19, CRIM[2]); P.p(x, 18, CRIM[4])
    P.rect(11, 25, 36, 27, R[2]); P.h(11, 36, 25, GOLD[4])
    for lx in (12, 33):
        P.rect(lx, 27, lx + 2, 40, OUTL); P.v(lx + 1, 27, 39, R[3])
    P.shadow(12, 40, 35, 42, 70)
def podium(P):
    R = WOOD
    P.rect(4, 3, 43, 45, OUTL)
    P.rect(7, 13, 40, 44, R[3]); P.v(7, 13, 44, R[5]); P.v(40, 13, 44, R[1])
    fa = arch_top(12, 35, 24, 16)
    for x in range(12, 36):
        P.v(x, fa(x), 41, R[1])
        P.v(x, fa(x) + 1, 40, R[2])
    P.rect(22, 21, 25, 36, GOLD[3]); P.rect(18, 25, 29, 27, GOLD[3]); P.v(22, 21, 36, GOLD[5]); P.h(18, 29, 25, GOLD[5])
    P.rect(3, 4, 44, 13, OUTL); P.rect(4, 5, 43, 12, R[4]); P.h(4, 43, 5, R[6]); P.h(4, 43, 12, R[2])
    gold_bead(P, 4, 43, 10)
    P.rect(12, 5, 35, 9, PAPER[4]); P.h(12, 35, 5, PAPER[6]); P.v(23, 5, 9, PAPER[2])     # 펼친 출석부
    for k in range(2): P.h(14, 21, 7 + k, PAPER[2]); P.h(26, 33, 7 + k, PAPER[2])
    P.rect(23, 9, 24, 11, CRIM[4])
    P.shadow(5, 45, 42, 47, 90)
def bookcase(free=False, seed=0):
    def f(P):
        rnd = random.Random(seed)
        R = WOOD
        P.rect(1, 0, 46, 46 if free else 47, OUTL)
        P.rect(2, 1, 45, 45, R[3])
        P.rect(2, 1, 45, 4, R[4]); P.h(2, 45, 1, R[6]); gold_bead(P, 2, 45, 3)
        P.v(2, 1, 45, R[5]); P.v(3, 1, 45, R[4]); P.v(44, 1, 45, R[1]); P.v(45, 1, 45, R[2])
        P.rect(5, 7, 42, 43, R[0])
        for row in range(3):
            y0 = 7 + row * 12; x = 5
            while x < 42:
                w = rnd.choice([2, 3, 3, 3, 4]); hgt = rnd.choice([8, 9, 9, 10, 10])
                if x + w > 42: break
                L = rnd.choice(LEATH)
                if rnd.random() < 0.1 and x + 6 < 42:
                    for k in range(8): P.rect(x + k // 3, y0 + 10 - k, x + k // 3 + 2, y0 + 10 - k, L[3])
                    x += 5; continue
                top = y0 + 10 - hgt
                P.rect(x, top, x + w - 1, y0 + 10, L[3]); P.v(x, top, y0 + 10, L[4]); P.v(x + w - 1, top, y0 + 10, L[1])
                P.h(x, x + w - 1, top, L[5])
                P.h(x, x + w - 1, top + 2, GOLD[3]); P.h(x, x + w - 1, y0 + 8, GOLD[2])
                x += w
            P.rect(4, y0 + 11, 43, y0 + 12, R[4]); P.h(4, 43, y0 + 11, R[6])
            P.h(5, 42, y0, A(OUTL, 120))
        if free: P.shadow(1, 46, 46, 47, 100)
    return tile(f)
def reading_table(book=False):
    def f(P):
        R = WOOD
        P.rect(0, 6, 47, 34, OUTL)
        P.rect(0, 7, 47, 27, R[4])
        for y in range(8, 27):
            for x in range(48):
                if (x * 3 + y * 11) % 29 == 0: P.p(x, y, R[3])
        P.h(0, 47, 7, R[6]); P.h(0, 47, 27, R[2])
        P.rect(0, 28, 47, 33, R[2]); gold_bead(P, 0, 47, 28)                        # 앞치마 조각
        for x in range(4, 48, 8): rosette(P, x, 31, GOLD)
        if book:
            P.rect(12, 9, 35, 25, OUTL); P.rect(13, 10, 34, 24, PAPER[4]); P.rect(13, 10, 34, 11, PAPER[6])
            P.v(23, 10, 24, PAPER[1]); P.v(24, 10, 24, PAPER[3])
            for k in range(4): P.h(15, 21, 13 + k * 3, PAPER[1]); P.h(26, 32 - (k % 2) * 2, 13 + k * 3, PAPER[1])
            P.rect(21, 7, 22, 12, CRIM[4]); P.shadow(13, 25, 35, 26, 80)
    return tile(f)
def bed(Rb):
    """침대 머리 칸 (v3.0): 2칸짜리 침대의 위쪽. 기둥 달린 머리판, 베개, 접힌 시트, 이불 시작."""
    def f(P):
        R = WOOD
        P.shadow(5, 0, 42, 47, 40)
        # 몸체(매트리스 옆면 나무 레일)
        P.rect(6, 8, 41, 47, OUTL); P.rect(7, 9, 40, 47, PAPER[3])
        P.v(7, 9, 47, R[3]); P.v(8, 9, 47, R[2]); P.v(40, 9, 47, R[2]); P.v(39, 9, 47, R[1])
        # 머리판
        P.rect(5, 1, 42, 11, OUTL); P.rect(6, 2, 41, 10, R[3]); P.h(6, 41, 2, R[5]); P.h(6, 41, 10, R[1])
        fa = arch_top(12, 35, 9, 3)
        for x in range(12, 36): P.v(x, fa(x), 9, R[2]); P.p(x, fa(x), R[4])
        for px in (5, 38):                                                    # 기둥과 둥근 꼭지
            P.rect(px, 0, px + 4, 12, OUTL); P.rect(px + 1, 1, px + 3, 11, R[4]); P.v(px + 1, 1, 11, R[5])
            P.ell(px, -1, px + 4, 3, R[5]); P.p(px + 1, 0, R[6])
        # 시트 바탕
        P.rect(9, 11, 38, 47, PAPER[4]); P.v(9, 11, 47, PAPER[5])
        # 베개
        P.rect(12, 13, 35, 24, OUTL); P.rect(13, 13, 34, 23, PAPER[6]); P.rect(12, 14, 35, 23, PAPER[6])
        P.h(14, 33, 13, H('FFFFFF')); P.h(13, 34, 23, PAPER[3]); P.v(34, 14, 23, PAPER[3])
        P.line(17, 18, 30, 18, PAPER[4]); P.p(23, 16, PAPER[4]); P.p(24, 20, PAPER[4])
        P.h(12, 35, 25, A(OUTL, 70))
        # 접힌 시트 끝단
        P.rect(8, 30, 39, 34, PAPER[6]); P.h(8, 39, 30, H('FFFFFF')); P.h(8, 39, 34, PAPER[2])
        for x in range(10, 38, 3): P.p(x, 32, PAPER[3])
        # 이불 시작
        P.rect(7, 35, 40, 47, Rb[3]); P.h(7, 40, 35, Rb[5]); P.v(7, 35, 47, Rb[4]); P.v(40, 35, 47, Rb[1])
        P.v(6, 36, 47, OUTL); P.v(41, 36, 47, OUTL)
        for x in range(12, 36, 8): P.v(x, 38, 47, mix(Rb[3], Rb[2], 0.5))
    return tile(f)
def bed_foot(Rb):
    """침대 발치 칸: 이불이 이어지다 발판에서 끝남. 이불 옆단이 레일 위로 늘어짐."""
    def f(P):
        R = WOOD
        P.shadow(5, 0, 42, 47, 40)
        P.rect(6, 0, 41, 37, OUTL)
        P.rect(7, 0, 40, 36, Rb[3])
        P.v(7, 0, 36, Rb[4]); P.v(8, 0, 36, Rb[4]); P.v(40, 0, 36, Rb[1]); P.v(39, 0, 36, Rb[2])
        for x in range(12, 36, 8): P.v(x, 0, 30, mix(Rb[3], Rb[2], 0.5))
        for k in range(3):                                                   # 무릎께 주름
            y = 10 + k * 7
            P.line(14, y, 22, y + 3, Rb[2]); P.line(15, y - 1, 22, y + 2, Rb[4])
            P.line(27, y + 2, 34, y - 1, Rb[2])
        P.h(7, 40, 33, Rb[2]); P.h(7, 40, 34, Rb[1]); P.h(8, 39, 35, Rb[4])     # 이불 끝단
        # 발판
        P.rect(5, 36, 42, 45, OUTL); P.rect(6, 37, 41, 44, R[3]); P.h(6, 41, 37, R[5]); P.h(6, 41, 44, R[1])
        for x0 in (11, 24): P.rect(x0, 39, x0 + 11, 42, R[2]); P.h(x0, x0 + 11, 39, R[1])
        for px in (5, 38): P.rect(px, 35, px + 4, 46, OUTL); P.rect(px + 1, 36, px + 3, 45, R[4]); P.v(px + 1, 36, 45, R[5])
        P.shadow(6, 46, 41, 47, 110)
    return tile(f)
def runner(P):
    """기숙사 깔개: 가로로 이어지는 붉은 러너. 위아래만 금 테, 메달 무늬가 48px마다."""
    P.rect(0, 9, 47, 39, OUTL)
    P.rect(0, 10, 47, 38, CRIM[3])
    gold_bead(P, 0, 47, 11); gold_bead(P, 0, 47, 35)
    for x in range(48):
        if x % 4 == 0: P.p(x, 14, GOLD[2]); P.p(x, 33, GOLD[2])
    for d in range(-9, 10):
        w = 9 - abs(d)
        P.h(24 - w * 2, 24 + w * 2, 24 + d, CRIM[2])
    for d in range(-6, 7):
        w = 6 - abs(d)
        P.h(24 - w * 2, 24 + w * 2, 24 + d, CRIM[4])
    rosette(P, 24, 24)
    for x0 in (0, 47):
        for d in range(-4, 5): P.p(x0, 24 + d, GOLD[3])
    for x in range(1, 47, 2): P.p(x, 8, GOLD[2]); P.p(x, 40, GOLD[2])
def mat_t(P):
    P.rect(5, 28, 42, 46, OUTL); P.rect(6, 29, 41, 45, CRIM[3])
    P.box(8, 31, 39, 43, GOLD[3]); P.h(9, 38, 32, CRIM[5])
    for x in range(11, 38, 4): P.p(x, 37, GOLD[4])
def plant(P):
    G = RP('101C10', '18281A', '223822', '2E4A2C', '3C5E36', '507444', '6E8E58')
    P.shadow(13, 44, 34, 47, 90)
    P.poly([(14, 31), (33, 31), (30, 44), (17, 44)], c=OUTL)                    # 놋쇠 화분
    P.poly([(15, 32), (32, 32), (29, 43), (18, 43)], c=GOLD[3])
    P.v(18, 33, 42, GOLD[5]); P.v(28, 33, 42, GOLD[2]); P.h(16, 31, 36, GOLD[1]); P.h(16, 31, 35, GOLD[5])
    P.rect(13, 29, 34, 32, OUTL); P.rect(14, 30, 33, 31, GOLD[4]); P.h(14, 33, 30, GOLD[6])
    fronds = [(23, 29, 23, 4), (23, 29, 10, 10), (23, 29, 36, 10), (23, 29, 6, 22), (23, 29, 41, 22), (23, 29, 15, 6), (23, 29, 32, 5)]
    for (x0, y0, x1, y1) in fronds:
        n = 12
        for k in range(1, n):
            t = k / n
            x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t - 4 * math.sin(t * 3.14)
            P.p(int(x), int(y), G[2])
            if k % 2 == 0 and k < n - 1:
                dx, dy = (y1 - y0) / n, -(x1 - x0) / n
                for s in (-1, 1):
                    P.line(int(x), int(y), int(x + s * dx * 1.8), int(y + s * dy * 1.8 - 1), G[4] if s < 0 else G[3])
            P.p(int(x), int(y) - 1, G[5]) if k % 4 == 0 else None
def dresser(P):
    R = WOOD
    P.rect(4, 3, 43, 45, OUTL)
    P.rect(5, 4, 42, 44, R[3]); P.v(5, 4, 44, R[5]); P.v(42, 4, 44, R[1])
    P.rect(3, 2, 44, 6, OUTL); P.rect(4, 3, 43, 5, MARB[4]); P.h(4, 43, 3, MARB[6])    # 대리석 상판
    for k in range(3):
        y0 = 8 + k * 12
        P.rect(8, y0, 39, y0 + 10, R[1]); P.rect(9, y0 + 1, 38, y0 + 9, R[3])
        P.h(9, 38, y0 + 1, R[5]); P.h(9, 38, y0 + 9, R[2])
        P.ell(20, y0 + 3, 27, y0 + 7, OUTL); P.ell(21, y0 + 4, 26, y0 + 6, GOLD[4]); P.p(22, y0 + 4, GOLD[6])
    for lx in (6, 39): P.rect(lx, 44, lx + 2, 46, OUTL)
    P.shadow(4, 46, 43, 47, 90)

# ------------------------------------------------------------------ 복도 소품
STR = RP('1A1620', '2C2834', '423C4E', '5E566C', '7E7690', 'A49CB4', 'CEC6DC')
def stairs(P):
    """계단 (v3.0): 벽에 뚫린 계단참. 아래(가까운 쪽)가 밝고 위(먼 쪽)로 갈수록 어두워져 벽 안으로 이어지는 계단으로 읽힘.
    디딤판(밝음)과 챌판(검정)이 또렷하게 번갈고, 가운데 붉은 카펫, 양옆 난간."""
    P.rect(0, 0, 47, 47, H('0A080C'))
    for k in range(6):
        y0 = k * 8; d = (5 - k) / 5.0                       # 위쪽 단일수록 d가 커서 어둡다
        top = mix(STR[6], STR[2], d); face = mix(STR[4], STR[1], d)
        P.rect(4, y0, 43, y0 + 1, mix(STR[0], H('000000'), 0.4))                   # 챌판(검정)
        P.rect(4, y0 + 2, 43, y0 + 7, face); P.h(4, 43, y0 + 2, top)               # 디딤판 + 코 끝 빛
        P.rect(15, y0 + 2, 32, y0 + 7, mix(CRIM[4], CRIM[1], d)); P.h(15, 32, y0 + 2, mix(CRIM[5], CRIM[2], d))
        P.rect(15, y0, 32, y0 + 1, mix(CRIM[1], CRIM[0], d))
        P.p(15, y0 + 2, GOLD[3]); P.p(32, y0 + 2, GOLD[3])
    for x0 in (0, 44):
        P.rect(x0, 0, x0 + 3, 47, H('1C141C')); P.v(x0 + 1, 0, 47, H('5A4A58')); P.v(x0 + 2, 0, 47, H('2E242E'))
        for y in range(3, 48, 8): P.rect(x0, y, x0 + 3, y + 1, H('6A5A68'))
def stair_well(P):
    """계단 윗칸: 아치형으로 뚫린 어두운 계단 통로. 계단이 어둠 속으로 이어짐."""
    fa = arch_top(3, 44, 24, 12)
    for x in range(2, 46): P.v(x, max(12, fa(min(max(x, 3), 44)) - 1), 47, OUTL)
    for x in range(3, 45): P.v(x, fa(x), 47, H('2A2232'))
    for x in range(6, 42):
        for y in range(fa(x) + 3, 48): P.p(x, y, H('050407'))
    for k in range(3):                                       # 어둠 속 희미한 단
        y0 = 47 - k * 6
        P.h(10, 37, y0 - 4, mix(STR[2], H('050407'), k / 3)); P.h(18, 29, y0 - 4, mix(CRIM[2], H('050407'), k / 3))
    for x in range(3, 45): P.p(x, fa(x), H('6A5A78'))
def iron_banded_door(P):
    fa = arch_top(6, 41, 10, 0)
    for x in range(5, 43): P.v(x, max(0, fa(min(max(x, 6), 41)) - 1), 47, OUTL)
    for x in range(6, 42): P.v(x, fa(x), 47, WOOD[2] if (x - 6) % 7 else WOOD[0])
    for x in range(6, 42): P.p(x, fa(x), WOOD[4])
    for yy in (12, 26, 38):
        P.rect(6, yy, 41, yy + 3, IRON[3]); P.h(6, 41, yy, IRON[5]); P.h(6, 41, yy + 3, IRON[1])
        for x in range(8, 41, 6): P.p(x, yy + 1, IRON[6]); P.p(x, yy + 2, IRON[1])
    P.rect(30, 18, 35, 24, OUTL); P.rect(31, 19, 34, 23, GOLD[2]); P.rect(32, 21, 33, 22, OUTL)
    P.shadow(6, 46, 41, 47, 110)
def notice_board(P):
    P.shadow(4, 4, 45, 30, 60)
    P.rect(2, 2, 45, 28, OUTL); P.rect(3, 3, 44, 27, WOOD[3]); P.h(3, 44, 3, WOOD[5]); gold_bead(P, 3, 44, 4)
    P.rect(6, 8, 41, 25, H('8A6A48'))
    for y in range(8, 26):
        for x in range(6, 42):
            if (x * 7 + y * 3) % 11 == 0: P.p(x, y, H('7A5C3E'))
            elif (x + y * 5) % 13 == 0: P.p(x, y, H('9A7A56'))
    papers = [(8, 10, 10, 9, PAPER[5], CRIM[4]), (20, 9, 9, 12, PAPER[4], NAVY[5]), (31, 11, 8, 8, PAPER[5], GOLD[4]), (9, 20, 12, 5, PAPER[3], GREEN[5])]
    for (a, b, w, hh, col, pin) in papers:
        P.shadow(a + 1, b + 1, a + w, b + hh, 70)
        P.rect(a, b, a + w - 1, b + hh - 1, col); P.h(a, a + w - 1, b, PAPER[6])
        for k in range(2, hh - 1, 2): P.h(a + 2, a + w - 3 - (k % 3), b + k, PAPER[1])
        P.p(a + w // 2, b + 1, pin); P.p(a + w // 2, b, mix(pin, H('FFFFFF'), 0.5))
def restroom_sign(P):
    P.rect(16, 25, 31, 32, OUTL); P.rect(17, 26, 30, 31, GOLD[3]); P.h(17, 30, 26, GOLD[5])
    P.ell(19, 27, 21, 29, OUTL); P.rect(19, 29, 21, 31, OUTL); P.ell(26, 27, 28, 29, CRIM[2]); P.poly([(25, 31), (27, 29), (29, 31)], c=CRIM[2])
def entrance(P):
    fa = arch_top(3, 44, 14, 0)
    for x in range(2, 46): P.v(x, max(0, fa(min(max(x, 3), 44)) - 1), 47, OUTL)
    for x in range(3, 45): P.v(x, fa(x), 47, WOOD[3])
    for x0 in (6, 25):
        for x in range(x0, x0 + 16):
            for y in range(max(fa(x) + 3, 3), 47): P.p(x, y, mix(SKY[1], SKY[4], (y - 3) / 44))
        for y in range(6, 47, 8): P.h(x0, x0 + 15, y, WOOD[2])
        P.line(x0 + 2, 10, x0 + 7, 17, (255, 255, 255, 70))
    P.rect(22, 0, 24, 47, WOOD[2]); P.v(22, 0, 47, WOOD[4])
    for x in range(3, 45): P.p(x, fa(x), GOLD[4])
    P.rect(19, 24, 21, 30, GOLD[4]); P.rect(26, 24, 28, 30, GOLD[4])
def wood_lockers(P):
    """복도 사물함: 짙은 나무 캐비닛 4칸, 놋쇠 번호판과 열쇠 구멍."""
    R = WOOD
    P.rect(0, 0, 47, 45, OUTL)
    P.rect(1, 1, 46, 44, R[2])
    for k in range(4):
        x0 = 2 + k * 11
        P.rect(x0, 2, x0 + 9, 43, R[3])
        P.v(x0, 2, 43, R[5]); P.h(x0, x0 + 9, 2, R[5]); P.v(x0 + 9, 2, 43, R[1]); P.h(x0, x0 + 9, 43, R[1])
        P.rect(x0 + 2, 5, x0 + 7, 17, R[2]); P.h(x0 + 2, x0 + 7, 5, R[1]); P.h(x0 + 2, x0 + 7, 17, R[4])
        for y in range(7, 16, 2): P.h(x0 + 3, x0 + 6, y, R[1])                    # 통풍 홈
        P.rect(x0 + 3, 20, x0 + 6, 23, GOLD[3]); P.h(x0 + 3, x0 + 6, 20, GOLD[5]); P.p(x0 + 4, 22, OUTL); P.p(x0 + 5, 21, OUTL)
        P.p(x0 + 7, 29, OUTL); P.p(x0 + 7, 30, OUTL); P.p(x0 + 7, 28, GOLD[4])
        P.rect(x0 + 2, 33, x0 + 7, 41, R[2]); P.h(x0 + 2, x0 + 7, 33, R[1]); P.h(x0 + 2, x0 + 7, 41, R[4])
    gold_bead(P, 1, 46, 0)
    P.shadow(0, 45, 47, 47, 110)
def gilded_mirror_sink(P):
    P.shadow(10, 3, 39, 28, 60)
    fa = arch_top(9, 38, 10, 0)
    for x in range(9, 39):
        P.v(x, fa(x), 24, OUTL)
    for x in range(10, 38):
        P.v(x, fa(x) + 1, 23, GOLD[3])
    for x in range(13, 35):
        for y in range(fa(x) + 4, 21): P.p(x, y, mix(SKY[4], SKY[2], (y - 3) / 18))
    for x in range(10, 38): P.p(x, fa(x) + 1, GOLD[5])
    P.line(16, 8, 22, 15, (255, 255, 255, 120)); rosette(P, 23, 2)
    P.rect(21, 25, 26, 30, GOLD[2]); P.h(20, 27, 25, GOLD[5])
    P.ell(7, 28, 40, 44, OUTL); P.ell(8, 29, 39, 43, PAPER[5]); P.ell(12, 31, 35, 40, PAPER[2]); P.ell(13, 31, 34, 39, PAPER[3])
    P.p(23, 36, OUTL); P.h(10, 30, 29, PAPER[6])
    P.rect(20, 43, 27, 47, PAPER[3]); P.v(20, 43, 47, PAPER[5])
def wood_stall(P):
    R = WOOD
    P.rect(2, 0, 45, 47, OUTL)
    P.rect(3, 1, 44, 47, R[3]); P.v(3, 1, 47, R[5]); P.v(44, 1, 47, R[1])
    gold_bead(P, 3, 44, 1)
    for (y0, y1) in [(6, 20), (24, 44)]:
        P.rect(7, y0, 40, y1, R[1]); P.rect(8, y0 + 1, 39, y1 - 1, R[3]); P.h(8, 39, y0 + 1, R[5]); P.v(8, y0 + 1, y1 - 1, R[4])
    P.rect(34, 21, 38, 26, GOLD[3]); P.rect(35, 23, 37, 24, CRIM[4])

# ------------------------------------------------------------------ 급식실 소품
def long_table(P):
    R = WOOD
    P.rect(0, 4, 47, 38, OUTL)
    P.rect(0, 5, 47, 31, R[4])
    for y in range(6, 31):
        for x in range(48):
            if (x * 3 + y * 11) % 29 == 0: P.p(x, y, R[3])
    P.h(0, 47, 5, R[6])
    P.rect(0, 12, 47, 24, PAPER[4]); P.h(0, 47, 12, PAPER[6]); P.h(0, 47, 24, PAPER[1])   # 흰 식탁보 러너
    P.h(0, 47, 13, CRIM[4]); P.h(0, 47, 23, CRIM[3])
    P.rect(0, 32, 47, 37, R[2]); gold_bead(P, 0, 47, 32)
    P.rect(3, 38, 5, 43, OUTL); P.rect(42, 38, 44, 43, OUTL)
    P.shadow(0, 38, 47, 40, 80)
def steel_counter(pans=('7A4A3A', 'E8DCC0'), tickets=False):
    def f(P):
        S = RP('2A2C32', '40424A', '5A5C66', '767884', '9294A0', 'AEB0BC', 'D0D2DC')
        P.rect(0, 2, 47, 46, OUTL)
        P.rect(0, 3, 47, 25, S[4]); P.h(0, 47, 3, S[6]); P.h(0, 47, 4, S[5]); P.h(0, 47, 25, S[2])
        for k, col in enumerate(pans):
            x0 = 4 + k * 22
            P.rect(x0, 7, x0 + 17, 22, OUTL); P.rect(x0 + 1, 8, x0 + 16, 21, H('B87A48')); P.h(x0 + 1, x0 + 16, 8, H('E0A070'))   # 구리 통
            Rc = RP(*[col] * 7); base = H(col)
            P.rect(x0 + 2, 10, x0 + 15, 20, base)
            for y in range(10, 21):
                for x in range(x0 + 2, x0 + 16):
                    if (x * 3 + y * 5) % 7 == 0: P.p(x, y, mix(base, OUTL, 0.3))
                    elif (x + y * 3) % 11 == 0: P.p(x, y, mix(base, H('FFFFFF'), 0.35))
        P.rect(0, 26, 47, 45, WOOD[3]); P.h(0, 47, 26, WOOD[5])                   # 나무 몸통
        for x0 in (2, 26):
            P.rect(x0, 29, x0 + 19, 43, WOOD[1]); P.rect(x0 + 1, 30, x0 + 18, 42, WOOD[3]); P.h(x0 + 1, x0 + 18, 30, WOOD[5])
        gold_bead(P, 0, 47, 26)
        if tickets:
            for (a, b) in [(14, 24), (19, 28)]:
                P.rect(a, b, a + 15, b + 7, OUTL); P.rect(a + 1, b + 1, a + 14, b + 6, PAPER[5]); P.h(a + 3, a + 10, b + 3, GOLD[2]); P.p(a + 12, b + 3, CRIM[4])
        P.shadow(0, 46, 47, 47, 90)
    return tile(f)
def icebox(P):
    C = CREAM
    P.rect(5, 0, 42, 47, OUTL)
    P.rect(6, 1, 41, 46, C[5]); P.v(6, 1, 46, C[6]); P.v(41, 1, 46, C[2]); P.h(6, 1, 41, C[6])
    P.rect(6, 1, 41, 4, C[4])
    P.rect(6, 17, 41, 18, C[2]); P.h(6, 41, 19, C[6])
    for (y0, y1) in [(6, 14), (22, 38)]:
        P.rect(35, y0, 37, y1, OUTL); P.v(35, y0, y1, MARB[6]); P.v(36, y0, y1, MARB[3])
    P.rect(10, 6, 17, 12, H('E8D8A0')); P.h(11, 16, 8, GOLD[2])
    P.rect(12, 24, 20, 30, PAPER[5]); P.p(16, 24, CRIM[4])
    P.rect(8, 42, 39, 44, MARB[4]); P.h(8, 39, 42, MARB[6])
    P.shadow(6, 46, 41, 47, 110)
def menu_board(P):
    P.shadow(5, 4, 44, 30, 60)
    P.rect(3, 2, 44, 28, OUTL); P.rect(4, 3, 43, 27, WOOD[3]); P.h(4, 43, 3, WOOD[5]); gold_bead(P, 4, 43, 4)
    B = RP('0C1612', '14221C', '1C2E26', '243A30', '2E483C', '3C5A4C', '507060')
    P.rect(7, 8, 40, 25, B[3])
    P.h(10, 22, 10, H('F0D8A0'))
    for k in range(4):
        y = 14 + k * 3; w = [24, 18, 21, 12][k]
        for x in range(10, 10 + w):
            if (x + k) % 6: P.p(x, y, PAPER[5])
    P.ell(32, 17, 38, 23, CRIM[4]); P.p(33, 18, CRIM[6])
def floor_hatch(P):
    P.rect(5, 5, 42, 42, OUTL)
    P.rect(6, 6, 41, 41, IRON[3]); P.h(6, 41, 6, IRON[5]); P.v(6, 6, 41, IRON[4]); P.h(6, 41, 41, IRON[1])
    P.rect(9, 9, 38, 38, H('08060A'))
    for k in range(3):
        y0 = 12 + k * 9
        P.rect(13, y0, 34, y0 + 3, WOOD[3]); P.h(13, 34, y0, WOOD[5]); P.h(13, 34, y0 + 3, WOOD[1])
    for (x, y) in [(8, 8), (39, 8), (8, 39), (39, 39)]: P.p(x, y, IRON[6])
def bench(P):
    R = WOOD
    P.rect(0, 12, 47, 30, OUTL)
    P.rect(0, 13, 47, 26, R[4])
    for y in (17, 21): P.h(0, 47, y, R[2]); P.h(0, 47, y + 1, R[5])
    P.h(0, 47, 13, R[6]); P.rect(0, 26, 47, 29, R[2]); gold_bead(P, 0, 47, 26)
    for lx in (4, 40): P.rect(lx, 30, lx + 3, 38, OUTL); P.rect(lx + 1, 30, lx + 2, 37, R[2])
    P.shadow(2, 38, 45, 40, 80)
def serve_line(left=False, right=False, pans=(), extra=None):
    def f(P):
        S = RP('2A2C32', '40424A', '5A5C66', '767884', '9294A0', 'AEB0BC', 'D0D2DC')
        x0 = 4 if left else 0; x1 = 43 if right else 47
        P.rect(x0, 3, x1, 46, OUTL)
        P.rect(x0, 4, x1, 26, S[4]); P.h(x0, x1, 4, S[6]); P.h(x0, x1, 5, S[5]); P.h(x0, x1, 26, S[2])
        P.rect(x0, 27, x1, 44, WOOD[3]); P.h(x0, x1, 27, WOOD[5]); gold_bead(P, x0, x1, 27)
        for x in range(x0 + 4, x1, 12): P.rect(x, 32, x + 7, 41, WOOD[1]); P.rect(x + 1, 33, x + 6, 40, WOOD[3]); P.h(x + 1, x + 6, 33, WOOD[5])
        if left: P.v(x0, 4, 44, S[1]); P.v(x0 + 1, 4, 44, S[6])
        if right: P.v(x1, 4, 44, S[1]); P.v(x1 - 1, 4, 44, S[2])
        for (px, col) in pans:
            P.rect(px, 8, px + 15, 23, OUTL); P.rect(px + 1, 9, px + 14, 22, H('B87A48')); P.h(px + 1, px + 14, 9, H('E0A070'))
            base = H(col); P.rect(px + 2, 11, px + 13, 21, base)
            for y in range(11, 22):
                for x in range(px + 2, px + 14):
                    if (x * 3 + y * 5) % 7 == 0: P.p(x, y, mix(base, OUTL, 0.3))
                    elif (x + y * 3) % 11 == 0: P.p(x, y, mix(base, H('FFFFFF'), 0.35))
        if extra: extra(P)
        P.shadow(x0, 46, x1, 47, 90)
    return tile(f)

# ------------------------------------------------------------------ 예배당 소품
def stained(P, y_top, y_bot, arch=True):
    cols = [CRIM, NAVYV, GOLD, WINE, TEAL, RP('2A0A2A', '3E1040', '561858', '702274', '8A3090', 'A848AC', 'C46CC6')]
    fa = arch_top(10, 37, y_top + 10, y_top) if arch else (lambda x: y_top)
    for x in range(9, 39):
        yt = fa(min(max(x, 10), 37)) - 1
        P.v(x, max(0, yt), y_bot, OUTL)
    for x in range(11, 37):
        for y in range(fa(x) + 1, y_bot):
            cell = ((x - 11) // 5 + (y // 6) * 3) % len(cols)
            R = cols[cell]
            c = R[4] if (x + y) % 5 else R[5]
            if (x - 11) % 5 == 0 or y % 6 == 0: c = OUTL
            P.p(x, y, c)
    for x in range(10, 38): P.p(x, fa(x), GOLD[4])
    P.v(23, fa(23), y_bot, GOLD[3]); P.v(24, fa(24), y_bot, OUTL)
def altar(P):
    P.rect(1, 9, 46, 46, OUTL)
    P.rect(2, 10, 45, 44, PAPER[4]); P.h(2, 45, 10, PAPER[6])
    for x in range(4, 45, 6): P.v(x, 28, 44, PAPER[2]); P.v(x + 1, 28, 44, PAPER[5])
    P.rect(17, 10, 30, 44, CRIM[3]); P.v(17, 10, 44, CRIM[5]); P.v(30, 10, 44, CRIM[1])
    for y in range(13, 43, 5): rosette(P, 23, y)
    gold_bead(P, 2, 45, 27)
    for x in range(3, 45, 3): P.p(x, 45, GOLD[3]); P.p(x + 1, 46, GOLD[2])
    P.rect(21, 0, 26, 12, OUTL); P.rect(17, 3, 30, 7, OUTL)
    P.rect(22, 1, 25, 11, GOLD[4]); P.rect(18, 4, 29, 6, GOLD[4]); P.v(22, 1, 11, GOLD[6]); P.h(18, 29, 4, GOLD[6]); P.v(25, 1, 11, GOLD[2])
    for cx in (7, 40):
        P.rect(cx - 2, 9, cx + 2, 10, GOLD[3]); candle(P, cx, 3, 6)
def cloth_table(plates=False):
    def f(P):
        P.rect(0, 4, 47, 40, OUTL)
        P.rect(0, 5, 47, 33, PAPER[4]); P.h(0, 47, 5, PAPER[6]); P.h(0, 47, 6, PAPER[5])
        for x in range(2, 47, 8): P.v(x, 26, 33, PAPER[2]); P.v(x + 1, 26, 33, PAPER[5])
        P.rect(0, 34, 47, 38, CRIM[3]); P.h(0, 47, 34, CRIM[5]); P.h(0, 47, 38, CRIM[1])
        for x in range(1, 47, 3): P.p(x, 39, GOLD[3])
        if plates:
            for cx in (12, 36):
                P.ell(cx - 10, 10, cx + 10, 28, OUTL); P.ell(cx - 9, 10, cx + 9, 27, PAPER[6])
                P.ell(cx - 7, 12, cx + 7, 25, None, GOLD[4]); P.ell(cx - 5, 14, cx + 5, 23, PAPER[5])
                P.p(cx - 5, 12, H('FFFFFF')); P.h(cx - 3, cx + 3, 19, PAPER[2])
                P.v(cx + 11, 12, 26, MARB[5]); P.v(cx - 11, 12, 26, MARB[5]); P.p(cx + 11, 12, MARB[6])
    return tile(f)
def pew(P):
    R = WOOD
    P.rect(0, 5, 47, 21, OUTL)
    P.rect(0, 6, 47, 19, R[3])
    for x in range(0, 48, 12):
        fa = arch_top(x + 2, x + 9, 14, 8)
        for xx in range(x + 2, x + 10): P.v(xx, fa(xx), 18, R[1]); P.p(xx, fa(xx), R[4])
    P.h(0, 47, 6, R[5]); gold_bead(P, 0, 47, 19)
    P.rect(0, 22, 47, 33, OUTL)
    P.rect(0, 23, 47, 31, R[4]); P.h(0, 47, 23, R[6])
    P.rect(0, 25, 47, 29, CRIM[3]); P.h(0, 47, 25, CRIM[5]); P.h(0, 47, 29, CRIM[1])
    for x in range(3, 48, 6): P.p(x, 27, CRIM[2])
    for lx in (3, 41): P.rect(lx, 33, lx + 3, 42, OUTL); P.rect(lx + 1, 33, lx + 2, 41, R[2])
    P.shadow(0, 42, 47, 44, 80)
def candelabra(P):
    P.glow(23, 6, 22, H('FFB050'), 40)
    P.ell(14, 41, 33, 46, (0, 0, 0, 90))
    P.rect(15, 39, 32, 44, OUTL); P.rect(16, 40, 31, 43, GOLD[3]); P.h(16, 31, 40, GOLD[5]); P.h(16, 31, 43, GOLD[1])
    P.rect(21, 18, 26, 40, OUTL)
    for y in range(19, 40): P.h(22, 25, y, GOLD[4] if y % 6 in (0, 1) else GOLD[3])
    P.v(22, 19, 39, GOLD[5]); P.v(25, 19, 39, GOLD[1])
    for (x0, x1) in [(10, 22), (25, 37)]:                                           # 양팔
        for x in range(x0, x1 + 1):
            y = 18 - int(4 * math.sin((x - x0) / (x1 - x0) * 3.14)) if x0 == 10 else 18 - int(4 * math.sin((x1 - x) / (x1 - x0) * 3.14))
            P.p(x, y, GOLD[4]); P.p(x, y + 1, GOLD[2])
    for cx in (11, 23, 36):
        P.rect(cx - 2, 14, cx + 2, 16, GOLD[3]); P.h(cx - 2, cx + 2, 14, GOLD[5])
        candle(P, cx, 7, 6)
def chapel_runner(P):
    P.rect(0, 0, 47, 47, CRIM[3])
    for y in range(48):
        P.p(2, y, GOLD[3]); P.p(45, y, GOLD[3]); P.p(3, y, GOLD[1]); P.p(44, y, GOLD[1])
        if y % 4 == 0: P.p(5, y, GOLD[4]); P.p(42, y, GOLD[4])
    for d in range(-10, 11):
        w = 10 - abs(d)
        P.h(24 - w, 24 + w, 24 + d, CRIM[2])
    for d in range(-6, 7):
        w = 6 - abs(d); P.h(24 - w, 24 + w, 24 + d, CRIM[4])
    rosette(P, 24, 24); rosette(P, 24, 2); rosette(P, 24, 46)

# ------------------------------------------------------------------ 지하 소품
def ladder_hole(P):
    P.rect(3, 3, 44, 44, OUTL); P.rect(4, 4, 43, 43, H('060408'))
    for y in range(4, 14): P.h(4, 43, y, A(STONE[2], 140 - (y - 4) * 14))
    for x0 in (11, 32):
        P.rect(x0, 0, x0 + 4, 47, OUTL); P.rect(x0 + 1, 0, x0 + 3, 47, WOOD[3]); P.v(x0 + 1, 0, 47, WOOD[5])
    for k in range(4):
        y = 5 + k * 11; P.rect(12, y, 35, y + 2, OUTL); P.rect(13, y, 34, y + 1, WOOD[4]); P.h(13, 34, y, WOOD[6])
def wall_ladder(P):
    P.rect(9, 0, 38, 10, H('060408')); P.h(9, 38, 10, A(OUTL, 140))
    for x0 in (12, 31):
        P.rect(x0, 0, x0 + 4, 47, OUTL); P.rect(x0 + 1, 0, x0 + 3, 47, WOOD[3]); P.v(x0 + 1, 0, 47, WOOD[5])
    for k in range(4):
        y = 8 + k * 10; P.rect(13, y, 34, y + 2, OUTL); P.rect(14, y, 33, y + 1, WOOD[4]); P.h(14, 33, y, WOOD[6])
    P.shadow(9, 44, 38, 47, 110)
def cauldron(P):
    P.ell(4, 40, 43, 47, (0, 0, 0, 110))
    P.ell(3, 11, 44, 46, OUTL); P.ell(4, 12, 43, 45, IRON[3])
    P.ell(6, 14, 30, 38, IRON[4]); P.ell(8, 16, 18, 26, IRON[5]); P.p(11, 18, IRON[6])
    P.ell(5, 8, 42, 22, OUTL); P.ell(6, 9, 41, 21, IRON[4]); P.h(10, 36, 9, IRON[6])
    P.ell(9, 11, 38, 19, BLOOD[1]); P.ell(11, 12, 36, 18, BLOOD[2]); P.h(14, 22, 13, BLOOD[4]); P.p(16, 13, BLOOD[6])
    for sx in (0, 43): P.rect(sx, 18, sx + 4, 23, OUTL); P.rect(sx + 1, 19, sx + 3, 22, IRON[3])
    for lx in (10, 34): P.rect(lx, 42, lx + 3, 46, OUTL)
def iron_door(open_=False):
    def f(P):
        P.rect(4, 0, 43, 47, OUTL)
        if open_:
            P.rect(8, 3, 39, 47, H('040306'))
            for y in range(3, 22): P.h(8, 39, y, A(BLOOD[2], max(0, 70 - (y - 3) * 4)))
            P.poly([(4, 0), (12, 3), (12, 47), (4, 47)], c=IRON[3]); P.v(5, 1, 47, IRON[5])
            for k in range(6): P.ell(0, 28 + k * 3, 5, 31 + k * 3, None, GOLD[2])
            return
        P.rect(5, 1, 42, 47, IRON[3]); P.v(5, 1, 47, IRON[5]); P.h(5, 1, 42, IRON[5]); P.v(42, 1, 47, IRON[1])
        for x in range(8, 41, 5):
            for y in (4, 44): P.p(x, y, IRON[6]); P.p(x, y + 1, IRON[1])
        for y in (14, 30): P.h(6, 41, y, IRON[1]); P.h(6, 41, y + 1, IRON[5])
        for (x, y) in [(9, 8), (33, 20), (14, 36), (37, 40)]:                      # 녹 번짐
            P.ell(x - 2, y - 1, x + 3, y + 3, A(H('6A3418'), 150)); P.p(x, y + 4, A(H('6A3418'), 120))
        for k in range(-8, 9):
            for (cx, cy, s) in ((24, 24, 1), (24, 24, -1)):
                x = cx + k * 2; y = cy + k * 2 * s
                if 6 <= x <= 41 and 2 <= y <= 46: P.ell(x - 2, y - 1, x + 1, y + 1, None, GOLD[2]); P.p(x - 1, y - 1, GOLD[4])
        P.rect(17, 19, 30, 31, OUTL); P.rect(18, 20, 29, 30, GOLD[3]); P.h(18, 29, 20, GOLD[5]); P.v(18, 20, 30, GOLD[4])
        P.ell(20, 14, 27, 22, None, IRON[5]); P.rect(23, 24, 24, 27, OUTL)
    return tile(f)
def record_shelf(P):
    P.rect(1, 1, 46, 45, OUTL)
    P.rect(2, 2, 45, 44, WOOD[2]); P.v(2, 2, 44, WOOD[4]); P.v(45, 2, 44, WOOD[1])
    for row in range(3):
        y0 = 4 + row * 13
        P.rect(4, y0, 43, y0 + 10, WOOD[0])
        for k in range(8):
            x0 = 4 + k * 5; L = LEATH[(k + row) % 3 if k % 3 else 2]
            P.rect(x0, y0, x0 + 3, y0 + 10, L[3]); P.v(x0, y0, y0 + 10, L[4]); P.v(x0 + 3, y0, y0 + 10, L[1])
            P.rect(x0 + 1, y0 + 3, x0 + 2, y0 + 5, PAPER[5]); P.p(x0 + 1, y0 + 8, GOLD[3]); P.p(x0 + 2, y0 + 8, GOLD[3])
        P.rect(3, y0 + 11, 44, y0 + 12, WOOD[4]); P.h(3, 44, y0 + 11, WOOD[6])
    for (x, y) in [(6, 3), (28, 17), (40, 30)]: P.h(x, x + 5, y, A(MARB[5], 90))   # 먼지
    P.shadow(0, 45, 47, 47, 110)
def att_desk(P):
    R = WOOD
    P.rect(1, 9, 46, 39, OUTL)
    P.rect(2, 10, 45, 33, R[4]); P.h(2, 45, 10, R[6])
    for y in range(11, 33):
        for x in range(2, 46):
            if (x * 3 + y * 11) % 29 == 0: P.p(x, y, R[3])
    P.rect(2, 34, 45, 38, R[2]); gold_bead(P, 2, 45, 34)
    P.rect(13, 13, 34, 30, OUTL); P.rect(14, 14, 33, 29, NAVY[4]); P.h(14, 33, 14, NAVY[6]); P.v(16, 14, 29, NAVY[2])
    P.rect(18, 17, 29, 21, PAPER[5]); P.h(19, 28, 19, PAPER[1])
    P.h(5, 12, 15, A(MARB[5], 90)); P.h(36, 42, 26, A(MARB[5], 90))
    P.ell(5, 25, 10, 29, A(BLOOD[3], 160))
    for lx in (4, 41): P.rect(lx, 38, lx + 2, 45, OUTL)

# ------------------------------------------------------------------ 운동장
def fence(P):
    P.im.paste(grass(1)())
    for yy in (11, 33): P.rect(0, yy, 47, yy + 1, OUTL); P.h(0, 47, yy, IRON[5])
    for k in range(0, 48, 8):
        P.rect(k + 2, 5, k + 5, 45, OUTL); P.rect(k + 3, 6, k + 4, 44, IRON[3]); P.v(k + 3, 6, 44, IRON[5])
        P.poly([(k + 1, 6), (k + 3, 0), (k + 4, 0), (k + 6, 6)], c=OUTL); P.p(k + 3, 2, GOLD[5]); P.p(k + 4, 3, GOLD[3]); P.p(k + 3, 4, GOLD[3])
    P.shadow(0, 45, 47, 47, 70)
def fence_v(P):
    P.im.paste(grass(2)())
    for xx in (14, 33): P.rect(xx, 0, xx + 1, 47, OUTL); P.v(xx, 0, 47, IRON[5])
    for k in range(0, 48, 8): P.rect(11, k + 2, 36, k + 4, OUTL); P.h(12, 35, k + 3, IRON[4])
    P.rect(22, 0, 25, 47, OUTL); P.rect(23, 0, 24, 47, IRON[3]); P.v(23, 0, 47, IRON[5])
def fence_corner(left):
    def f(P):
        P.im.paste(grass(3)())
        P.rect(22, 0, 25, 25, OUTL); P.rect(23, 0, 24, 24, IRON[3])
        if left: P.rect(24, 22, 47, 25, OUTL); P.h(24, 47, 23, IRON[5])
        else: P.rect(0, 22, 24, 25, OUTL); P.h(0, 24, 23, IRON[5])
        P.rect(19, 16, 28, 30, OUTL); P.rect(20, 17, 27, 29, IRON[3]); P.h(20, 27, 17, IRON[5]); P.p(23, 15, GOLD[5]); P.p(24, 14, GOLD[4])
    return tile(f)
def tree(P):
    P.im.paste(grass(4)())
    G = RP('0C160C', '142214', '1C301C', '284026', '345432', '466A40', '5E8452')
    P.ell(6, 37, 41, 46, (0, 0, 0, 100))
    P.rect(19, 24, 28, 44, OUTL); P.rect(20, 25, 27, 43, WOOD[3]); P.v(20, 25, 43, WOOD[5]); P.v(26, 25, 43, WOOD[1])
    P.v(23, 28, 40, WOOD[2]); P.rect(17, 42, 30, 44, WOOD[2])
    blobs = [(24, 9, 13), (12, 17, 10), (36, 17, 10), (18, 24, 9), (30, 24, 9), (24, 18, 11)]
    for (bx, by, r) in blobs: P.ell(bx - r - 1, by - r + 1, bx + r + 1, by + r - 1, OUTL)
    for (bx, by, r) in blobs: P.ell(bx - r, by - r + 2, bx + r, by + r - 2, G[2])
    for (bx, by, r) in blobs: P.ell(bx - r + 1, by - r + 2, bx + r - 3, by + r - 5, G[3])
    for (bx, by, r) in blobs: P.ell(bx - r + 3, by - r + 3, bx, by - 1, G[4])
    for (bx, by, r) in blobs:
        for k in range(0, 360, 50):
            a = math.radians(k + bx); P.p(int(bx - 2 + (r - 4) * 0.6 * math.cos(a)), int(by - 2 + (r - 4) * 0.5 * math.sin(a)), G[5])
def building(door_=False):
    def f(P):
        stone_wall_paint(P, 0, 37, RP('2A2830', '3C3A44', '504E5A', '666472', '7E7C8A', '9896A4', 'B4B2C0'))
        P.rect(0, 38, 47, 47, STONE[2]); P.h(0, 47, 38, STONE[4]); P.h(0, 47, 47, OUTL)
        for x in range(0, 48, 6): P.v(x, 39, 46, STONE[1])
        if door_:
            fa = arch_top(6, 41, 12, 1)
            for x in range(5, 43): P.v(x, max(0, fa(min(max(x, 6), 41)) - 1), 47, OUTL)
            for x in range(6, 42): P.v(x, fa(x), 47, WOOD[3] if (x - 6) % 6 else WOOD[1])
            for x in range(6, 42): P.p(x, fa(x), GOLD[4])
            P.v(23, 8, 47, WOOD[1]); P.v(24, 8, 47, WOOD[4])
            for y in (16, 34): P.h(7, 40, y, IRON[3]); P.h(7, 40, y + 1, IRON[5])
            P.ell(19, 24, 22, 27, None, GOLD[4]); P.ell(25, 24, 28, 27, None, GOLD[4])
        else:
            fa = arch_top(13, 34, 14, 3)
            for x in range(12, 36): P.v(x, max(0, fa(min(max(x, 13), 34)) - 1), 32, OUTL)
            for x in range(13, 35):
                for y in range(fa(x), 31): P.p(x, y, mix(H('3A3048'), H('E8B060'), 0.25 if (x // 4 + y // 6) % 5 == 0 else 0))
                P.p(x, fa(x), STONE[5])
            for x in range(13, 35):
                for y in range(fa(x), 31):
                    if (x + y) % 6 == 0 or (x - y) % 6 == 0: P.p(x, y, OUTL)
            P.rect(11, 31, 36, 33, STONE[5]); P.h(11, 36, 33, STONE[1])
    return tile(f)
def obench(P):
    P.im.paste(grass(5)())
    P.rect(0, 13, 47, 26, OUTL); P.rect(0, 14, 47, 25, WOOD[4])
    for y in (17, 21): P.h(0, 47, y, WOOD[2])
    P.h(0, 47, 14, WOOD[6])
    for lx in (3, 40):
        P.rect(lx, 24, lx + 4, 38, OUTL); P.rect(lx + 1, 25, lx + 3, 37, IRON[3])
        P.ell(lx - 1, 26, lx + 5, 32, None, IRON[4])
    P.shadow(2, 38, 45, 40, 80)
def slate_roof(P):
    R = RP('16141E', '201E2A', '2C2A38', '3A3848', '4A485A', '5E5C70', '787690')
    P.rect(0, 0, 47, 47, R[1])
    for row in range(6):
        y0 = row * 8; off = 0 if row % 2 == 0 else 6
        for x0 in range(-12 + off, 48, 12):
            for y in range(y0, y0 + 7):
                for x in range(max(0, x0), min(48, x0 + 11)):
                    c = R[3]
                    if y == y0 + 6: c = R[1]
                    elif x == x0 + 10: c = R[2]
                    elif y == y0 + 5 and x > x0 + 2: c = R[2]
                    elif x == x0: c = R[4]
                    P.p(x, y, c)
            if 0 <= x0 + 3 < 48: P.p(x0 + 3, y0 + 1, R[5])
def flagpole(P):
    P.im.paste(dirt(11)())
    P.ell(13, 38, 34, 46, OUTL); P.ell(14, 39, 33, 45, STONE[3]); P.h(17, 30, 40, STONE[5])
    P.rect(21, 0, 26, 43, OUTL); P.rect(22, 0, 25, 42, MARB[4]); P.v(22, 0, 42, MARB[6]); P.v(25, 0, 42, MARB[2])
    P.line(28, 1, 30, 29, OUTL); P.line(30, 29, 27, 34, OUTL)
    P.rect(26, 22, 28, 24, IRON[4])
    P.ell(21, -1, 26, 3, GOLD[4]); P.p(22, 0, GOLD[6])
def bars(P):
    P.im.paste(dirt(12)())
    for lx in (4, 40):
        P.rect(lx - 1, 7, lx + 4, 45, OUTL); P.rect(lx, 8, lx + 3, 44, IRON[3]); P.v(lx, 8, 44, IRON[5])
        P.ell(lx - 3, 42, lx + 6, 46, (0, 0, 0, 80))
    P.rect(4, 9, 43, 12, OUTL); P.rect(5, 10, 42, 11, MARB[3]); P.h(5, 42, 10, MARB[6])
    P.rect(18, 10, 23, 11, H('7A3A2A')); P.p(20, 10, H('9A5A3A'))

# ------------------------------------------------------------------ 조립
import numpy as np
def grade(im):
    """v3.0 색 방향: 연보라 · 붉은색 · 검정 + 약간의 금. 빨강은 채도를 남기고, 금은 밝은 점만 옅게, 나머지는 연보라빛 회색."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1); v = mx; c = mx - mn; s = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(v); m = c > 1e-6
    hr = ((g - b) / np.maximum(c, 1e-6)) % 6; hg = (b - r) / np.maximum(c, 1e-6) + 2; hb = (r - g) / np.maximum(c, 1e-6) + 4
    h = np.where(mx == r, hr, np.where(mx == g, hg, hb)) / 6.0; h = np.where(m, h, 0)
    red = ((h < 0.035) | (h > 0.94)) & (s > 0.35) & (v > 0.18)
    gold = (h > 0.08) & (h < 0.17) & (s > 0.45) & (v > 0.62)
    lav = 0.74
    nh = np.where(red, h, np.where(gold, 0.11, lav))
    ns = np.where(red, np.minimum(1, s * 0.95), np.where(gold, s * 0.42, np.minimum(0.30, s * 0.26 + 0.09)))
    nv = np.where(red, v * 0.9, v ** 1.22 * 0.86)
    # HSV → RGB
    i = np.floor(nh * 6) % 6; f = nh * 6 - np.floor(nh * 6)
    p_ = nv * (1 - ns); q = nv * (1 - f * ns); t = nv * (1 - (1 - f) * ns)
    out = np.zeros_like(rgb)
    for k, (R_, G_, B_) in enumerate([(nv, t, p_), (q, nv, p_), (p_, nv, t), (p_, q, nv), (t, p_, nv), (nv, p_, q)]):
        sel = i == k
        out[..., 0] = np.where(sel, R_, out[..., 0]); out[..., 1] = np.where(sel, G_, out[..., 1]); out[..., 2] = np.where(sel, B_, out[..., 2])
    res = np.concatenate([out, al], -1)
    return Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8), 'RGBA')

BUILT = {}
def build(name, painters, rows=8):
    BUILT[name] = painters
    im = Image.new('RGBA', (8 * T, rows * T), (0, 0, 0, 0))
    for i, p in painters.items():
        im.paste(p(i).convert('RGBA'), ((i % 8) * T, (i // 8) * T))
    grade(im).save(os.path.join(OUT, 'tilesets', name + '.png'))
def L(fn, *a, **k): return layer(lambda P: fn(P, *a, **k))
def LT(t): return layer(lambda P: P.im.paste(t()))

def decor_set(wall, up, paper_R):
    """벽 장식 변형 40~45, 윗벽 46~47."""
    return {40: on(wall, layer(portrait)), 41: on(wall, layer(landscape)), 42: on(wall, layer(sconce)),
            43: on(wall, layer(crest)), 44: on(wall, layer(wood_cross)), 45: on(wall, L(torn_paper, paper_R)),
            46: on(up, layer(molding_medallion)), 47: on(up, layer(water_stain))}

# 교실 계열 — 쪽모이 바닥, 짙은 녹색 다마스크 + 호두나무 벽판
wood = calm_boards(OAK)
dwood = calm_boards(WOOD, 3, h=8)
cpaper = damask(GREEN)
cwall = wall_tile(cpaper); cup = upper_tile(cpaper)
def window_over(wall_t, win_t):
    def p(seed=0):
        base = wall_t(seed).convert('RGBA'); w = win_t(seed)
        mask = Image.new('L', (T, T), 0); md = ImageDraw.Draw(mask)
        # 창 그림에서 검은 바탕(0,0,0)이 아닌 곳만 덮는다
        px = w.load(); mp = mask.load()
        for y in range(T):
            for x in range(T):
                if px[x, y] != (0, 0, 0): mp[x, y] = 255
        base.paste(w, (0, 0), mask); return base.convert('RGB')
    return p
def onto(base_t, obj_t):
    """바닥/벽 칸을 깔고 그 위에 물건 붓으로 바로 그린다(그림자·빛이 바탕과 섞임)."""
    def p(seed=0):
        P = Pen(seed); P.im.paste(base_t(seed)); obj_t._fn(P); return P.im
    p._fn = lambda P: (P.im.paste(p()),)
    return p

classroom = {
    0: wood, 1: cwall, 2: cup, 28: onto(cup, gothic_window_upper()),
    3: onto(cwall, gothic_window_lower()), 4: onto(cwall, blackboard(0)), 5: onto(cwall, tile(clock)),
    6: onto(cwall, gothic_door()), 7: onto(wood, school_desk(0)), 8: onto(wood, school_desk(1)), 9: onto(wood, tile(podium)),
    10: onto(cwall, bookcase(False, 3)), 11: onto(wood, bookcase(True, 4)),
    12: onto(wood, reading_table()), 13: onto(wood, reading_table(True)),
    14: onto(wood, bed(NAVYV)), 15: onto(dwood, bed(CRIM)), 30: onto(wood, bed_foot(NAVYV)), 31: onto(dwood, bed_foot(CRIM)),
    16: dwood, 17: onto(dwood, tile(runner)), 18: onto(wood, tile(mat_t)), 19: onto(dwood, school_desk(2)),
    20: onto(wood, tile(plant)), 21: onto(dwood, tile(mat_t)), 22: onto(wood, tile(chair)), 23: onto(dwood, tile(dresser)),
    24: wood, 25: wood, 26: dwood, 27: dwood,
    32: calm_boards(OAK, 1, knot=True), 33: calm_boards(OAK, 2, scratch=True), 34: calm_boards(OAK, 4), 35: calm_boards(OAK, 5, knot=True),
    36: calm_boards(WOOD, 6, knot=True, h=8), 37: calm_boards(WOOD, 7, scratch=True, h=8),
    38: onto(cwall, blackboard(1)), 39: onto(cwall, blackboard(2)),
}
classroom.update(decor_set(cwall, cup, GREEN))
build('tiles_classroom', classroom)

# 복도 — 대리석 체크, 남색 다마스크
HST = RP('2A2A32', '3C3C46', '52525E', '6A6A76', '82828E', '9C9CA8', 'BABAC4')
hfloor = calm_tiles(HST, 24)
hpaper = damask(NAVY)
hwall = wall_tile(hpaper); hup = upper_tile(hpaper)
def hallway_set(fl, fl16=None, fl17=None, fl32=None):
    d = {
        0: fl, 1: hwall, 2: hup, 28: onto(hup, gothic_window_upper()),
        3: onto(hwall, gothic_window_lower()), 4: onto(hwall, gothic_door()),
        5: tile(stairs), 29: onto(hup, tile(stair_well)), 6: onto(hwall, tile(iron_banded_door)), 7: onto(hwall, tile(notice_board)),
        8: onto(hwall, gothic_door(sign=restroom_sign)), 9: onto(hwall, tile(entrance)),
        10: onto(fl, tile(mat_t)), 11: onto(fl, tile(wood_lockers)), 12: onto(fl, tile(plant)),
        13: onto(hwall, tile(gilded_mirror_sink)), 14: onto(hwall, tile(wood_stall)),
        16: fl16 or fl, 17: fl17 or fl, 32: fl32 or calm_tiles(HST, 24, chip=True), 33: fl32 or calm_tiles(HST, 24, crack=True), 34: fl, 35: fl,
    }
    d.update(decor_set(hwall, hup, NAVY)); return d
build('tiles_hallway', hallway_set(hfloor))

# 급식실 — 크림 타일 + 청록 상감, 벽은 아래 흰 타일·위 크림 다마스크
CTL = RP('4E4A42', '6A655A', '888274', 'A49E8E', 'BCB6A6', 'D2CCBC', 'E6E0D2')
cfloor = calm_tiles(CTL, 16)
fpaper = damask(RP('3A3428', '524A3A', '6C624E', '847862', '9E9278', 'B8AC92', 'D2C7AE'))
def caf_wall_f(P):
    fpaper(P, 0, 28)
    P.rect(0, 30, 47, 47, CREAM[2])
    for yy in range(30, 46, 8):
        for xx in range(0, 48, 12):
            o = 6 if (yy // 8) % 2 else 0
            x0 = xx + o
            for y in range(yy + 1, min(46, yy + 7) + 1):
                for x in range(x0 + 1, x0 + 11):
                    if 0 <= x < 48: P.p(x, y, CREAM[5] if y == yy + 1 else (CREAM[3] if x == x0 + 10 else CREAM[4]))
    P.rect(0, 28, 47, 30, TEAL[3]); P.h(0, 47, 28, TEAL[5]); P.h(0, 47, 30, TEAL[1])
    P.rect(0, 45, 47, 47, TEAL[2]); P.h(0, 47, 45, TEAL[4]); P.h(0, 47, 47, OUTL)
fwall = tile(caf_wall_f); fup = upper_tile(fpaper)
cafeteria = {
    0: cfloor, 1: fwall, 2: fup, 28: onto(fup, gothic_window_upper()), 3: onto(fwall, gothic_window_lower()),
    4: onto(cfloor, tile(long_table)),
    5: onto(cfloor, steel_counter()), 6: onto(cfloor, steel_counter(tickets=True)), 7: onto(cfloor, tile(icebox)), 8: onto(fwall, tile(menu_board)),
    9: onto(cfloor, tile(mat_t)), 10: onto(cfloor, tile(floor_hatch)), 11: onto(cfloor, tile(bench)),
    12: onto(cfloor, serve_line(left=True, pans=((12, '6A3A2A'), (30, '6A3A2A')))),
    13: onto(cfloor, serve_line(pans=((6, 'E0D0A8'), (26, 'E0D0A8')))),
    14: onto(cfloor, serve_line(right=True, pans=((4, 'F0ECE0'),), extra=lambda P: (P.rect(24, 8, 38, 24, OUTL), P.rect(25, 9, 37, 23, MARB[4]), P.h(25, 37, 9, MARB[6])))),
    15: onto(cfloor, serve_line(pans=((6, '5A5248'),), extra=lambda P: [(P.rect(a, b, a + 15, b + 7, OUTL), P.rect(a + 1, b + 1, a + 14, b + 6, PAPER[5]), P.h(a + 3, a + 10, b + 3, GOLD[2])) for (a, b) in [(14, 25), (19, 29)]])),
    16: cfloor, 17: cfloor, 32: calm_tiles(CTL, 16, chip=True), 33: calm_tiles(CTL, 16, crack=True), 34: cfloor, 35: cfloor,
}
cafeteria.update(decor_set(fwall, fup, CREAM))
build('tiles_cafeteria', cafeteria)

# 예배당 — 금 상감 판석, 와인 다마스크, 스테인드글라스
PST = RP('16141A', '201E26', '2C2932', '38353F', '46434E', '57545F', '6C6974')
pfloor = calm_tiles(PST, 24, inlay=GOLD)
ppaper = damask(WINE)
pwall = wall_tile(ppaper); pup = upper_tile(ppaper)
chapel = {
    0: pfloor, 1: pwall, 2: pup, 28: onto(pup, tile(lambda P: stained(P, 18, 47, True))),
    3: onto(pwall, tile(lambda P: stained(P, -4, 28, False))), 4: onto(pfloor, tile(altar)), 5: onto(pfloor, cloth_table()),
    6: onto(pfloor, tile(pew)), 7: onto(pfloor, tile(candelabra)), 8: tile(chapel_runner), 9: onto(pfloor, cloth_table(True)),
    16: pfloor, 17: pfloor, 32: calm_tiles(PST, 24, chip=True, inlay=GOLD), 33: calm_tiles(PST, 24, crack=True, inlay=GOLD), 34: pfloor, 35: pfloor,
}
chapel.update(decor_set(pwall, pup, WINE))
build('tiles_chapel', chapel)

# 지하 — 판석, 돌벽
bfloor = flagstones(STONE, 0)
def bwall_f(P):
    stone_wall_paint(P, 0, 46)
    P.h(0, 47, 46, A(OUTL, 160)); P.h(0, 47, 47, OUTL)
    for x in (3, 4, 17, 30, 31, 44): P.p(x, 45, H('34442E')); P.p(x, 44, H('4C6040'))
bwall = tile(bwall_f)
def bup_f(P):
    stone_wall_paint(P, 13, 47)
    P.rect(0, 0, 47, 8, H('0E0C12'))
    P.rect(0, 9, 47, 12, STONE[3]); P.h(0, 47, 9, STONE[5]); P.h(0, 47, 12, STONE[1]); P.h(0, 47, 13, A(OUTL, 110))
bup = tile(bup_f)
def bdecor(P):
    pass
def basement_set(fl, fl16=None, fl17=None):
    d = {
        0: fl, 1: bwall, 2: bup, 3: onto(bwall, tile(iron_banded_door)), 4: onto(fl, bookcase(True, 9)),
        5: onto(fl, tile(ladder_hole)), 6: onto(fl, tile(cauldron)), 7: onto(bwall, iron_door()), 8: onto(fl, tile(record_shelf)), 9: onto(fl, tile(att_desk)),
        10: onto(bwall, tile(wall_ladder)), 11: onto(bwall, iron_door(True)),
        16: fl16 or flagstones(STONE, 1), 17: fl17 or flagstones(STONE, 2), 32: fl, 33: flagstones(STONE, 1), 34: flagstones(STONE, 2), 35: fl,
        40: onto(bwall, tile(sconce)), 41: onto(bwall, tile(lambda P: [P.ell(14, 6, 33, 26, None, IRON[4]), P.ell(15, 7, 32, 25, None, IRON[2])])),
        42: bwall, 43: onto(bwall, tile(wood_cross)), 44: bwall, 45: bwall, 46: bup, 47: bup,
    }
    return d
build('tiles_basement', basement_set(bfloor))

# 운동장
outdoor = {
    0: dirt(0), 1: grass(0), 2: tile(fence), 3: tile(tree), 4: building(), 5: building(True), 6: tile(obench), 7: tile(slate_roof),
    8: tile(fence_v), 9: fence_corner(True), 10: fence_corner(False), 11: tile(flagpole), 12: tile(bars), 13: tile(sand_t),
    16: dirt(31, pebbles=True), 17: dirt(41, ruts=True), 18: grass(33, flowers=True), 19: grass(43, tuft=True),
    32: dirt(5), 33: dirt(7, pebbles=True), 34: dirt(9), 35: dirt(13), 36: grass(6, flowers=True), 37: grass(8, tuft=True),
    40: building(), 41: building(), 42: building(), 43: building(),
}
build('tiles_outdoor', outdoor)
print('base ok')

# ------------------------------------------------------------------ 오염 단계
def splat(P, cx, cy, r, rnd, B=BLOOD, gloss=True):
    """고인 피: 바깥 어두운 테 → 몸 → 안쪽 짙은 웅덩이 → 젖은 빛 + 튄 방울."""
    blobs = [(cx + rnd.randint(-r, r), cy + rnd.randint(-(r // 2), r // 2), rnd.randint(max(1, r // 3), max(2, r * 2 // 3))) for _ in range(r + 3)]
    for (x, y, rr) in blobs: P.ell(x - rr - 1, y - rr * 2 // 3 - 1, x + rr + 1, y + rr * 2 // 3 + 1, B[1])
    for (x, y, rr) in blobs: P.ell(x - rr, y - rr * 2 // 3, x + rr, y + rr * 2 // 3, B[3])
    P.ell(cx - r // 2, cy - r // 3, cx + r // 2, cy + r // 3, B[2])
    if gloss: P.h(cx - r // 3, cx - r // 3 + max(1, r // 3), cy - r // 3, B[5]); P.p(cx - r // 3, cy - r // 3 - 1, B[6])
    for _ in range(r + 3):
        a = rnd.random() * 6.283; d = r + 2 + rnd.random() * (r + 5)
        x, y = int(cx + math.cos(a) * d), int(cy + math.sin(a) * d * 0.6)
        P.p(x, y, B[3]);
        if rnd.random() < 0.5: P.p(x + 1, y, B[2])
def drops(P, rnd, n, B=BLOOD, area=(3, 3, 44, 44)):
    for _ in range(n):
        x, y = rnd.randint(area[0], area[2]), rnd.randint(area[1], area[3])
        P.p(x, y, B[3]); P.p(x + 1, y, B[2]); P.p(x, y + 1, B[1])
        if rnd.random() < 0.3: P.p(x - 1, y - 1, B[4])
def drag(P, x, y, ln, rnd, B=BLOOD, vertical=False):
    """끌린 자국: 손가락 네 줄이 점점 가늘어짐."""
    for f in range(4):
        for k in range(ln):
            if rnd.random() < 0.9 - k / ln * 0.6:
                px, py = (x + k, y + f * 2 + (k // 9) % 2) if not vertical else (x + f * 2 + (k // 9) % 2, y + k)
                P.p(px, py, B[3] if k < ln * 0.5 else B[2])
    P.ell(x - 3, y - 1, x + 3, y + 8, B[3]) if not vertical else P.ell(x - 1, y - 3, x + 8, y + 3, B[3])
def drip(P, x, y0, ln, w=1, B=BLOOD):
    P.rect(x - 1, y0, x + w, y0 + 1, B[2])
    for k in range(ln):
        P.rect(x, y0 + k, x + w - 1, y0 + k, B[3] if k < ln - 2 else B[2])
    P.ell(x - 1, y0 + ln - 1, x + w, y0 + ln + 2, B[3]); P.p(x, y0 + ln, B[1]); P.p(x - 1 + w, y0 + ln - 1, B[5])
    P.p(x, y0 + 1, B[5])
def handprint(P, x, y, B=BLOOD, a=255):
    c = A(B[3], a); c2 = A(B[2], a)
    P.ell(x, y + 6, x + 8, y + 14, c)
    for (dx, ln) in [(0, 5), (2, 7), (4, 7), (6, 6)]: P.rect(x + dx, y + 6 - ln, x + dx + 1, y + 6, c)
    P.rect(x - 2, y + 7, x - 1, y + 11, c)
    for k in range(6): P.p(x + 2 + (k * 3) % 6, y + 15 + k, c2)
def shoe(P, x, y, B, a):
    P.ell(x, y, x + 5, y + 6, A(B[3], a)); P.rect(x + 1, y + 2, x + 4, y + 4, A(B[2], a))
    P.ell(x + 1, y + 8, x + 4, y + 11, A(B[3], a))
def crackline(P, x, y, ln, rnd):
    for k in range(ln):
        P.p(x, y, OUTL); P.p(x + 1, y, A(H('FFFFFF'), 40))
        if rnd.random() < 0.15:
            bx, by = x, y
            for j in range(rnd.randint(2, 5)): bx += rnd.choice([-1, 1]); by += 1; P.p(bx, by, OUTL)
        x += rnd.choice([-1, 0, 0, 1]); y += 1
def vein(P, rnd, x, y, ln, thick=2):
    dx = rnd.choice([-1, 1])
    for k in range(ln):
        w = thick if k < ln * 0.6 else 1
        P.rect(x, y, x + w - 1, y, VEINC[3]); P.p(x + w, y, VEINC[1]); P.p(x - 1, y, VEINC[2])
        if k % 7 == 3: P.p(x, y, VEINC[5])
        if rnd.random() < 0.12:
            bx, by, bd = x, y, rnd.choice([-1, 1])
            for j in range(rnd.randint(3, 8)):
                bx += bd if rnd.random() < 0.7 else 0; by += 1 if rnd.random() < 0.6 else 0; P.p(bx, by, VEINC[2])
        if rnd.random() < 0.05: P.ell(x - 2, y - 1, x + 2, y + 3, VEINC[4]); P.p(x - 1, y, VEINC[6])
        if rnd.random() < 0.3: x += dx
        if rnd.random() < 0.08: dx = -dx
        x = max(1, min(46, x)); y += 1
        if y > 47: break
def grime(P, rnd, n, a=40):
    for _ in range(n):
        cx, cy, r = rnd.randint(4, 43), rnd.randint(4, 43), rnd.randint(4, 9)
        for k in range(3):
            rr = r - k * 2
            if rr > 0: P.ell(cx - rr, cy - rr // 2, cx + rr, cy + rr // 2, (30, 20, 16, a // 3))
def rope(P, x, y):
    R = RP('3A2E1E', '544430', '6E5C40', '8A7650', 'A69262', 'C0AE7C', 'DCCA98')
    for k in range(18): P.p(x + k, y + (k // 3) % 2, A(H('3C2818'), 170)); P.p(x + k, y + 2 + (k // 3) % 2, A(H('3C2818'), 90))
    for j in range(13): P.p(x + 9 + (j // 2) % 2, y + 3 + j, R[3] if j % 2 else R[4]); P.p(x + 10 - (j // 2) % 2, y + 3 + j, R[2])
    P.p(x + 9, y + 16, R[5]); P.p(x + 10, y + 17, R[2]); P.p(x + 8, y + 17, R[2])
def flesh(seed):
    def f(P):
        rnd = random.Random(seed)
        P.rect(0, 0, 47, 47, FLESH[3])
        for y in range(48):
            for x in range(48):
                u = math.sin((x + seed * 3) / 5.0) + math.sin((y * 1.3 + x * 0.4 + seed) / 6.0)
                if u > 1.2: P.p(x, y, FLESH[4])
                elif u < -1.2: P.p(x, y, FLESH[2])
        for _ in range(6):                                                         # 주름
            x, y = rnd.randint(0, 47), rnd.randint(0, 47)
            for k in range(rnd.randint(10, 20)):
                P.p(x % 48, y, FLESH[1]); P.p(x % 48, y - 1, FLESH[5] if k % 3 == 0 else FLESH[4])
                x += 1; y = max(1, min(46, y + rnd.choice([-1, 0, 0, 1])))
        for _ in range(4):                                                         # 혹
            cx, cy, r = rnd.randint(5, 42), rnd.randint(5, 42), rnd.randint(2, 4)
            P.ell(cx - r, cy - r, cx + r, cy + r, FLESH[2]); P.ell(cx - r + 1, cy - r, cx + r - 1, cy + r - 2, FLESH[4]); P.p(cx - 1, cy - r + 1, FLESH[6])
        for _ in range(2):                                                         # 혈관
            x, y = rnd.randint(0, 47), rnd.randint(0, 47); ddx, ddy = rnd.choice([(1, 0), (0, 1), (1, 1), (1, -1)])
            for k in range(rnd.randint(20, 36)):
                P.p(x % 48, y % 48, VEINC[3]); P.p((x + 1) % 48, y % 48, VEINC[1])
                x += ddx if rnd.random() < 0.8 else rnd.choice([-1, 1]); y += ddy if rnd.random() < 0.8 else rnd.choice([-1, 1])
        for _ in range(5):
            x, y = rnd.randint(2, 45), rnd.randint(2, 45); P.p(x, y, FLESH[6]); P.p(x + 1, y, FLESH[5])
    return tile(f)

def dirty(cat, stage, v, idx):
    """cat: floor/grass/wall/deco/glass/upper/object. v: 0=기본 자리, 1~=추가 변형."""
    def f(P):
        rnd = random.Random(idx * 97 + stage * 1009 + v * 31 + 5)
        heavy = stage >= 3
        if cat == 'floor':
            grime(P, rnd, 2 if heavy else 1, 60 if heavy else 40)
            if v == 0:
                if heavy: drops(P, rnd, 3, DRYB)
                return
            kind = v % 7
            if not heavy:
                if kind in (1, 4): drops(P, rnd, rnd.randint(2, 5), DRYB)
                elif kind == 2: splat(P, rnd.randint(12, 34), rnd.randint(12, 34), 3, rnd, DRYB, gloss=False)
                elif kind == 3: grime(P, rnd, 3, 70)
                elif kind == 5: crackline(P, rnd.randint(8, 38), rnd.randint(0, 20), rnd.randint(8, 18), rnd)
                return
            if kind == 1: splat(P, rnd.randint(14, 32), rnd.randint(14, 32), rnd.randint(5, 8), rnd)
            elif kind == 2: drag(P, rnd.randint(2, 12), rnd.randint(10, 30), rnd.randint(22, 34), rnd)
            elif kind == 3:
                for k, (x, y) in enumerate([(14, 36), (24, 25), (13, 14), (23, 3)]): shoe(P, x, y, BLOOD, 230 - k * 45)
            elif kind == 4: drops(P, rnd, rnd.randint(8, 14))
            elif kind == 5: splat(P, rnd.randint(8, 18), rnd.randint(10, 20), 3, rnd); splat(P, rnd.randint(28, 40), rnd.randint(28, 38), 4, rnd)
            elif kind == 6: drag(P, rnd.randint(12, 30), 2, rnd.randint(22, 40), rnd, vertical=True)
            else: handprint(P, rnd.randint(10, 28), rnd.randint(10, 24), BLOOD, 200)
        elif cat == 'grass':
            P.rect(0, 0, 47, 47, (80, 60, 20, 60 if heavy else 26))
            if heavy and v % 2 == 1: splat(P, rnd.randint(12, 34), rnd.randint(12, 34), 4, rnd, DRYB, gloss=False)
        elif cat in ('wall', 'deco', 'glass'):
            if cat == 'glass':
                handprint(P, rnd.randint(14, 24), rnd.randint(4, 10), BLOOD, 140 if not heavy else 230)
                if heavy: handprint(P, rnd.randint(26, 32), rnd.randint(2, 12), BLOOD, 200); drip(P, rnd.randint(14, 34), 18, 8)
                return
            if not heavy:
                if v in (0, 2) or cat == 'deco': crackline(P, rnd.choice([rnd.randint(2, 8), rnd.randint(38, 45)]), 0, rnd.randint(8, 22), rnd)
                if v == 1: drip(P, rnd.randint(6, 40), 0, rnd.randint(5, 12))
                if v == 3: handprint(P, rnd.randint(8, 30), 8, BLOOD, 150)
                if v == 4: grime(P, rnd, 2, 60)
                return
            n = 1 if cat == 'deco' else (1 + (v % 3 == 2))
            for _ in range(n): vein(P, rnd, rnd.randint(3, 44), rnd.randint(0, 4), rnd.randint(16, 30))
            for _ in range(rnd.randint(1, 2)): drip(P, rnd.randint(3, 44), 0, rnd.randint(8, 26), rnd.choice([1, 1, 2]))
            if v == 1: splat(P, rnd.randint(14, 32), 14, 6, rnd)
            if v == 3: rope(P, rnd.randint(4, 24), 6)
            if v == 4: handprint(P, rnd.randint(6, 16), 10, BLOOD, 220); handprint(P, rnd.randint(26, 34), 14, BLOOD, 200)
        elif cat == 'upper':
            if heavy:
                vein(P, rnd, rnd.randint(4, 43), 18, rnd.randint(16, 30))
                if v % 2: vein(P, rnd, rnd.randint(4, 43), 18, rnd.randint(12, 26), 1)
                for _ in range(rnd.randint(1, 2)): drip(P, rnd.randint(3, 44), 18, rnd.randint(8, 24), rnd.choice([1, 2]))
                if v == 2: rope(P, rnd.randint(6, 24), 20)
            else:
                if v in (0, 2): crackline(P, rnd.randint(6, 40), 19, rnd.randint(8, 20), rnd)
                if v == 1: drip(P, rnd.randint(6, 40), 18, rnd.randint(5, 10))
        else:
            if heavy:
                drops(P, rnd, rnd.randint(3, 7))
                if rnd.random() < 0.4: splat(P, rnd.randint(14, 32), rnd.randint(12, 30), 3, rnd)
            elif rnd.random() < 0.35: drops(P, rnd, 2, DRYB)
    return tile(f)

def tint(im, stage):
    rgb = im.convert('RGB'); a = im.getchannel('A')
    rgb = ImageEnhance.Brightness(rgb).enhance({2: 0.93, 3: 0.84, 4: 0.82}[stage])
    rgb = ImageEnhance.Color(rgb).enhance({2: 0.9, 3: 0.82, 4: 0.86}[stage])
    if stage >= 3:
        r, g, b = rgb.split(); r = r.point(lambda v: min(255, int(v * 1.07) + 3)); rgb = Image.merge('RGB', (r, g, b))
    out = rgb.convert('RGBA'); out.putalpha(a); return out

CATS = {   # 칸 분류
    'tiles_classroom': dict(floor={0, 16, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37}, wall={1}, deco={4, 5, 10, 38, 39, 40, 41, 42, 43, 44, 45}, glass={3, 6}, upper={2, 28, 46, 47},
                            extra={0: (48, 7), 16: (55, 3), 1: (58, 4), 2: (62, 2)}),
    'tiles_hallway':   dict(floor={0, 16, 17, 32, 33, 34, 35}, wall={1}, deco={6, 7, 8, 13, 14, 40, 41, 42, 43, 44, 45}, glass={3, 4, 9}, upper={2, 28, 46, 47},
                            extra={0: (48, 7), 1: (58, 4), 2: (62, 2)}),
    'tiles_cafeteria': dict(floor={0, 16, 17, 32, 33, 34, 35}, wall={1}, deco={8, 40, 41, 42, 43, 44, 45}, glass={3}, upper={2, 28, 46, 47},
                            extra={0: (48, 7), 1: (58, 4), 2: (62, 2)}),
    'tiles_chapel':    dict(floor={0, 16, 17, 32, 33, 34, 35}, wall={1}, deco={40, 41, 42, 43, 44, 45}, glass={3}, upper={2, 28, 46, 47},
                            extra={0: (48, 7), 1: (58, 4), 2: (62, 2)}),
    'tiles_basement':  dict(floor={0, 16, 17, 32, 33, 34, 35}, wall={1, 42, 44, 45}, deco={3, 7, 10, 11, 40, 41, 43}, glass=set(), upper={2, 46, 47},
                            extra={0: (48, 7), 1: (58, 4), 2: (62, 2)}),
    'tiles_outdoor':   dict(floor={0, 16, 17, 13, 11, 12, 32, 33, 34, 35}, grass={1, 2, 3, 6, 8, 9, 10, 18, 19, 36, 37}, wall={4, 40, 41, 42, 43}, glass={5}, upper=set(),
                            extra={0: (48, 7), 1: (55, 3), 4: (58, 4)}),
}
def build_stage(name, stage, painters):
    cats = CATS[name]
    def cat_of(i):
        for c in ('floor', 'grass', 'wall', 'deco', 'glass', 'upper'):
            if i in cats.get(c, ()): return c
        return 'object'
    im = Image.new('RGBA', (8 * T, 8 * T), (0, 0, 0, 0))
    def put(i, base_t, c, v, src):
        P = Pen(i); P.im.paste(base_t(i)); dirty(c, stage, v, src)._fn(P)
        im.paste(P.im.convert('RGBA'), ((i % 8) * T, (i // 8) * T))
    for i, p in painters.items():
        put(i, p, cat_of(i), (i - 31) if 32 <= i <= 47 and cat_of(i) in ('floor', 'grass') else (i % 5 if i >= 32 else 0), i)
    for src, (slot, n) in cats['extra'].items():
        for k in range(n):
            put(slot + k, painters[src], cat_of(src), k + 1 + (4 if cat_of(src) in ('floor', 'grass') else 0), src * 3 + k)
    im = tint(grade(im), stage)
    im.save(os.path.join(OUT, 'tilesets', f'{name}_s{stage}.png'))

for nm in ['tiles_classroom', 'tiles_hallway', 'tiles_cafeteria', 'tiles_chapel', 'tiles_basement', 'tiles_outdoor']:
    for st in (2, 3): build_stage(nm, st, BUILT[nm])
build_stage('tiles_hallway', 4, hallway_set(flesh(1), flesh(2), flesh(3), flesh(11)))
fl4 = flesh(4)
bs4 = basement_set(fl4, flesh(5), flesh(6)); bs4.update({32: flesh(7), 33: flesh(8), 34: flesh(9), 35: flesh(10)})
build_stage('tiles_basement', 4, bs4)
print('stages ok')

# ------------------------------------------------------------------ 번호 안내 그림
try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 14)
except Exception: font = ImageFont.load_default()
docs = os.path.join(OUT, '..', 'docs'); os.makedirs(docs, exist_ok=True)
for fn in sorted(os.listdir(os.path.join(OUT, 'tilesets'))):
    tsn = fn[:-4]
    srcim = Image.open(os.path.join(OUT, 'tilesets', fn)).convert('RGBA')
    rows = srcim.height // T
    g = Image.new('RGBA', (768, rows * 96), (236, 234, 240, 255)); g.alpha_composite(srcim.resize((768, rows * 96), Image.NEAREST))
    d = ImageDraw.Draw(g)
    for i in range(rows * 8):
        x, y = (i % 8) * 96, (i // 8) * 96
        d.rectangle([x, y, x + 95, y + 95], outline=(90, 80, 110, 255))
        d.rectangle([x + 2, y + 2, x + 26, y + 20], fill=(0, 0, 0, 170)); d.text((x + 5, y + 2), str(i), fill=(255, 255, 255, 255), font=font)
    g.convert('RGB').save(os.path.join(docs, 'guide_' + tsn + '.png'))
print('guides ok')
