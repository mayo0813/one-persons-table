"""새 걷기 도트에서 특수 포즈 시트를 만든다 (v3.1)
hero_m_pose / hero_f_pose : 0행 책상에 엎드림(뒷모습), 1행 침대에 누움(양호실 침대 14번 위)
yuri_pose                 : 1행 도시락 먹기(정면), 2행 침대에 누움(기숙사 침대 15번 위)
빈 행은 투명. 3칸은 숨쉬기(0,1,0px).
사용: python3 make_poses.py <game_dir>
"""
import sys, os
import numpy as np
from PIL import Image
from skimage.color import rgb2lab
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_sprites as IS

G = sys.argv[1]
CH = os.path.join(G, 'assets/characters')
TS = os.path.join(G, 'assets/tilesets/tiles_classroom.png')

def frame(name, r, c):
    """칸 높이는 시트 높이/4 (머리를 키운 캐릭터는 56). 위쪽 여백(fh-48)도 함께 돌려줌."""
    a = np.array(Image.open(os.path.join(CH, name + '.png')).convert('RGBA'))
    fh = a.shape[0] // 4
    return a[r*fh:(r+1)*fh, c*48:(c+1)*48].copy()

def pad_to(f, fh):
    if f.shape[0] >= fh: return f
    return np.concatenate([np.zeros((fh - f.shape[0], 48, 4), np.uint8), f])

def tile(idx):
    a = np.array(Image.open(TS).convert('RGBA'))
    x, y = (idx % 8) * 48, (idx // 8) * 48
    return a[y:y+48, x:x+48].copy()

def lab_of(f):
    return rgb2lab((f[..., :3] / 255.0).astype(float))

def skin_mask(f):
    l = lab_of(f); L, A, B = l[..., 0], l[..., 1], l[..., 2]
    return (f[..., 3] > 0) & (L > 62) & (A > 3) & (A < 30) & (B > 5) & (B < 35)

def blit(dst, src, dx, dy):
    H, W = src.shape[:2]
    for y in range(H):
        for x in range(W):
            if src[y, x, 3] and 0 <= y+dy < 48 and 0 <= x+dx < 48:
                dst[y+dy, x+dx] = src[y, x]

def close_eyes(f):
    """얼굴(피부) 안쪽의 어두운·보라 점(눈)을 피부로 덮고 아랫줄에 감은 눈 선."""
    g = f.copy(); sk = skin_mask(g)
    ys = np.nonzero(sk.any(1))[0]
    if not len(ys): return g
    skin_col = np.median(g[sk][:, :3], axis=0).astype(np.uint8)
    lid = np.array([46, 30, 40], np.uint8)
    top = ys.min(); band = []
    for y in range(top, min(top + 6, 47)):
        xs = np.nonzero(sk[y])[0]
        if len(xs) < 3: continue
        inner = [x for x in range(xs.min() + 1, xs.max()) if not sk[y, x] and g[y, x, 3]]
        if inner: band.append((y, inner))
    if not band: return g
    last = band[-1][0]
    for y, inner in band:
        for x in inner: g[y, x, :3] = skin_col
    for x in band[-1][1]: g[last, x, :3] = lid
    return g

def head_of(f):
    """정면 서 있는 칸에서 턱선까지 잘라냄."""
    sk = skin_mask(f)
    ys = np.nonzero(sk.any(1))[0]
    chin = ys.max() if len(ys) else 26
    # 손 피부가 섞이지 않게: 얼굴 피부 덩어리의 맨 아래 = 맨 위 피부 행에서 연속된 구간 끝
    rows = sorted(set(ys)); end = rows[0]
    for y in rows[1:]:
        if y - end > 2: break
        end = y
    h = f.copy(); h[end + 2:] = 0
    return h, end

CHIN_Y = {'yuri': 26}     # 피부가 머리색과 비슷해 얼굴이 시트에 덜 덮이게 조금 위로

EYE = {'hero_m': {}, 'hero_f': {}, 'yuri': {}}

def inbed(name, bed_idx):
    base = frame(name, 0, 1)
    if base.shape[0] != 48: base = base[-48:]
    shut = IS.stamp_face(base, IS.FACES[name], 0, mode='sleep') if name in IS.FACES else base
    fb = IS.face_box(base)
    chin = fb[4] if fb else 26
    head = shut.copy(); head[chin + 2:] = 0
    t = tile(bed_idx)
    out = []
    for b in (0, 1, 0):
        f = np.zeros((48, 48, 4), np.uint8)
        blit(f, head, 0, CHIN_Y.get(name, 28) - chin + b)
        # 이불 접힌 시트 줄(29행~)부터는 침대 타일 그림을 그대로 덮어 이불 속에 누운 것처럼
        cols = slice(5, 43)
        f[29:, cols] = t[29:, cols]
        f[29:, cols, 3] = 255
        out.append(f)
    return out

def slump(name):
    back = frame(name, 3, 1)
    m = back[..., 3] > 0
    ys = np.nonzero(m.any(1))[0]; y0, y1 = ys.min(), ys.max()
    split = y0 + int((y1 - y0) * 0.42)          # 머리 / 몸
    head = back.copy(); head[split:] = 0
    body = back.copy(); body[:split] = 0; body[y0 + int((y1 - y0) * 0.72):] = 0   # 앉아서 다리는 의자에 가림
    out = []
    for b in (0, 1, 0):
        f = np.zeros((48, 48, 4), np.uint8)
        blit(f, body, 0, 7)
        blit(f, head, 0, 11 + b)                 # 고개를 숙여 어깨에 묻힘
        out.append(f)
    return out

BOX = [[None, (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), None],
       [(40, 26, 30), (196, 168, 120), (196, 168, 120), (226, 214, 190), (226, 214, 190), (150, 40, 52), (150, 40, 52), (226, 214, 190), (196, 168, 120), (40, 26, 30)],
       [(40, 26, 30), (196, 168, 120), (226, 214, 190), (226, 214, 190), (120, 140, 90), (150, 40, 52), (226, 214, 190), (226, 214, 190), (196, 168, 120), (40, 26, 30)],
       [(40, 26, 30), (140, 104, 70), (140, 104, 70), (140, 104, 70), (140, 104, 70), (140, 104, 70), (140, 104, 70), (140, 104, 70), (140, 104, 70), (40, 26, 30)],
       [None, (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), (40, 26, 30), None]]

def eat(name):
    base = frame(name, 0, 1)
    sk = skin_mask(base); ys, xs = np.nonzero(sk)
    off = base.shape[0] - 48
    hands = [(y, x) for y, x in zip(ys, xs) if y > 26 + off]
    hy = int(np.mean([h[0] for h in hands])) if hands else 30
    out = []
    for i in range(3):
        f = base.copy()
        bx, by = 19, hy - 1
        for r, row in enumerate(BOX):
            for c, col in enumerate(row):
                if col: f[by + r, bx + c] = (*col, 255)
        if i == 1:      # 젓가락을 입으로
            for k in range(7):
                f[by - 1 - k, 24 - (k // 4), :] = (70, 46, 34, 255)
        out.append(f)
    return out

def sheet(rows):
    fh = max(f.shape[0] for fr in rows if fr for f in fr)
    im = np.zeros((fh * 4, 144, 4), np.uint8)
    for r, fr in enumerate(rows):
        if fr is None: continue
        for c in range(3): im[r*fh:(r+1)*fh, c*48:(c+1)*48] = pad_to(fr[c], fh)
    return Image.fromarray(im)

for hero in ('hero_m', 'hero_f'):
    sheet([slump(hero), inbed(hero, 14), None, None]).save(os.path.join(CH, hero + '_pose.png'))
sheet([None, eat('yuri'), inbed('yuri', 15), None]).save(os.path.join(CH, 'yuri_pose.png'))
print('ok')
