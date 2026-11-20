"""애니메이션 참고 시트 → 실패체 애니메이션 시트 + 그림자 출현·소멸 시트 (v5.1)
시트에서 칸을 잘라 같은 배율로 줄이고(평균 + 팔레트), 발끝(맨 아래 그림자 타원) 가운데를 기준으로 고정 칸에 넣는다.
출력: monster_union_anim.png (행 = 동작, 열 = 프레임), monster_shadow_anim.png, 그리고 칸 정보 JSON(콘솔)
사용: python3 gen_monster_anim.py <시트.png> <출력 폴더>"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.color import rgb2lab
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_sprites as IS

# 시트 안의 칸 (y, x, h, w) — 연결된 덩어리 찾기 결과에서 골라 적음
UNION = {
  'walk_down':  [(13, 218, 111, 113), (13, 341, 111, 115), (13, 466, 111, 117), (13, 594, 111, 116)],
  'walk_left':  [(126, 233, 109, 85), (126, 361, 108, 83), (125, 487, 109, 83), (126, 613, 109, 83)],
  'walk_right': [(237, 226, 106, 87), (238, 353, 105, 90), (238, 480, 105, 87), (238, 608, 105, 89)],
  'walk_up':    [(346, 230, 114, 84), (347, 354, 113, 86), (347, 481, 113, 86), (348, 610, 112, 87)],
  'idle':       [(12, 908, 178, 128), (11, 1056, 178, 127), (12, 1204, 178, 127), (12, 1353, 178, 127)],
  'alert':      [(231, 883, 151, 86), (233, 977, 149, 81), (227, 1065, 155, 84)],
  'look':       [(240, 1268, 138, 75), (239, 1349, 139, 75), (235, 1429, 143, 78)],
  'grab':       [(657, 950, 137, 129), (662, 1085, 132, 134), (662, 1230, 132, 143), (657, 1376, 138, 143)],
  'hit':        [(854, 117, 137, 95), (851, 219, 140, 95), (852, 317, 139, 91), (846, 417, 146, 97)],
  'appear':     [(945, 622, 44, 84), (857, 709, 135, 77), (842, 791, 152, 82), (839, 881, 157, 95)],
  'vanish':     [(827, 1111, 166, 95), (843, 1213, 151, 94), (871, 1312, 123, 102), (947, 1418, 46, 103)],
}
# 시트의 칸마다 그린 크기가 달라서, 동작마다 '머리 꼭대기~발끝' 높이(원본 px)로 나눠 크기를 맞춤
BODY = {'walk_down': 105, 'walk_left': 106, 'walk_right': 99, 'walk_up': 106, 'idle': 164, 'alert': 148, 'look': 135,
        'grab': 140, 'hit': 133, 'appear': 151, 'vanish': 160}
SHADOW = {
  'appear': [(945, 622, 44, 84), (857, 709, 135, 77), (842, 791, 152, 82)],
  'vanish': [(843, 1213, 151, 94), (871, 1312, 123, 102), (947, 1418, 46, 103)],
}

def crop(a, box, pad=4):
    y, x, h, w = box
    c = a[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad].copy()
    # 가장 큰 덩어리 + 가까운 조각만 남김 (옆 칸이 섞이지 않게)
    fg = c[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=3))
    if n > 1:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        keep = lab == (int(np.argmax(sizes)) + 1)
        c[~keep, 3] = 0
    return c

def shrink(c, s, cen, rgb, cut=0.4, sharp=0.5):
    H, W = c.shape[:2]
    th, tw = max(1, int(round(H * s))), max(1, int(round(W * s)))
    al = c[..., 3:4].astype(np.float32) / 255
    pm = np.concatenate([c[..., :3] * al, al], -1)
    ch = [np.array(Image.fromarray(pm[..., i].astype(np.float32), mode='F').resize((tw, th), Image.BOX)) for i in range(4)]
    A = ch[3]; col = np.stack(ch[:3], -1) / np.maximum(A[..., None], 1e-6)
    if sharp:
        bl = np.stack([ndimage.gaussian_filter(col[..., i], 0.8) for i in range(3)], -1)
        col = col + sharp * (col - bl)
    m = A >= cut
    o = np.zeros((th, tw, 4), np.uint8)
    if m.any():
        lab = rgb2lab((np.clip(col[m], 0, 255) / 255).reshape(-1, 1, 3)).reshape(-1, 3)
        idx = ((lab[:, None] - cen[None]) ** 2).sum(-1).argmin(1)
        o[m, :3] = rgb[idx]; o[m, 3] = 255
    solid = o[..., 3] > 0
    nb = ndimage.convolve(solid.astype(int), np.ones((3, 3)), mode='constant') - solid
    o[solid & (nb == 0)] = 0
    return o

def anchor_x(f):
    ys, xs = np.nonzero(f[..., 3] > 0)
    if not len(ys): return f.shape[1] // 2
    bot = ys.max(); sel = ys >= bot - max(2, int(f.shape[0] * 0.08))
    return int(round((xs[sel].min() + xs[sel].max()) / 2))

def build(a, spec, s, out, k=22, body=None, darken=0):
    crops = {n: [crop(a, b) for b in boxes] for n, boxes in spec.items()}
    allpx = np.concatenate([c.reshape(-1, 4) for cs in crops.values() for c in cs])
    allpx = allpx[allpx[:, 3] >= 128][None]
    cen, rgb, imp = IS.palette(allpx, np.ones(allpx.shape[:2], bool), k)
    frames = {n: [shrink(c, (s / body[n]) if body else s, cen, rgb) for c in cs] for n, cs in crops.items()}
    if darken:   # 그림자 몸 색에 맞춰 어둡게 (붉은 눈·흰자는 그대로)
        for fs in frames.values():
            for f in fs:
                m = f[..., 3] > 0
                lab = rgb2lab(f[..., :3] / 255.0)
                keep = (lab[..., 1] > 25) | (lab[..., 0] > 78)
                sel = m & ~keep
                f[sel, :3] = (f[sel, :3].astype(float) * darken).astype(np.uint8)
    # 칸 크기: 발끝 기준으로 좌우 최대 폭, 위로 최대 높이
    L = R = Hh = 0
    for fs in frames.values():
        for f in fs:
            ys, xs = np.nonzero(f[..., 3] > 0)
            if not len(ys): continue
            ax = anchor_x(f)
            L = max(L, ax - xs.min()); R = max(R, xs.max() - ax + 1); Hh = max(Hh, ys.max() + 1 - ys.min())
    half = max(L, R) + 1
    CW, CH = half * 2, Hh + 2
    ncol = max(len(v) for v in frames.values())
    sheet = np.zeros((CH * len(frames), CW * ncol, 4), np.uint8)
    meta = {}
    for r, (n, fs) in enumerate(frames.items()):
        meta[n] = {'row': r, 'n': len(fs)}
        for c, f in enumerate(fs):
            ys, xs = np.nonzero(f[..., 3] > 0)
            if not len(ys): continue
            ax = anchor_x(f)
            ox = c * CW + half - ax; oy = r * CH + CH - 1 - (ys.max() + 1)
            for y, x in zip(ys, xs): sheet[oy + y, ox + x] = f[y, x]
    Image.fromarray(sheet).save(out)
    return {'w': int(CW), 'h': int(CH), 'anims': meta}

if __name__ == '__main__':
    a = np.array(Image.open(sys.argv[1]).convert('RGBA')); d = sys.argv[2]
    mu = build(a, UNION, 78, os.path.join(d, 'monster_union_anim.png'), body=BODY)
    ms = build(a, SHADOW, 0.56, os.path.join(d, 'monster_shadow_anim.png'), darken=0.42)
    print(json.dumps({'union': mu, 'shadow': ms}, ensure_ascii=False))
