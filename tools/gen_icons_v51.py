"""아이템 아이콘 15종 (32×32) — 타일셋과 같은 색(보라·검정·진홍·양피지·금 포인트)으로 그림.
아이템답게: 검은 테두리 바깥에 연보라 빛 테 1~2칸, 금색 반짝이 하나.
사용: python3 gen_icons_v51.py <출력 폴더>"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
K=(12,10,14); K2=(28,24,32)
P1=(36,31,42); P2=(53,46,61); P3=(68,59,79); P4=(95,83,111); L1=(176,166,189); L2=(206,196,219); W=(232,226,238)
PA=(195,178,145); PB=(160,144,112); PC=(129,115,86); PD=(222,208,178)
R1=(97,25,39); R2=(140,36,50); R3=(178,58,66)
G1=(201,168,92); G2=(236,212,140); G0=(129,105,60)

def new(): 
    im=Image.new('RGBA',(32,32),(0,0,0,0)); return im, ImageDraw.Draw(im)
def px(d,pts,c):
    for x,y in pts: d.point((x,y),fill=c)
def hl(d,x0,x1,y,c): d.line([(x0,y),(x1,y)],fill=c)
def vl(d,x,y0,y1,c): d.line([(x,y0),(x,y1)],fill=c)

def finish(im, spark=(25,6)):
    a=np.array(im); solid=a[...,3]>0
    cross=np.array([[0,1,0],[1,1,1],[0,1,0]],bool)
    o1=ndimage.binary_dilation(solid,structure=cross)&~solid
    a[o1]=(*K,255)
    s2=solid|o1
    g1=ndimage.binary_dilation(s2,structure=cross)&~s2
    a[g1]=(190,170,225,150)
    s3=s2|g1
    g2=ndimage.binary_dilation(s3,structure=np.ones((3,3),bool))&~s3
    a[g2]=(170,150,215,60)
    if False and spark:   # 금색 반짝이는 뺌 (v5.1)
        x,y=spark
        for dx,dy,c in [(0,0,(255,246,214,255)),(1,0,(*G2,255)),(-1,0,(*G2,255)),(0,1,(*G2,255)),(0,-1,(*G2,255)),(2,0,(*G1,170)),(-2,0,(*G1,170)),(0,2,(*G1,170)),(0,-2,(*G1,170))]:
            if 0<=x+dx<32 and 0<=y+dy<32: a[y+dy,x+dx]=c
    return Image.fromarray(a)

def i_map():
    im,d=new()
    d.polygon([(5,9),(11,7),(11,25),(5,27)],fill=PA); d.polygon([(12,7),(19,9),(19,27),(12,25)],fill=PD); d.polygon([(20,9),(26,7),(26,25),(20,27)],fill=PA)
    vl(d,11,7,25,PC); vl(d,19,9,27,PC); vl(d,12,7,25,PB); vl(d,20,9,27,PB)
    d.rectangle([7,12,9,15],fill=P3); d.rectangle([14,12,17,14],fill=P3); d.rectangle([22,18,24,21],fill=P3)
    px(d,[(8,18),(9,19),(10,20),(13,21),(14,21),(16,20),(17,19)],R2)
    px(d,[(21,12),(23,14),(22,13),(23,12),(21,14)],R3)
    hl(d,6,9,23,PC); hl(d,14,17,17,PC)
    return finish(im,(25,5))
def i_ticket():
    im,d=new()
    def tk(x,y,c,c2):
        d.rectangle([x,y,x+17,y+9],fill=c); px(d,[(x,y+4),(x,y+5),(x+17,y+4),(x+17,y+5)],(0,0,0,0))
        for yy in range(y+1,y+9,2): d.point((x+12,yy),fill=c2)
        hl(d,x+2,x+9,y+2,c2); hl(d,x+2,x+7,y+4,c2); hl(d,x+2,x+9,y+7,R2)
        d.rectangle([x+14,y+3,x+15,y+6],fill=R2)
    tk(9,7,PB,PC); tk(5,15,PD,PC)
    return finish(im,(26,5))
def i_doctrine():
    im,d=new()
    d.rectangle([7,5,24,26],fill=P2); d.rectangle([7,5,9,26],fill=P1); d.rectangle([10,6,23,25],fill=P3)
    hl(d,10,24,27,PD); hl(d,10,24,26,L1)
    d.rectangle([11,7,22,24],outline=G0)
    vl(d,16,10,20,G1); vl(d,17,10,20,G2); hl(d,13,20,13,G1); hl(d,13,20,14,G2)
    px(d,[(11,7),(22,7),(11,24),(22,24)],G2)
    d.rectangle([20,26,21,29],fill=R2); px(d,[(20,29)],(0,0,0,0))
    return finish(im,(25,4))
def i_ribbon():
    im,d=new()
    d.polygon([(5,8),(14,13),(14,17),(5,22),(4,15)],fill=R2); d.polygon([(27,8),(18,13),(18,17),(27,22),(28,15)],fill=R2)
    d.polygon([(6,10),(13,14),(7,13)],fill=R3); d.polygon([(26,10),(19,14),(25,13)],fill=R3)
    d.polygon([(5,18),(13,16),(6,21)],fill=R1); d.polygon([(27,18),(19,16),(26,21)],fill=R1)
    d.polygon([(14,17),(10,27),(13,26),(15,28),(16,18)],fill=R1); d.polygon([(18,17),(22,27),(19,26),(17,28),(16,18)],fill=R2)
    d.rectangle([14,12,18,18],fill=R3); vl(d,14,13,17,R1); vl(d,18,13,17,R1); px(d,[(16,13),(16,14)],(214,110,112))
    px(d,[(11,28),(21,28),(15,29)],R1)
    return finish(im,(24,5))
def i_torn():
    im,d=new()
    d.polygon([(7,5),(22,5),(24,8),(21,10),(24,13),(22,16),(25,19),(21,21),(23,24),(19,26),(16,24),(13,27),(10,25),(7,26)],fill=PD)
    px(d,[(22,6),(22,10),(23,13),(22,17),(23,19),(21,22),(20,25),(16,25),(13,26),(10,26)],PC)
    for y,x1 in [(8,19),(11,18),(14,20),(17,17)]: hl(d,9,x1,y,PC)
    hl(d,9,18,20,R2); hl(d,9,13,22,PC)
    vl(d,7,5,26,PB)
    return finish(im,(26,5))
def i_attend():
    im,d=new()
    d.rectangle([6,5,25,27],fill=K2); d.rectangle([6,5,8,27],fill=P1); d.rectangle([9,6,24,26],fill=P1)
    d.rectangle([11,8,22,12],fill=PD); hl(d,13,20,10,PC)
    for y in (15,18,21,24):
        hl(d,11,18,y,P4); px(d,[(21,y)],R3); px(d,[(20,y+1),(22,y-1)],R2)
    px(d,[(7,8),(7,16),(7,24)],G1)
    return finish(im,(26,4))
def i_plate():
    im,d=new()
    d.ellipse([3,10,24,24],fill=L1); d.ellipse([4,10,23,22],fill=W); d.ellipse([8,13,19,20],fill=L2); d.ellipse([9,13,18,19],fill=(240,236,244))
    px(d,[(7,13),(6,14),(8,12)],(255,255,255))
    d.ellipse([24,7,28,13],fill=L1); px(d,[(25,8),(25,9)],W); vl(d,26,13,26,L1); vl(d,27,14,26,P4)
    px(d,[(12,17),(13,18),(15,16)],R1)
    return finish(im,(21,6))
def i_oldletter():
    im,d=new()
    d.rectangle([4,9,27,24],fill=PA); d.polygon([(4,9),(27,9),(16,18)],fill=PD)
    d.line([(4,9),(15,18)],fill=PC); d.line([(27,9),(16,18)],fill=PC); d.line([(4,24),(11,17)],fill=PB); d.line([(27,24),(20,17)],fill=PB)
    d.ellipse([13,15,18,20],fill=R2); px(d,[(14,16),(15,16)],R3); px(d,[(15,18),(16,18),(16,17)],R1)
    px(d,[(6,22),(8,23),(24,11),(25,22)],PC)
    return finish(im,(26,6))
def i_ritual():
    im,d=new()
    d.rectangle([7,5,24,27],fill=R1); d.rectangle([7,5,9,27],fill=(64,16,26)); d.rectangle([10,6,23,26],fill=R2)
    d.ellipse([12,10,21,19],outline=G1); d.ellipse([14,12,19,17],outline=G0); px(d,[(16,14),(17,15),(16,15),(17,14)],G2)
    px(d,[(16,8),(17,8),(16,21),(17,21),(11,14),(22,15)],G2)
    d.rectangle([7,22,24,23],fill=K2); d.rectangle([15,21,18,24],fill=G1); px(d,[(16,22),(17,23)],G0)
    hl(d,10,24,28,PD)
    return finish(im,(25,4))
def i_lunch():
    im,d=new()
    d.rectangle([5,14,26,26],fill=P2); d.rectangle([5,14,26,16],fill=P4); d.rectangle([5,24,26,26],fill=P1)
    hl(d,5,26,20,P1); hl(d,5,26,21,G0)
    d.polygon([(11,14),(16,10),(21,14),(21,26),(11,26)],fill=R2); d.polygon([(11,14),(16,10),(16,14)],fill=R3)
    d.polygon([(13,11),(8,6),(11,5),(16,10)],fill=R2); d.polygon([(19,11),(24,6),(21,5),(16,10)],fill=R1)
    d.rectangle([15,9,17,12],fill=R3); vl(d,11,15,26,R1); vl(d,21,15,26,R1)
    px(d,[(7,18),(24,18)],G1)
    return finish(im,(27,9))
def i_notes():
    im,d=new()
    d.polygon([(12,5),(26,8),(24,20),(10,17)],fill=PB)
    d.polygon([(5,10),(20,8),(22,22),(7,24)],fill=PA)
    d.rectangle([8,12,23,27],fill=PD); px(d,[(23,27),(22,27),(23,26)],(0,0,0,0)); px(d,[(21,26),(22,25)],PC)
    hl(d,10,20,15,PC); hl(d,10,18,18,PC); hl(d,10,16,21,PC)
    px(d,[(17,23),(18,23),(20,23),(21,23),(17,24),(18,24),(19,24),(20,24),(21,24),(18,25),(19,25),(20,25),(19,26)],R3); px(d,[(17,23)],(220,120,124))
    d.rectangle([13,11,17,12],fill=R1)
    return finish(im,(26,5))
def i_pieces():
    im,d=new()
    def scrap(pts,c):
        d.polygon(pts,fill=c)
    scrap([(14,4),(26,6),(25,17),(22,15),(19,18),(15,16),(13,17)],PB)
    for y in (8,11,14): hl(d,16,23,y,PC)
    scrap([(4,9),(15,7),(17,19),(13,18),(11,21),(8,19),(5,21)],PD)
    for y in (11,14,17): hl(d,7,14,y,P4)
    px(d,[(5,11),(5,14),(5,17)],K2)
    scrap([(10,20),(24,19),(25,28),(21,26),(17,28),(13,26),(10,28)],PA)
    for y in (22,25): hl(d,12,22,y,PC)
    hl(d,12,17,22,R2)
    return finish(im,(27,22))
def i_notebook():
    im,d=new()
    d.rectangle([6,6,21,27],fill=P3); d.rectangle([6,6,8,27],fill=P1); d.rectangle([9,7,20,26],fill=P4)
    hl(d,9,21,28,PD); vl(d,22,8,27,PD)
    d.rectangle([11,10,18,14],fill=PD); hl(d,12,17,12,PC)
    vl(d,17,6,27,R2)
    px(d,[(7,9),(7,13),(7,17),(7,21),(7,25)],L1)
    d.line([(26,6),(24,24)],fill=K2); d.line([(27,6),(25,24)],fill=L1); px(d,[(24,25),(24,26)],G1); px(d,[(26,5),(27,5)],G2)
    return finish(im,(13,21))
def i_zero():
    im,d=new()
    d.rectangle([6,7,25,24],fill=PB); d.rectangle([6,5,25,8],fill=PA); d.rectangle([6,23,25,26],fill=PA)
    hl(d,6,25,5,PD); hl(d,6,25,26,PC); hl(d,6,25,8,PC); hl(d,6,25,23,PD)
    d.rectangle([4,4,6,9],fill=PC); d.rectangle([25,4,27,9],fill=PC); d.rectangle([4,22,6,27],fill=PC); d.rectangle([25,22,27,27],fill=PC)
    for y,x1 in [(11,22),(13,20),(19,21)]: hl(d,9,x1,y,PC)
    hl(d,9,17,15,R2); hl(d,9,19,17,R2)
    d.ellipse([19,15,24,21],outline=R2); px(d,[(21,18),(22,18)],R3)
    px(d,[(8,21),(23,10),(12,20)],(110,96,72))
    return finish(im,(27,13))

ICONS={'map':i_map,'ticket':i_ticket,'doctrine':i_doctrine,'ribbon':i_ribbon,'hairtie':i_ribbon,'torn_letter':i_torn,'attendance':i_attend,'empty_plate':i_plate,
 'old_letter':i_oldletter,'ritual_record':i_ritual,'lunchbox':i_lunch,'yuri_notes':i_notes,'ian_pieces':i_pieces,'ian_notebook':i_notebook,'zero_report':i_zero}
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    for n,f in ICONS.items(): f().save(os.path.join(out,'icon_'+n+'.png'))
    names=[n for n in ICONS if n!='hairtie']
    s=Image.new('RGBA',(len(names)//2*40+40,84),(30,25,36,255))
    for i,n in enumerate(names): s.alpha_composite(Image.open(os.path.join(out,'icon_'+n+'.png')),((i%7)*40+4,(i//7)*40+4))
    s.resize((s.width*5,s.height*5),Image.NEAREST).save(os.path.join(out,'_preview.png'))
