"""캐릭터 걷기 시트 정리 (v3.1)
입력: 144×192 (3열 × 4행, 48×48 칸) RGBA. 행 순서: 아래·왼쪽·오른쪽·위.
1) 반투명 가장자리 → 완전 불투명/투명 (번짐 제거), 1~2px 부스러기 제거
2) 칸마다 발끝을 45px 선에 맞추고, 같은 행 걸음 칸을 서 있는 칸에 맞춰 좌우 흔들림 제거
3) 캐릭터마다 색을 소수 팔레트로 정리 (금·빨강·눈동자 같은 작은 포인트는 가중치로 살림)
4) 실루엣 바깥 테두리를 어두운 보라검정으로 정리 → 어두운 바닥 위에서도 형태가 읽히게
사용: python3 clean_sprites.py <in_dir|mapping> <out_dir>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.color import rgb2lab, lab2rgb
from sklearn.cluster import KMeans

FW = FH = 48
FOOT = 45
OUTLINE = np.array([16, 11, 22])

# 머리가 작은 캐릭터: (배율, 목 줄 y — 발끝 45 기준으로 맞춘 뒤의 좌표). 머리가 위로 커지므로 칸 위에 PAD px를 더한다.
HEAD = {'yuri': (1.3, 25), 'teacher': (1.3, 24), 'ian': (1.25, 25), 'momo': (1.2, 25)}
PAD = 8
RAMP = 5
ORDER = int(os.environ.get("HEAD_ORDER", "0"))

def enlarge_head(f, s, neck):
    """목 줄 위를 s배로 키움(목 기준으로 위·좌우로). 목 아래 RAMP줄은 가로 배율을 1로 서서히 줄여 어깨·머리카락이 이어지게."""
    from scipy.ndimage import map_coordinates
    H, W = f.shape[:2]
    m = f[..., 3] > 0
    ys = np.nonzero(m.any(1))[0]
    top = ys.min()
    cx = np.nonzero(m[top:neck + 1])[1].mean()
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    sc = np.where(yy <= neck, s, np.where(yy < neck + RAMP, s + (1 - s) * (yy - neck) / RAMP, 1.0))
    sy = np.where(yy <= neck, neck - (neck - yy) / s, yy)
    sx = cx + (xx - cx) / sc
    a = f.astype(float); al = a[..., 3:4] / 255
    pm = np.concatenate([a[..., :3] * al, al], -1)
    out = np.stack([map_coordinates(pm[..., c], [sy, sx], order=ORDER, mode='constant', cval=0) for c in range(4)], -1)
    A = out[..., 3]
    rgb = np.where(A[..., None] > 1e-6, out[..., :3] / np.maximum(A[..., None], 1e-6), 0)
    g = np.zeros_like(f)
    keep = A >= 0.5
    g[keep, :3] = np.clip(rgb[keep], 0, 255).round().astype(np.uint8)
    g[keep, 3] = 255
    return g

def frames(a):
    return [[a[r*FH:(r+1)*FH, c*FW:(c+1)*FW].copy() for c in range(3)] for r in range(4)]

def harden(f, thr=110):
    al = f[..., 3]
    m = al >= thr
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n+1))
        for i, s in enumerate(sizes):
            if s < 4: m[lab == i+1] = False
    out = f.copy()
    out[..., 3] = np.where(m, 255, 0)
    out[~m, :3] = 0
    return out

def shift(f, dx, dy):
    out = np.zeros_like(f)
    H, W = f.shape[:2]
    ys0, ys1 = max(0, dy), min(H, H+dy); xs0, xs1 = max(0, dx), min(W, W+dx)
    out[ys0:ys1, xs0:xs1] = f[ys0-dy:ys1-dy, xs0-dx:xs1-dx]
    return out

def bbox(m):
    ys, xs = np.nonzero(m); return xs.min(), ys.min(), xs.max(), ys.max()

def upper_mask(f):
    m = f[..., 3] > 0
    x0, y0, x1, y1 = bbox(m)
    cut = y0 + int((y1 - y0) * 0.55)
    u = m.copy(); u[cut:] = False
    return u

def stand_score(f, side):
    """낮을수록 '서 있는' 칸. 옆모습: 다리 벌어짐 폭, 앞·뒤: 아래쪽 좌우 비대칭."""
    m = f[..., 3] > 0
    x0, y0, x1, y1 = bbox(m)
    if side:
        leg = m[y1-6:y1+1]; xs = np.nonzero(leg.any(0))[0]
        return xs.max() - xs.min()
    low = m[y0 + int((y1-y0)*0.55):y1+1, x0:x1+1]
    return (low ^ low[:, ::-1]).sum()

def align_sheet(fr):
    out = [[None]*3 for _ in range(4)]
    for r in range(4):
        sc = [stand_score(f, r in (1, 2)) for f in fr[r]]
        best = int(np.argmin(sc))
        if best != 1 and sc[best] < sc[1] * 0.8:       # 가운데(서 있는) 칸이 걸음 동작이면 가장 가지런한 칸과 바꿈
            fr[r][1], fr[r][best] = fr[r][best], fr[r][1]; print("  swap row", r, "col", best, sc)
        # 서 있는 칸(가운데): 발끝 45, 머리·몸통 무게중심을 칸 가운데로
        idle = fr[r][1]
        x0, y0, x1, y1 = bbox(idle[..., 3] > 0)
        idle = shift(idle, 0, FOOT - y1)
        u = upper_mask(idle)
        cx = np.nonzero(u)[1].mean()
        idle = shift(idle, int(round(23.5 - cx)), 0)
        out[r][1] = idle
        ref = upper_mask(idle)
        for c in (0, 2):
            f = fr[r][c]
            x0, y0, x1, y1 = bbox(f[..., 3] > 0)
            f = shift(f, 0, FOOT - y1)
            best, bdx = -1, 0
            for dx in range(-8, 9):
                s = (upper_mask(shift(f, dx, 0)) & ref).sum()
                if s > best: best, bdx = s, dx
            out[r][c] = shift(f, bdx, 0)
    return out

def palettize(fr, k):
    px = np.concatenate([f[f[..., 3] > 0][:, :3] for row in fr for f in row]).astype(float) / 255
    lab = rgb2lab(px.reshape(-1, 1, 3)).reshape(-1, 3)
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    w = 1 + (chroma / 25) ** 2 + (lab[:, 0] > 80) * 1.5      # 채도 높은 포인트·하이라이트 살림
    km = KMeans(n_clusters=k, n_init=6, random_state=1).fit(lab, sample_weight=w)
    cen = km.cluster_centers_
    pal = np.clip(lab2rgb(cen.reshape(-1, 1, 3)).reshape(-1, 3) * 255, 0, 255).round().astype(np.uint8)
    out = []
    for row in fr:
        orow = []
        for f in row:
            g = f.copy(); m = g[..., 3] > 0
            l = rgb2lab((g[m][:, :3] / 255).reshape(-1, 1, 3).astype(float)).reshape(-1, 3)
            d = ((l[:, None, :] - cen[None]) ** 2).sum(-1)
            g[m, :3] = pal[d.argmin(1)]
            orow.append(g)
        out.append(orow)
    return out, pal

def tone(fr):
    """밝기 대비를 조금 벌리고, 피부(따뜻한 중간 밝기)를 밝혀 얼굴이 읽히게."""
    out = []
    for row in fr:
        orow = []
        for f in row:
            g = f.copy(); m = g[..., 3] > 0
            lab = rgb2lab((g[m][:, :3] / 255).reshape(-1, 1, 3).astype(float)).reshape(-1, 3)
            L, A, B = lab[:, 0], lab[:, 1], lab[:, 2]
            skin = (L > 48) & (L < 92) & (A > 3) & (A < 28) & (B > 4) & (B < 32) & (B > A * 0.5)
            L2 = np.clip((L - 40) * 1.10 + 41, 0, 100)
            L2[skin] = np.minimum(L2[skin] + 7, 93)
            dark = L < 22
            lab2 = np.stack([L2, A, B], 1)
            lab2[dark, 1:] *= 0.6; lab2[dark, 1] += 2.0; lab2[dark, 2] -= 3.0     # 그림자는 보라검정 쪽으로
            g[m, :3] = np.clip(lab2rgb(lab2.reshape(-1, 1, 3)).reshape(-1, 3) * 255, 0, 255).round().astype(np.uint8)
            orow.append(g)
        out.append(orow)
    return out

def denoise(f, pal):
    """팔레트 칸에서 4방향 이웃과 전부 다른 외톨이 점을 이웃 다수색으로 (밝은 포인트·채도 높은 점은 둔다)."""
    g = f.copy(); m = g[..., 3] > 0
    idx = np.full(m.shape, -1)
    cols = {tuple(c): i for i, c in enumerate(pal)}
    for y, x in zip(*np.nonzero(m)): idx[y, x] = cols.get(tuple(g[y, x, :3]), -1)
    lab = rgb2lab((pal / 255).reshape(-1, 1, 3).astype(float)).reshape(-1, 3)
    keep = (np.hypot(lab[:, 1], lab[:, 2]) > 22) | (lab[:, 0] > 82)
    H, W = m.shape; new = idx.copy()
    for y in range(1, H-1):
        for x in range(1, W-1):
            i = idx[y, x]
            if i < 0 or keep[i]: continue
            nb = [idx[y-1, x], idx[y+1, x], idx[y, x-1], idx[y, x+1]]
            if -1 in nb or i in nb: continue
            vals, cnt = np.unique(nb, return_counts=True)
            if cnt.max() >= 3: new[y, x] = vals[cnt.argmax()]
    ch = (new != idx) & (new >= 0)
    g[ch, :3] = pal[new[ch]]
    return g

def outline(f):
    m = f[..., 3] > 0
    er = ndimage.binary_erosion(m, structure=[[0,1,0],[1,1,1],[0,1,0]])
    edge = m & ~er
    g = f.copy()
    c = g[edge, :3].astype(float)
    g[edge, :3] = (c * 0.28 + OUTLINE * 0.72).round().astype(np.uint8)
    return g

def build(src, dst, k, name=''):
    a = np.array(Image.open(src).convert('RGBA'))
    fr = [[harden(f) for f in row] for row in frames(a)]
    fr = align_sheet(fr)
    if name in HEAD:
        s, neck = HEAD[name]
        fr = [[enlarge_head(np.concatenate([np.zeros((PAD, FW, 4), np.uint8), f]), s, neck + PAD) for f in row] for row in fr]
    fr = tone(fr)
    fr, pal = palettize(fr, k)
    fr = [[denoise(f, pal) for f in row] for row in fr]
    fr = [[outline(f) for f in row] for row in fr]
    fh = fr[0][0].shape[0]
    out = np.zeros((fh * 4, FW * 3, 4), np.uint8)
    for r in range(4):
        for c in range(3):
            out[r*fh:(r+1)*fh, c*FW:(c+1)*FW] = fr[r][c]
    import stand_pose; out = stand_pose.fix_sheet(out)   # 가운데 칸을 멈춰 선 다리로 (v3.8)
    Image.fromarray(out).save(dst)
    return len(pal)

if __name__ == '__main__':
    mapping = json.load(open(sys.argv[1]))
    os.makedirs(sys.argv[2], exist_ok=True)
    for src, name in mapping.items():
        n = build(src, os.path.join(sys.argv[2], name + '.png'), int(sys.argv[3]) if len(sys.argv) > 3 else 16, name)
        print(name, n)
