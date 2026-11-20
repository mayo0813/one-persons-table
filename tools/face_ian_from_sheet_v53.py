import numpy as np
from PIL import Image
from scipy import ndimage
src=np.array(Image.open('/mnt/user-data/uploads/d5d2493d-image.png').convert('RGBA')).astype(int)
H,W=src.shape[:2]; cw=W/4; ch=441
sheet=Image.new('RGBA',(576,288),(0,0,0,0)); dbg=[]
for i in range(4):
    x0=int(round(i*cw))+3; x1=int(round((i+1)*cw))-3
    c=src[2:ch, x0:x1].copy(); g=c[...,:3]
    chroma=g.max(-1)-g.min(-1); lum=g.mean(-1)
    cand=(chroma<=12)&(lum>=110)
    lab,n=ndimage.label(cand)
    seeds=set(np.unique(np.concatenate([lab[0],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(seeds))
    # 머리카락 사이에 갇힌 배경 조각
    sizes=ndimage.sum(cand,lab,range(1,n+1))
    for k,s in enumerate(sizes,1):
        if k in seeds or s<120: continue
        ys,xs=np.nonzero(lab==k)
        if ys.mean()<300 and lum[lab==k].mean()>150: bg|=lab==k
    # 가장자리 번짐: 배경과 닿은 밝고 무채색에 가까운 1~2px
    for _ in range(2):
        ring=ndimage.binary_dilation(bg)&~bg&(chroma<=18)&(lum>=100)
        bg|=ring
    alpha=np.where(bg,0,255).astype(np.uint8)
    # 바깥 테두리 한 줄은 살짝 부드럽게
    edge=ndimage.binary_dilation(bg)&~bg
    alpha[edge]=200
    out=np.dstack([c[...,:3].astype(np.uint8),alpha])
    hh,ww=out.shape[:2]; S=min(hh,ww); ox=(ww-S)//2
    sq=out[hh-S:hh, ox:ox+S]
    im=Image.fromarray(sq)
    # 미리 곱한 알파로 줄여서 흰 테두리가 남지 않게
    f=np.array(im).astype(np.float32); f[...,:3]*=f[...,3:]/255
    chans=[Image.fromarray(f[...,k]).resize((144,144),Image.LANCZOS) for k in range(4)]
    A=np.clip(np.array(chans[3]),0,255); rgb=np.stack([np.array(chans[k]) for k in range(3)],-1)/np.maximum(A[...,None]/255,1e-3)
    o=np.dstack([np.clip(rgb,0,255),A]).astype(np.uint8); o[A<8]=0
    sheet.alpha_composite(Image.fromarray(o),(i*144,0))
    dbg.append(Image.fromarray(sq))
sheet.save('face_ian.png')
for bgc,name in [((40,34,46),'prev_dark.png'),((255,0,255),'prev_mag.png')]:
    c=Image.new('RGBA',(576,144),bgc+(255,)); c.alpha_composite(sheet.crop((0,0,576,144))); c.resize((1152,288),Image.LANCZOS).save(name)
d=Image.new('RGBA',(sum(x.width for x in dbg),dbg[0].height),(255,0,255,255)); xx=0
for x in dbg: d.alpha_composite(x,(xx,0)); xx+=x.width
d.resize((d.width//2,d.height//2)).save('prev_full_mag.png')
