"""서 있는 칸(가운데 열)을 '멈춰 선' 다리로 고침 (v3.8)
원본 걷기 시트의 가운데 칸이 걷는 도중(한 발을 든) 그림이라, 멈춰 있을 때도 걷는 것처럼 보였음.
- 정면·뒷모습: 땅을 딛고 있는 쪽 다리를 몸 가운데 기준으로 좌우 반전해 반대쪽에 복사 → 두 발 가지런히
- 옆모습: 몸 중심에 가까운 다리만 남기고, 다른 다리는 그 다리를 뒤쪽으로 1칸 옮긴 어두운 복사본으로 → 발 모음
사용: python3 stand_pose.py <시트.png> [...]  (제자리 수정)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def leg_zone(f):
    m = f[..., 3] > 0
    H = f.shape[0]
    ys = np.nonzero(m.any(1))[0]
    y0, y1 = ys.min(), ys.max()
    spans = {}
    for y in range(y0, y1 + 1):
        xs = np.nonzero(m[y])[0]
        if len(xs): spans[y] = (xs.min(), xs.max())
    lo = y0 + int((y1 - y0) * 0.55)
    wmax = max(spans[y][1] - spans[y][0] + 1 for y in range(lo, y1 + 1) if y in spans)
    hem = lo
    for y in range(lo, y1 + 1):
        if y in spans and spans[y][1] - spans[y][0] + 1 >= 0.72 * wmax: hem = y
    hem = min(hem, y1 - 3)
    return hem + 1, y1, spans[hem]

LINE = np.array([20, 12, 22, 255], np.uint8)

def torso_axis(f, top):
    """다리 구역 바로 위 몸통 6줄의 좌우 중앙 ×2 (반전 축 x' = msum - x)."""
    m = f[..., 3] > 0
    c = []
    for y in range(max(0, top - 6), top):
        xs = np.nonzero(m[y])[0]
        if len(xs): c.append(xs.min() + xs.max())
    return int(round(np.median(c))) if c else 47

def fix_front(f, style='gap'):
    """정면·뒷모습 서 있는 다리: 땅을 딛은 다리를 몸통 중앙 기준으로 좌우 대칭으로 다시 놓음.
    style='gap'  : 두 다리 사이 1칸 틈
    style='join' : 두 다리를 붙이고 가운데 1칸 검은 선 (남자 바지)"""
    g = f.copy()
    H = f.shape[0]
    top, bot, _ = leg_zone(f)
    msum = torso_axis(f, top)
    if style == 'join': msum -= msum % 2            # 가운데 선이 한 칸에 오도록 짝수 축
    cx = msum / 2
    m = f[..., 3] > 0
    left = sum(m[y, x] for y in range(bot - 2, bot + 1) for x in range(48) if x < cx)
    right = sum(m[y, x] for y in range(bot - 2, bot + 1) for x in range(48) if x > cx)
    keep_left = left >= right
    leg = np.zeros_like(f)
    for y in range(top, bot + 1):
        for x in range(48):
            if keep_left and x < cx and f[y, x, 3]: leg[y, x] = f[y, x]
            if not keep_left and x > cx and f[y, x, 3]:
                X = msum - x
                if 0 <= X < 48: leg[y, X] = f[y, x]
    lm = leg[..., 3] > 0
    if not lm.any(): return g
    e = np.nonzero(lm.any(0))[0].max()             # 왼쪽 다리 오른쪽 끝
    if style == 'join':
        c = msum // 2; target = c - 1
    else:
        target = (msum - 2) // 2
    dx = target - e
    for y in range(top, bot + 1): g[y, :] = 0
    for y in range(top, bot + 1):
        for x in range(48):
            if leg[y, x, 3]:
                X = x + dx
                if 0 <= X < 48:
                    g[y, X] = leg[y, x]
                    Xm = msum - X
                    if 0 <= Xm < 48: g[y, Xm] = leg[y, x]
    if style == 'join':
        c = msum // 2
        for y in range(top, bot + 1):
            if g[y, c - 1, 3] or g[y, c + 1, 3]: g[y, c] = LINE
    return g

def runs(row):
    xs = np.nonzero(row)[0]
    if not len(xs): return []
    out = []; s = xs[0]; p = xs[0]
    for x in xs[1:]:
        if x != p + 1: out.append((s, p)); s = x
        p = x
    out.append((s, p)); return out

def fix_side(f, row):
    """옆모습: 발끝 줄에 발이 둘로 떨어져 있으면(보폭) 몸 중심에 가까운 발만 남기고,
    다리 구역 아래쪽은 그 발 폭 안의 점만 남긴 뒤, 뒤쪽으로 1칸 어두운 다리를 덧그림."""
    g = f.copy()
    top, bot, (hx0, hx1) = leg_zone(f)
    m = f[..., 3] > 0
    rr = runs(m[bot]) or runs(m[bot - 1])
    r2 = runs(m[bot - 1])
    feet = rr if len(rr) >= 2 else r2
    if len(feet) < 2: return g
    bc = (hx0 + hx1) / 2
    feet.sort(key=lambda r: abs((r[0] + r[1]) / 2 - bc))
    k0, k1 = feet[0]
    w0, w1 = k0 - 1, k1 + 1
    cut = top + max(1, (bot - top) // 3)
    for y in range(cut, bot + 1):
        for x in range(48):
            if (x < w0 or x > w1) and g[y, x, 3]: g[y, x] = 0
    back = 1 if row == 1 else -1
    src = g.copy()
    for y in range(cut, bot + 1):
        for x in range(w0, w1 + 1):
            X = x + back
            if src[y, x, 3] and 0 <= X < 48 and g[y, X, 3] == 0:
                c = src[y, x].astype(int); c[:3] = (c[:3] * 0.6).astype(int)
                g[y, X] = c
    return g

def body_axis(f, top, bot):
    """몸통 좌우 반전 축(x' = msum - x): 다리 구역 바로 위 몸통 줄들의 중앙."""
    m = f[..., 3] > 0
    c = []
    for y in range(max(0, top - 6), top):
        xs = np.nonzero(m[y])[0]
        if len(xs): c.append(xs.min() + xs.max())
    return int(round(np.median(c))) if c else 47

def fix_arms(f, neck):
    """정면·뒷모습: 목 아래 몸통을 몸에 붙은 팔 쪽으로 좌우 대칭 → 팔을 흔들지 않고 가지런히 선 모습."""
    g = f.copy()
    top, bot, _ = leg_zone(f)
    msum = body_axis(f, top, bot)
    cx = msum / 2
    m = f[..., 3] > 0
    lw = rw = 0
    for y in range(neck + 2, top):
        xs = np.nonzero(m[y])[0]
        if not len(xs): continue
        lw = max(lw, cx - xs.min()); rw = max(rw, xs.max() - cx)
    keep_left = lw <= rw
    for y in range(neck + 2, top):
        for x in range(48):
            if (x > cx and keep_left) or (x < cx and not keep_left):
                xs = msum - x
                g[y, x] = f[y, xs] if 0 <= xs < 48 else 0
    return g

NECK = {}   # 이름별 목 줄(정면 칸 기준) — fix_sheet(a, neck=..)로 넘김

def auto_neck(a):
    import import_sprites as IS
    fh = a.shape[0] // 4
    fb = IS.face_box(a[0:fh, 48:96][-48:])
    n = fb[4] if fb else 24
    return n if 20 <= n <= 28 else 24

def fix_sheet(a, neck='auto', style='gap'):
    fh = a.shape[0] // 4
    out = a.copy()
    if neck == 'auto': neck = auto_neck(a)
    for r in range(4):
        f = a[r*fh:(r+1)*fh, 48:96]
        if r in (0, 3):
            f = fix_front(f, style)
            if neck is not None: f = fix_arms(f, neck + (fh - 48))
        else:
            f = fix_side(f, r)
        out[r*fh:(r+1)*fh, 48:96] = f
    return out

if __name__ == '__main__':
    for p in sys.argv[1:]:
        a = np.array(Image.open(p).convert('RGBA'))
        Image.fromarray(fix_sheet(a)).save(p)
        print('stand', p)
