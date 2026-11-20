"""큰 참고 시트(3열×4행, 투명 배경) → 게임용 48×48 걷기 시트 (v3.2)
- 캐릭터마다 키를 같은 높이(TARGET_H)로 맞춰 머리 크기를 통일
- 줄일 때 '특징 우선' 방식: 칸마다 원본 색을 팔레트로 나눠 세고, 어두운 선·눈·채도 높은 포인트에 가중치를 줘서
  눈동자·테두리·금장·리본이 뭉개지지 않게 함
- 그다음 clean_sprites.py의 정렬(발끝 y45, 걸음 칸 좌우 흔들림 제거)·외톨이 점 정리·테두리 적용
사용: python3 import_sprites.py <설정 json> <출력 폴더>
설정: [{"src": "...png", "names": ["teacher"], "h": 43}, {"src": "...", "names": ["hero_m","hero_f"], "h": 43}]
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.color import rgb2lab, lab2rgb
from sklearn.cluster import KMeans

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clean_sprites as cs

FOOT = 45

def components(a):
    fg = a[..., 3] >= 128
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    sl = ndimage.find_objects(lab)
    area = ndimage.sum(fg, lab, range(1, n + 1))
    out = []
    for i, (s, ar) in enumerate(zip(sl, area)):
        if ar > 3000:
            out.append((s, i + 1))
    return out, lab

def grid(comps, ncols):
    cy = np.array([(s[0].start + s[0].stop) / 2 for s, _ in comps])
    cx = np.array([(s[1].start + s[1].stop) / 2 for s, _ in comps])
    ry = KMeans(4, n_init=5, random_state=0).fit(cy.reshape(-1, 1))
    rord = np.argsort(ry.cluster_centers_.ravel())
    rx = KMeans(ncols, n_init=5, random_state=0).fit(cx.reshape(-1, 1))
    cord = np.argsort(rx.cluster_centers_.ravel())
    g = [[None] * ncols for _ in range(4)]
    for k, c in enumerate(comps):
        r = int(np.where(rord == ry.labels_[k])[0][0]); col = int(np.where(cord == rx.labels_[k])[0][0])
        g[r][col] = c
    return g

def palette(a, mask, k=26):
    px = a[mask][:, :3].astype(float) / 255
    rng = np.random.default_rng(0)
    if len(px) > 60000: px = px[rng.choice(len(px), 60000, replace=False)]
    lab = rgb2lab(px.reshape(-1, 1, 3)).reshape(-1, 3)
    ch = np.hypot(lab[:, 1], lab[:, 2])
    w = 1 + (ch / 22) ** 2 + (lab[:, 0] < 28) * 1.0
    km = KMeans(k, n_init=4, random_state=1).fit(lab, sample_weight=w)
    cen = km.cluster_centers_
    rgb = np.clip(lab2rgb(cen.reshape(-1, 1, 3)).reshape(-1, 3) * 255, 0, 255).round().astype(np.uint8)
    L = cen[:, 0]; C = np.hypot(cen[:, 1], cen[:, 2])
    imp = 1 + 1.6 * (L < 30) + 1.2 * (C > 22) + 0.6 * (L > 88)   # 어두운 선·눈, 포인트 색, 하이라이트 우선
    return cen, rgb, imp

def index_map(crop, cen):
    m = crop[..., 3] >= 128
    idx = np.full(m.shape, -1, int)
    lab = rgb2lab((crop[m][:, :3] / 255).reshape(-1, 1, 3).astype(float)).reshape(-1, 3)
    d = ((lab[:, None, :] - cen[None]) ** 2).sum(-1)
    idx[m] = d.argmin(1)
    return idx

def downscale(idx, f, k, imp, bg_keep=0.5):
    H, W = idx.shape
    th, tw = int(np.ceil(H / f)), int(np.ceil(W / f))
    out = np.full((th, tw), -1, int)
    for ty in range(th):
        y0, y1 = int(round(H - (th - ty) * f)), int(round(H - (th - ty - 1) * f))   # 아래(발끝) 기준으로 칸 나눔
        y0 = max(0, y0)
        if y1 <= y0: continue
        for tx in range(tw):
            x0, x1 = int(round(tx * f)), min(W, int(round((tx + 1) * f)))
            if x1 <= x0: continue
            blk = idx[y0:y1, x0:x1].ravel()
            n = blk.size
            bgc = (blk < 0).sum() / n
            if bgc >= bg_keep: continue
            cnt = np.bincount(blk[blk >= 0], minlength=k).astype(float)
            score = cnt * imp
            out[ty, tx] = int(score.argmax())
    return out

SHARP = 0.0
def box_small(crop, f, cen, dark=1.0):
    H, W = crop.shape[:2]
    th, tw = int(np.ceil(H / f)), int(np.ceil(W / f))
    # 아래(발끝) 기준으로 맞추려고 위쪽을 투명으로 채움
    padH = int(round(th * f)); pad = np.zeros((padH, int(round(tw * f)), 4), np.float32)
    pad[padH - H:, :W] = crop
    al = pad[..., 3:4] / 255.0
    pm = np.concatenate([pad[..., :3] * al, al], -1)
    img = Image.fromarray(np.zeros((1, 1), np.uint8))
    chans = [np.array(Image.fromarray(pm[..., i].astype(np.float32), mode='F').resize((tw, th), Image.BOX)) for i in range(4)]
    a = chans[3]; rgbm = np.stack(chans[:3], -1) / np.maximum(a[..., None], 1e-6)
    if SHARP:
        from scipy.ndimage import gaussian_filter
        bl = np.stack([gaussian_filter(rgbm[..., i], 0.8) for i in range(3)], -1)
        rgbm = np.where((a[..., None] >= 0.5), rgbm + SHARP * (rgbm - bl), rgbm)
    out = np.full((th, tw), -1, int)
    m = a >= 0.5
    if m.any():
        lab = rgb2lab((np.clip(rgbm[m], 0, 255) / 255).reshape(-1, 1, 3)).reshape(-1, 3)
        d = ((lab[:, None, :] - cen[None]) ** 2).sum(-1)
        d[:, cen[:, 0] < 30] /= dark
        out[m] = d.argmin(1)
    return out

def find_eyes(crop):
    """원본(큰 그림)에서 눈 덩어리 찾기: 얼굴 피부 위쪽 띠에서, 피부에 붙어 있는 아주 어두운 점(눈동자)이나
    채도 있는 점(유리의 보라 눈 등). 앞머리(덜 어두움)는 밝기로 걸러냄."""
    m = crop[..., 3] >= 128
    lab = rgb2lab((crop[..., :3] / 255).astype(float))
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]; C = np.hypot(A, B)
    skin = m & (L > 70) & (A > 1) & (A < 30) & (B > 2) & (B < 30)
    H = crop.shape[0]
    skin[int(H * 0.5):] = False
    sl, n = ndimage.label(skin)
    if not n: return []
    sizes = ndimage.sum(skin, sl, range(1, n + 1))
    face = sl == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(face)
    fy0, fy1, fx0, fx1 = ys.min(), ys.max(), xs.min(), xs.max()
    zone = np.zeros_like(m)
    zone[max(0, fy0 - 6):fy0 + int((fy1 - fy0) * 0.55), fx0 + 1:fx1] = True
    near = ndimage.binary_dilation(face, iterations=4)
    eye = m & ~skin & zone & near & ((L < 19) | ((C > 20) & (L > 25) & (L < 72)))
    cl, cn = ndimage.label(eye)
    eyes = []
    for i, s in enumerate(ndimage.find_objects(cl)):
        area = (cl[s] == i + 1).sum()
        if area < 15: continue
        eyes.append((s[0].start, s[0].stop, s[1].start, s[1].stop, area))
    eyes.sort(key=lambda e: -e[4])
    return sorted(eyes[:2], key=lambda e: e[2])

def paint_eyes(small, eyes, H, f, base):
    """줄인 그림에 눈을 또렷하게: 2칸 폭 × 3줄 (위: 속눈썹, 가운데: 눈동자+하이라이트, 아래: 눈동자)."""
    th, tw = small.shape
    LASH, IRIS, HI = base, base + 1, base + 2
    for (y0, y1, x0, x1, pix) in eyes:
        cy = th - (H - (y0 + y1) / 2) / f
        cx = ((x0 + x1) / 2) / f
        w = 2 if (x1 - x0) / f >= 1.4 else 1
        ty = int(round(cy - 1.5)); tx = int(round(cx - w / 2))
        for dy in range(3):
            for dx in range(w):
                Y, X = ty + dy, tx + dx
                if 0 <= Y < th and 0 <= X < tw:
                    small[Y, X] = LASH if dy == 0 else IRIS
        Y, X = ty + 1, tx + (w - 1 if w > 1 else 0)
        if w > 1 and 0 <= Y < th and 0 <= X < tw: small[Y, X] = HI
    return small

def face_box(f):
    m = f[..., 3] > 0
    lab = rgb2lab((f[..., :3] / 255).astype(float))
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    skin = m & (L > 64) & (A >= 4) & (B >= 4) & (A < 30) & (B < 22)     # 피부: 따뜻한 밝은색 (흰·연보라 머리, 금장 제외)
    skin[int(f.shape[0] * 0.625):] = False
    sl, n = ndimage.label(skin)
    if not n: return None
    sizes = ndimage.sum(skin, sl, range(1, n + 1))
    face = sl == int(np.argmax(sizes)) + 1
    if face.sum() < 6: return None
    rows = [y for y in range(48) if face[y].sum() >= 2]
    ft = rows[0]
    wr = min(ft + 2, rows[-1])
    xs = np.nonzero(face[wr])[0]
    col = np.median(f[face][:, :3], axis=0).astype(np.uint8)
    return ft, xs.min(), xs.max(), col, rows[-1]

def eyes48(f, row, spec):
    """48px 칸에 눈을 새로 그림.
    1) 얼굴 위쪽 4줄(눈 자리)에서 원본 눈 찌꺼기(어두운 점)를 피부로 지움
    2) 정면: 얼굴 가운데를 기준으로 좌우 대칭 두 눈 / 옆: 앞쪽 한 눈
       뜬 눈 = 3줄: 속눈썹(바깥쪽으로 1칸 더 긴 선) / 눈동자+흰 하이라이트 / 눈동자
       'smile' = 웃는 실눈(^ 모양), 'closed' = 잠든 눈(가로 선)"""
    fb = face_box(f)
    if fb is None: return f
    ft, x0, x1, skin, fbot = fb
    g = f.copy()
    lash = np.array([20, 12, 22], np.uint8); hi = np.array([244, 238, 248], np.uint8)
    iris = np.array(spec.get('iris', [40, 30, 36]), np.uint8)
    dark_iris = (iris.astype(int) * 0.62).astype(np.uint8)
    top = ft - 1 + spec.get('dy', 0)
    lab_of = lambda c: rgb2lab((c / 255).reshape(1, 1, 3).astype(float))[0, 0]
    is_skin = lambda l: l[0] > 64 and 4 <= l[1] < 30 and 4 <= l[2] < 22
    # 1) 눈 자리 정리
    #    눈 윗줄(앞머리 끝 2줄): 머리색보다 확 어두운 점(원본 눈 찌꺼기) → 머리색
    #    눈 줄 아래 3줄: 얼굴 폭 안의 어두운 점 → 피부 (실루엣 가장자리 테두리는 둠)
    hz = [g[y, x, :3] for y in range(max(0, top - 4), top - 1) for x in range(x0, x1 + 1)
          if g[y, x, 3] and not is_skin(lab_of(g[y, x, :3]))]
    if hz:
        hair = np.median(np.array(hz), axis=0).astype(np.uint8); hl = lab_of(hair)[0]
        for y in (top - 1, top):
            for x in range(x0, x1 + 1):
                if g[y, x, 3] and lab_of(g[y, x, :3])[0] < hl - 8: g[y, x, :3] = hair
    for y in range(top + 1, top + 4):
        for x in range(x0, x1 + 1):
            if not g[y, x, 3]: continue
            edge = not (g[y, x - 1, 3] and g[y, x + 1, 3])
            if not edge and lab_of(g[y, x, :3])[0] < 55: g[y, x, :3] = skin
    def put(y, x, c):
        if 0 <= y < g.shape[0] and 0 <= x < 48: g[y, x, :3] = c; g[y, x, 3] = 255
    c2 = x0 + x1 + 1                        # 얼굴 가운데 ×2 (정수로 대칭 계산)
    fw = x1 - x0 + 1
    gap = max(2, int(round(fw * 0.22)))     # 두 눈 사이(피부) 칸 수
    if row == 0:
        lx = (c2 - gap) // 2 - 2; rx = (c2 + gap) // 2
        side = spec.get('front', 'both')
        eyes = []
        if side in ('both', 'left'): eyes.append((lx, -1))
        if side in ('both', 'right'): eyes.append((rx, +1))
    elif row == 1:
        eyes = [(x0 + 1, -1)]
    else:
        eyes = [(x1 - 2, +1)]
    mode = 'closed' if spec.get('closed') else ('smile' if spec.get('smile') else 'open')
    for ex, out in eyes:
        if mode == 'open':
            put(top, ex, lash); put(top, ex + 1, lash)
            put(top, ex + (2 if out > 0 else -1), lash)          # 바깥 눈꼬리
            put(top + 1, ex, iris); put(top + 1, ex + 1, iris)
            put(top + 1, ex + (1 if out > 0 else 0), hi)         # 하이라이트는 바깥쪽 위
            put(top + 2, ex, dark_iris); put(top + 2, ex + 1, dark_iris)
        elif mode == 'smile':                                  # ^ 모양 웃는 실눈 (3칸)
            bx = ex - (1 if out < 0 else 0)
            put(top + 1, bx + 1, lash)
            put(top + 2, bx, lash); put(top + 2, bx + 2, lash)
        else:                                                  # 잠든 눈: 아래로 처진 선
            bx = ex - (1 if out < 0 else 0)
            put(top + 2, bx, lash); put(top + 2, bx + 1, lash); put(top + 2, bx + 2, lash)
    if spec.get('mouth') and row == 0:
        my = top + 5 if fbot >= top + 5 else fbot
        mc = np.array([150, 88, 98], np.uint8)
        put(my, c2 // 2 - 1, mc); put(my, c2 // 2, mc)
    return g

FACES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'faces.json')))
LASH = np.array([20, 12, 22], np.uint8)
HI = np.array([244, 238, 248], np.uint8)
RIM = np.array([168, 162, 180], np.uint8)
MOUTH = np.array([190, 120, 126], np.uint8)

def head_offset(f, idle):
    """걸음 칸의 머리가 서 있는 칸보다 얼마나 옮겨졌는지 (dy, dx) — 머리 영역 색 차이가 가장 작은 이동."""
    best, bo = None, (0, 0)
    hh = int(idle.shape[0] * 0.625)
    a = idle[2:hh].astype(int)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            b = np.roll(np.roll(f, -dy, 0), -dx, 1)[2:hh].astype(int)
            d = (np.abs(a[..., :3] - b[..., :3]).sum(-1) * ((a[..., 3] > 0) | (b[..., 3] > 0))).sum() + 400 * ((a[..., 3] > 0) ^ (b[..., 3] > 0)).sum()
            if best is None or d < best: best, bo = d, (dy, dx)
    return bo

def skin_color(f):
    m = f[..., 3] > 0
    lab = rgb2lab((f[..., :3] / 255).astype(float))
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    sk = m & (L > 64) & (A >= 4) & (B >= 4) & (A < 30) & (B < 22)
    sk[30:] = False
    if sk.sum() == 0: return np.array([240, 214, 204], np.uint8)
    cols, cnt = np.unique(f[sk][:, :3], axis=0, return_counts=True)
    return cols[cnt.argmax()]

def hair_color(g, cx, cy):
    reg = g[max(0, cy - 6):cy - 1, max(0, cx - 4):cx + 5]
    px = reg[reg[..., 3] > 0][:, :3]
    if not len(px): return np.array([50, 36, 56], np.uint8)
    lum = px.astype(int).sum(-1)
    sel = px[(lum >= np.percentile(lum, 20)) & (lum <= np.percentile(lum, 85))] if len(px) > 4 else px
    if len(sel): px = sel
    return np.median(px, axis=0).astype(np.uint8)

def stamp_face(f, spec, row, off=(0, 0), mode=None):
    """faces.json의 얼굴 도장. mode='sleep'이면 눈 무늬 자리에 감은 눈 선."""
    rs = spec.get(str(row))
    if not rs: return f
    g = f.copy(); dy, dx = off
    skin = skin_color(f)
    iris = np.array(spec.get('iris', [40, 30, 36]), np.uint8)
    pal = {'L': LASH, 'I': iris, 'H': HI, 'D': (iris.astype(int) * 0.55).astype(np.uint8),
           'R': np.array(spec.get('rim', [70, 66, 80]), np.uint8), 'P': np.array([236, 176, 182], np.uint8),
           'M': MOUTH, 'S': skin}
    def put(y, x, c):
        y += dy; x += dx
        if 0 <= y < g.shape[0] and 0 <= x < 48: g[y, x, :3] = c; g[y, x, 3] = 255
    for y, x0, x1 in rs.get('skin', []):
        for x in range(x0, x1 + 1): put(y, x, skin)
    for y, x0, x1 in rs.get('hair', []):
        hc = hair_color(g, (x0 + x1) // 2 + dx, y + dy)
        for x in range(x0, x1 + 1): put(y, x, hc)
    for name, x0, y0, mir in rs.get('pats', []):
        rows = FACES['patterns'][name]
        if mir: rows = [r[::-1] for r in rows]
        if mode == 'sleep' and name in ('round', 'cat', 'cat_l', 'cat_r', 'glasses'):
            h, w = len(rows), len(rows[0])
            top = 1 if name.startswith('cat') else 0
            for yy in range(top + 1, h):
                for xx in range(w):
                    if rows[yy][xx] in 'IHD': put(y0 + yy, x0 + xx, skin)
            for xx in range(w):
                if rows[top][xx] == 'L':
                    put(y0 + top, x0 + xx, skin if name != 'glasses' else LASH); put(y0 + top + 2, x0 + xx, LASH)
            continue
        for yy, r in enumerate(rows):
            for xx, ch in enumerate(r):
                if ch in pal: put(y0 + yy, x0 + xx, pal[ch])
    for cx, cy in rs.get('clip', []):                        # 모모 X 핀
        cx += dx; cy += dy
        reg = g[max(0, cy - 3):cy + 4, max(0, cx - 3):cx + 4]
        lum = reg[..., :3].astype(int).sum(-1)
        dk = reg[(reg[..., 3] > 0) & (lum < 300)][:, :3]
        hc = np.median(dk, axis=0).astype(np.uint8) if len(dk) else np.array([50, 36, 56], np.uint8)
        reg[(reg[..., 3] > 0) & (lum >= 450)] = np.append(hc, 255)
        for ox, oy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)): put(cy + oy - dy, cx + ox - dx, HI)
    return g

def to_frame(small, rgb, fh=48):
    th, tw = small.shape
    f = np.zeros((fh, 48, 4), np.uint8)
    ys, xs = np.nonzero(small >= 0)
    if not len(ys): return f
    y1 = ys.max(); x0, x1 = xs.min(), xs.max()
    oy = (fh - 3) - y1; ox = 24 - (x0 + x1 + 1) // 2
    for y, x in zip(ys, xs):
        Y, X = y + oy, x + ox
        if 0 <= Y < fh and 0 <= X < 48:
            f[Y, X, :3] = rgb[small[y, x]]; f[Y, X, 3] = 255
    return f

def build(cfg, outdir):
    a = np.array(Image.open(cfg['src']).convert('RGBA'))
    comps, lab = components(a)
    names = cfg['names']
    ncols = 3 * len(names)
    g = grid(comps, ncols)
    for gi, name in enumerate(names):
        cells = [[g[r][gi * 3 + c] for c in range(3)] for r in range(4)]
        mask = np.zeros(a.shape[:2], bool)
        for row in cells:
            for s, li in row: mask[s] |= lab[s] == li
        FHC = cfg.get('fh', {}).get(name, 48)       # 머리를 키운 캐릭터는 칸을 위로 늘림
        cs.FOOT = FHC - 3
        cen, rgb, imp = palette(a, mask)
        iris = np.array(cfg.get('iris', [40, 30, 36]), np.uint8)
        rgb = np.concatenate([rgb, np.array([[22, 14, 24], iris, [236, 228, 240]], np.uint8)])
        imp = np.concatenate([imp, [1, 1, 1]])
        base = len(rgb) - 3
        hs = sorted(s[0].stop - s[0].start for row in cells for s, _ in row)
        f = np.median(hs) / cfg.get('hh', {}).get(name, cfg.get('h', 43))
        fr = []
        for row in cells:
            orow = []
            for s, li in row:
                crop = a[s].copy(); crop[lab[s] != li, 3] = 0
                global SHARP; SHARP = cfg.get('sharp', 0.0)
                if cfg.get('box'):   # 평균(박스)으로 줄인 뒤 팔레트에 맞춤 — 얼굴 비율이 덜 무너짐
                    small = box_small(crop, f, cen, cfg.get('box_imp_dark', 1.0))
                else:
                    small = downscale(index_map(crop, cen), f, len(rgb), imp)
                orow.append(to_frame(small, rgb, FHC))
            fr.append(orow)
        if not cfg.get('nostand'):   # 원본 시트의 가운데 칸을 그대로 서 있는 모습으로 씀
            fr = cs.align_sheet(fr)
        pal = rgb
        spec = None if cfg.get('noface') else FACES.get(cfg.get('facekey', {}).get(name, name))
        if spec:
            fr = [[stamp_face(x, spec, r, head_offset(x, row[1]) if c != 1 else (0, 0)) if r < 3 else x
                   for c, x in enumerate(row)] for r, row in enumerate(fr)]
        e48 = cfg.get('eye48', {}).get(name)
        if e48:   # 얼굴 칸(피부) 기준으로 눈을 새로 그림 (v5.1 새 주인공 도트)
            fr = [[eyes48(x, r, e48) if r < 3 else x for x in row] for r, row in enumerate(fr)]
        fr = [[cs.denoise(x, pal) for x in row] for row in fr]
        fr = [[cs.outline(x) for x in row] for row in fr]
        out = np.zeros((FHC * 4, 144, 4), np.uint8)
        for r in range(4):
            for c in range(3): out[r*FHC:(r+1)*FHC, c*48:(c+1)*48] = fr[r][c]
        if not cfg.get('nostand'):
            import stand_pose; out = stand_pose.fix_sheet(out, style=cfg.get('legs', {}).get(name, 'gap'))   # 가운데 칸을 멈춰 선 다리로 (v3.8)
        Image.fromarray(out).save(os.path.join(outdir, cfg.get('out', {}).get(name, name) + '.png'))
        print(name, 'scale %.2f' % f)

if __name__ == '__main__':
    cfgs = json.load(open(sys.argv[1]))
    os.makedirs(sys.argv[2], exist_ok=True)
    for c in cfgs: build(c, sys.argv[2])
