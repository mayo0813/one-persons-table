"""지하 예배당 소품 (48×48, 24×24를 2배) — 타일셋·아이콘과 같은 색. 기록함(닫힘/열림), 금속 식판.
사용: python3 gen_deco_v52.py <assets/icons 폴더>"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
K=(12,10,14); K2=(28,24,32); P1=(36,31,42); P2=(53,46,61); P3=(68,59,79); P4=(95,83,111); L1=(176,166,189); L2=(206,196,219)
PD=(222,208,178); PC=(129,115,86); R1=(97,25,39); R2=(140,36,50); G1=(201,168,92); G0=(129,105,60)
def fin(im, shadow=True):
    a=np.array(im); solid=a[...,3]>0
    ring=ndimage.binary_dilation(solid,structure=np.array([[0,1,0],[1,1,1],[0,1,0]],bool))&~solid
    a[ring]=(*K,255)
    out=Image.fromarray(a).resize((48,48),Image.NEAREST)
    return out
def box(opened):
    im=Image.new('RGBA',(24,24),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([3,19,20,22],fill=(0,0,0,90))
    d.rectangle([4,9,19,20],fill=P2); d.rectangle([4,9,19,10],fill=P4); d.rectangle([4,19,19,20],fill=P1)
    for x in (4,19): d.line([(x,9),(x,20)],fill=P1)
    d.line([(8,11),(8,19)],fill=P1); d.line([(15,11),(15,19)],fill=P1)       # 띠
    for p in [(8,12),(8,17),(15,12),(15,17)]: d.point(p,fill=L1)              # 리벳
    if opened:
        d.polygon([(4,8),(19,8),(18,3),(5,3)],fill=P3); d.line([(5,3),(18,3)],fill=P4)
        d.rectangle([5,9,18,11],fill=K)                                         # 빈 안쪽
        d.point((11,6),fill=G0); d.point((12,6),fill=G0)
    else:
        d.rectangle([4,6,19,8],fill=P3); d.line([(4,6),(19,6)],fill=P4)
        d.rectangle([10,10,13,14],fill=G1); d.point((11,12),fill=K); d.point((12,12),fill=K); d.line([(10,14),(13,14)],fill=G0)   # 자물쇠
        d.line([(9,15),(14,15)],fill=R2)                                        # 봉인 끈
    d.rectangle([2,12,3,15],fill=L1); d.rectangle([20,12,21,15],fill=L1)       # 양쪽 손잡이
    return fin(im)
def tray():
    im=Image.new('RGBA',(24,24),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([4,17,20,20],fill=(0,0,0,80))
    d.rectangle([4,11,19,18],fill=L1); d.line([(4,11),(19,11)],fill=L2); d.line([(4,18),(19,18)],fill=P4)
    d.rectangle([6,13,10,16],fill=P4); d.rectangle([12,13,17,14],fill=P4); d.rectangle([12,16,14,16],fill=P4); d.rectangle([16,16,17,16],fill=P4)
    d.point((7,13),fill=P3); d.point((13,13),fill=P3)
    d.point((9,15),fill=R1)                                                     # 말라붙은 자국
    return fin(im)
if __name__=='__main__':
    o=sys.argv[1]
    box(False).save(os.path.join(o,'deco_record_box.png')); box(True).save(os.path.join(o,'deco_record_box_open.png')); tray().save(os.path.join(o,'deco_tray.png'))
