"""일반 학생 4명 = 새 주인공 도트를 바탕으로 머리색·머리모양만 바꿈 (v3.9)
- student_1 (남, 갈색), student_2 (남, 밝은 갈색) ← hero_m
- student_4 (여, 긴 밝은 갈색) ← hero_f
- student_3 (여, 검은 단발) ← hero_f 머리(턱선까지) + momo 몸(어깨 아래, 단발이라 등·옆이 드러남)
- 눈: 하이라이트 없이 멍한 눈(눈동자 회갈색)
- 머리 판별: 머리 위쪽에서 이어진, 따뜻한 중간 어두움 색(L 17~42, a≥2.3, b<8) 덩어리 → 교복(무채색 검정)과 구분
사용: python3 make_students.py <게임 폴더>
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.color import rgb2lab, lab2rgb

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clean_sprites as cs

G = sys.argv[1]
CH = os.path.join(G, 'assets/characters')
load = lambda n: np.array(Image.open(os.path.join(CH, n + '.png')).convert('RGBA'))

HI = (244, 238, 248)
DULL_I = np.array([86, 76, 84], np.uint8)
DULL_D = np.array([46, 40, 48], np.uint8)

def hair_mask(f, kind='brown'):
    m = f[..., 3] > 0
    lab = rgb2lab((f[..., :3] / 255).astype(float))
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    if kind == 'green':      # 이안 머리(녹회색): a가 음수
        cand = m & (L > 15) & (L < 62) & (A <= -1.5) & (B < 14)
    else:
        cand = m & (L > 17) & (L < 42) & (A >= 2.3) & (B < 8)
    # 얇은 테두리(아주 어두운 선)는 따로: 머리 덩어리에 붙은 외곽선도 머리로 (색만 살짝 바꾸려고)
    lab_c, n = ndimage.label(cand, structure=np.ones((3, 3)))
    keep = np.zeros_like(cand)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab_c == i)
        if ys.min() <= 14 and len(ys) >= 6: keep |= lab_c == i
    # 머리 덩어리 안쪽의 더 어두운 결(L 9~17)도 머리로 → 밝은 머리에서 검은 줄이 남지 않게
    near = ndimage.binary_dilation(keep, iterations=1)
    dark = m & near & (L > 9) & (L <= 17) & ((A >= 1.5) if kind != 'green' else (A <= -1.0)) & (B < 10)
    edge = m & ~ndimage.binary_erosion(m)
    return keep | (dark & ~edge)

def recolor(f, mask, Lt, at, bt, k=1.0, ref=(28, 4, 2)):
    g = f.copy()
    if not mask.any(): return g
    px = g[mask][:, :3] / 255
    lab = rgb2lab(px.reshape(-1, 1, 3).astype(float)).reshape(-1, 3)
    lab2 = np.stack([np.clip(Lt + (lab[:, 0] - ref[0]) * k, 0, 100), at + (lab[:, 1] - ref[1]) * 0.5, bt + (lab[:, 2] - ref[2]) * 0.5], 1)
    g[mask, :3] = np.clip(lab2rgb(lab2.reshape(-1, 1, 3)).reshape(-1, 3) * 255, 0, 255).round().astype(np.uint8)
    return g

def frames(a):
    fh = a.shape[0] // 4
    return [[a[r*fh:(r+1)*fh, c*48:(c+1)*48].copy() for c in range(3)] for r in range(4)]

def sheet(fr):
    fh = fr[0][0].shape[0]
    out = np.zeros((fh * 4, 144, 4), np.uint8)
    for r in range(4):
        for c in range(3): out[r*fh:(r+1)*fh, c*48:(c+1)*48] = fr[r][c]
    return out

def dull_eyes(a, base_iris):
    g = a.copy()
    bi = np.array(base_iris, int); bd = (bi * 0.55).astype(int)
    rgb = g[..., :3].astype(int)
    isH = (np.abs(rgb - np.array(HI)).sum(-1) == 0) & (g[..., 3] > 0)
    isI = (np.abs(rgb - bi).sum(-1) <= 3) & (g[..., 3] > 0)
    isD = (np.abs(rgb - bd).sum(-1) <= 3) & (g[..., 3] > 0)
    g[isH | isI, :3] = DULL_I
    g[isD, :3] = DULL_D
    return g

def trim_hair(f, mask, n=1):
    """머리 바깥 가장자리를 n칸 깎아 짧고 단정한 머리로 (얼굴 옆 앞머리는 둠), 새 가장자리에 테두리."""
    g = f.copy()
    m = g[..., 3] > 0
    H = f.shape[0]
    ys = np.nonzero(m.any(1))[0]; top = ys.min()
    limit = top + int((H - 3 - top) * 0.38)        # 머리 윗부분(정수리·옆머리 위쪽)만
    for _ in range(n):
        m = g[..., 3] > 0
        edge = m & ~ndimage.binary_erosion(m, structure=[[0,1,0],[1,1,1],[0,1,0]])
        hairish = ndimage.binary_dilation(mask, iterations=1)
        cut = edge & hairish
        cut[limit:] = False
        g[cut] = 0
    return cs.outline(g)

def make(base, base_iris, Lt, at, bt, k, kind='brown', ref=(28, 4, 2), trim=0, base_dir=None):
    a = np.array(Image.open(os.path.join(base_dir or CH, base + '.png')).convert('RGBA'))
    fr = frames(a)
    out = []
    for row in fr:
        orow = []
        for f in row:
            hm = hair_mask(f, kind)
            g = recolor(f, hm, Lt, at, bt, k, ref)
            if trim: g = trim_hair(g, hm, trim)
            orow.append(g)
        out.append(orow)
    return dull_eyes(sheet(out), base_iris)

def make_combo(head, body, head_iris, Lt, at, bt, k, cut=25):
    """머리(head 시트의 cut줄 위) + 몸(body 시트의 cut줄 아래) 합성 후 머리색 변경."""
    hf = frames(load(head)); bf = frames(load(body))
    out = []
    for r in range(4):
        row = []
        for c in range(3):
            h = hf[r][c]; b = bf[r][c]
            g = recolor(h, hair_mask(h), Lt, at, bt, k)
            g[cut:] = b[cut:]
            row.append(cs.outline(g))
        out.append(row)
    return dull_eyes(sheet(out), head_iris)

def make_bob(Lt, at, bt, k, cut=27):
    hf = frames(load('hero_f')); mo = frames(load('momo'))
    out = []
    for r in range(4):
        row = []
        for c in range(3):
            h = hf[r][c]; b = mo[r][c]
            hm = hair_mask(h)
            g = recolor(h, hm, Lt, at, bt, k)
            # 턱선 아래: 머리카락은 지우고 모모의 몸(교복·다리)으로
            g[cut:] = b[cut:]
            # 단발 끝: 컷 위 2줄의 머리 가장자리 정리(바깥으로 삐친 긴 머리 줄기 제거)
            g = cs.outline(g)
            row.append(g)
        out.append(row)
    return dull_eyes(sheet(out), [108, 70, 66])

if __name__ == '__main__':
    S = {
        # 남학생1: 이안 머리 모양(안경 없는 바탕 base_ian_plain.png, tools 폴더) + 갈색
        'student_1': make('base_ian_plain', [120, 132, 80], 36, 10, 9, 0.9, kind='green', ref=(40, -4, 5), base_dir=os.path.dirname(os.path.abspath(__file__))),
        # 남학생2: 여주인공의 일자 앞머리·턱선 머리(바가지 머리) + 남주인공 몸, 밝은 갈색
        'student_2': make_combo('hero_f', 'hero_m', [108, 70, 66], 60, 8, 15, 1.35, cut=25),
        'student_4': make('hero_f', [108, 70, 66], 64, 9, 16, 1.35),
        'student_3': make_bob(21, 2, -5, 0.9),
    }
    outdir = sys.argv[2] if len(sys.argv) > 2 else CH
    os.makedirs(outdir, exist_ok=True)
    for n, a in S.items():
        Image.fromarray(a).save(os.path.join(outdir, n + '.png'))
        print(n)
