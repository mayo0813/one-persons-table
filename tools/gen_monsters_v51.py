"""참고 그림 한 장 → 추격 괴물 도트 한 장 (v5.1)
monster_shadow (DAY 3) / monster_union (DAY 6). 발끝이 아래 가운데, 엔진이 그대로 세워 그림.
평균(박스)으로 줄인 뒤 팔레트에 맞추고 살짝 선명하게, 가는 촉수가 끊기지 않게 투명 기준을 낮춤. 바깥 테두리 1칸.
사용: python3 gen_monsters_v51.py <shadow 원본> <union 원본> <출력 폴더>"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_sprites as IS

EYE_PAL = {'L': (40, 8, 14), 'W': (232, 220, 214), 'R': (170, 22, 34), 'D': (24, 4, 8)}
EYES = {'union': ['.LLL.', 'WRDRW', '.LLL.'], 'shadow': ['.LLLLL.', 'LWRDRWL', '..LLL..']}
def make(src, out, target_h, alpha_cut, sharp, k=20, outline=(18, 10, 20), eyes=(), eye='union'):
    a = np.array(Image.open(src).convert('RGBA'))
    ys, xs = np.nonzero(a[..., 3] > 40)
    oy0, ox0 = ys.min(), xs.min()
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    mask = a[..., 3] >= 128
    cen, rgb, imp = IS.palette(a, mask, k)
    f = a.shape[0] / target_h
    H, W = a.shape[:2]
    th, tw = int(round(H / f)), int(round(W / f))
    al = a[..., 3:4].astype(np.float32) / 255
    pm = np.concatenate([a[..., :3] * al, al], -1)
    ch = [np.array(Image.fromarray(pm[..., i].astype(np.float32), mode='F').resize((tw, th), Image.BOX)) for i in range(4)]
    A = ch[3]; col = np.stack(ch[:3], -1) / np.maximum(A[..., None], 1e-6)
    if sharp:
        bl = np.stack([ndimage.gaussian_filter(col[..., i], 0.8) for i in range(3)], -1)
        col = col + sharp * (col - bl)
    m = A >= alpha_cut
    from skimage.color import rgb2lab
    lab = rgb2lab((np.clip(col[m], 0, 255) / 255).reshape(-1, 1, 3)).reshape(-1, 3)
    idx = ((lab[:, None] - cen[None]) ** 2).sum(-1).argmin(1)
    o = np.zeros((th + 2, tw + 2, 4), np.uint8)
    sub = o[1:-1, 1:-1]; sub[m, :3] = rgb[idx]; sub[m, 3] = 255
    # 외톨이 점 지우기
    solid = o[..., 3] > 0
    nb = ndimage.convolve(solid.astype(int), np.ones((3, 3)), mode='constant') - solid
    o[solid & (nb == 0)] = 0
    pat = EYES[eye]
    for ex, ey in eyes:   # 눈은 줄이면 뭉개지므로 원래 자리에 또렷하게 다시 찍음
        cx = int(round((ex - ox0) / f)) + 1; cy = int(round((ey - oy0) / f)) + 1
        h, w = len(pat), len(pat[0])
        for yy, row in enumerate(pat):
            for xx, chh in enumerate(row):
                if chh in EYE_PAL:
                    Y, X = cy - h // 2 + yy, cx - w // 2 + xx
                    if 0 <= Y < o.shape[0] and 0 <= X < o.shape[1]: o[Y, X, :3] = EYE_PAL[chh]; o[Y, X, 3] = 255
    if outline:
        solid = o[..., 3] > 0
        ring = ndimage.binary_dilation(solid, structure=np.array([[0,1,0],[1,1,1],[0,1,0]])) & ~solid
        o[ring, :3] = outline; o[ring, 3] = 255
    Image.fromarray(o).save(out)
    print(out, o.shape[1], 'x', o.shape[0], 'scale %.1f' % f)

if __name__ == '__main__':
    s, u, d = sys.argv[1:4]
    make(s, os.path.join(d, 'monster_shadow.png'), 84, 0.3, 0.6, outline=None, eyes=[(586, 1071)], eye='shadow')
    make(u, os.path.join(d, 'monster_union.png'), 104, 0.4, 0.7, eyes=[(460, 268), (697, 375), (590, 483), (468, 700)])
