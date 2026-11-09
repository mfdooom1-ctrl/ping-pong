"""Original hand-built pixel sprites and glyphs. No downloaded artwork or fonts.
Run with Python + Pillow + fontTools only when changing source artwork.
The generated files are tracked; npm builds do not require Python.
"""
from PIL import Image, ImageDraw
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from pathlib import Path
import json, math, random

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
PALETTES = [
 ('#f33966','#f1b282','#a16b33'),('#e5e1cb','#dba17d','#2b2232'),
 ('#dc3f5e','#d3a17f','#241d34'),('#57c998','#edb595','#24203b'),
 ('#db5695','#dab18e','#1d2039'),('#8d74cd','#d7af99','#141a2d'),
 ('#c75b32','#cc9b80','#513142'),('#e2ba47','#efbb93','#793a46'),
 ('#d6a643','#e4ae84','#734634'),('#25b99e','#b97f61','#2b203d'),
 ('#4c76b8','#debba3','#755c47'),('#bc52ba','#925d47','#221b30'),
 ('#df5e4a','#d99b77','#49283d'),('#34a8dd','#e3b994','#211d37')]
IDS=['johnny','tony','chen','lin','kenji','akira','dragan','mila','jack','rico','viktor','marcus','sofia','kim']
STATES=['idle','move','windup','forehand','backhand','block','miss','victory','defeat']

def character(index, state, frame, size=1):
 im=Image.new('RGBA',(40,56));d=ImageDraw.Draw(im)
 shirt,skin,hair=PALETTES[index];outline='#16152d';light='#ffe1ae';shadow='#a96661'
 bob=1 if state=='move' and frame%2 else 0
 lean=(frame-1) if state in ['forehand','backhand','windup'] else 0
 if state=='backhand':lean=-lean
 if state=='defeat':bob=3
 def r(box,c):
  x1,y1,x2,y2=box;d.rectangle((x1+lean,y1+bob,x2+lean,y2+bob),fill=c)
 # Shoes, striped socks, muscular legs, shorts.
 stride=(frame%3-1)*2 if state=='move' else 0
 d.rectangle((10+stride,48,17+stride,53),fill=outline);d.rectangle((23-stride,48,30-stride,53),fill=outline)
 d.rectangle((11+stride,49,16+stride,51),fill='#f5e4db');d.rectangle((24-stride,49,29-stride,51),fill='#f5e4db')
 r((12+stride,38,17+stride,48),skin);r((23-stride,38,28-stride,48),skin)
 r((12+stride,44,17+stride,47),'#f6e9d9');r((23-stride,44,28-stride,47),'#f6e9d9')
 r((11,33,29,40),'#192e50');r((11,35,13,39),'#4f91a9');r((19,37,21,41),outline)
 # Long hair behind the head.
 if index in [0,1,7,12]:r((10,9,29,26),hair)
 r((8,23,31,35),outline);r((10,24,29,34),shirt);r((12,22,27,27),shirt)
 if index==0:
  r((9,24,13,31),'#244c85');r((27,24,31,31),'#244c85');r((11,28,29,31),'#ffefd5')
  for x in [15,20,25]:r((x,29,x+1,30),'#c53052')
 elif index==1:
  for y in range(25,35,3):r((11,y,29,y),'#687f86')
  r((17,23,19,25),'#f6f0da');r((22,23,24,25),'#f6f0da');r((20,25,21,28),'#394a5d')
 else:
  r((11,25,13,34),'#f4dcba');r((14,25,15,34),'#f4dcba')
 # Hair silhouette and face planes, large mustaches on both heroes.
 r((12,6,27,20),outline);r((14,8,26,21),skin);r((14,10,16,18),light);r((24,11,26,20),shadow)
 r((11,6,28,10),hair);r((13,4,25,7),hair);r((11,9,13,19),hair);r((27,9,28,18),hair)
 if index==0:
  r((11,8,29,11),'#fff4d4');r((12,9,27,10),'#ffffff');r((12,4,23,5),'#d89f4a');r((10,13,12,24),hair);r((27,13,30,23),hair)
 elif index==1:
  for x,y in [(11,6),(15,3),(20,4),(24,3),(28,6),(10,10),(27,11),(29,18)]:r((x,y,x+3,y+3),hair);r((x,y,x+1,y),'#54404e')
 elif index in [3,7,12]:r((26,16,30,27),hair)
 r((16,13,18,13),outline);r((23,13,25,13),outline);r((17,14,18,14),'#fff6d7');r((23,14,24,14),'#fff6d7')
 r((20,14,21,17),shadow);r((20,14,20,16),light)
 if index not in [3,7,12]:
  r((17,17,24,18),hair);r((15,18,18,20),hair);r((23,18,26,20),hair)
 r((19,20,23,20),'#853e48')
 if state=='victory':r((18,20,24,21),'#fff3d5')
 if state in ['miss','defeat']:r((19,20,22,21),outline)
 # Separate paddle arm poses make all nine animations legible.
 if state=='victory':
  r((5,16,10,26),skin);r((4,11,8,17),skin);r((30,14,34,26),skin);px,py=33,8
 elif state=='defeat':r((7,28,10,39),skin);r((30,28,33,39),skin);px,py=34,39
 elif state=='backhand':r((7,27,15,30),skin);r((12,25,26,28),skin);px,py=6-frame,25
 elif state=='forehand':r((28,25,33,30),skin);r((31,25-frame,36,28),skin);px,py=36,20-frame*2
 elif state=='windup':r((30,21,34,29),skin);px,py=33,16-frame
 elif state=='block':r((11,27,15,32),skin);r((13,29,28,32),skin);px,py=27,26
 else:r((7,26,11,33),skin);r((9,31,16,34),skin);r((29,26,33,34),skin);px,py=33,31
 d.rectangle((px-1+lean,py+4+bob,px+1+lean,py+10+bob),fill='#e8b476')
 d.ellipse((px-4+lean,py-3+bob,px+4+lean,py+6+bob),fill=outline)
 d.ellipse((px-3+lean,py-2+bob,px+3+lean,py+5+bob),fill='#fc4568' if index%2==0 else '#4fd8e0')
 d.rectangle((px-2+lean,py-1+bob,px+lean,py+1+bob),fill='#ffb588' if index%2==0 else '#bcfff3')
 return im

atlas=Image.new('RGBA',(40*12,56*42));frames={};n=0
for i,name in enumerate(IDS):
 for state in STATES:
  for frame in range(4):
   x=n%12*40;y=n//12*56;atlas.alpha_composite(character(i,state,frame),(x,y))
   frames[f'{name}-{state}-{frame}']={'frame':{'x':x,'y':y,'w':40,'h':56},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':40,'h':56},'sourceSize':{'w':40,'h':56}}
   n+=1
atlas.save(OUT/'characters.png')
(OUT/'characters.json').write_text(json.dumps({'frames':frames,'meta':{'image':'characters.png','size':{'w':480,'h':2352},'scale':'1'}}))

# Detailed, original pixel portraits for the character-select and title screen.
for i,name in enumerate(IDS):
 im=Image.new('RGBA',(112,144));d=ImageDraw.Draw(im);shirt,skin,hair=PALETTES[i]
 d.polygon([(8,143),(15,94),(37,82),(77,82),(102,98),(111,143)],fill='#11172e')
 d.polygon([(12,143),(18,98),(40,87),(72,87),(97,100),(106,143)],fill=shirt)
 d.rectangle((43,74,69,97),fill=skin);d.rectangle((43,80,69,86),fill='#b57664')
 d.polygon([(31,25),(43,10),(70,10),(85,29),(86,83),(76,99),(71,70),(35,78),(23,96),(22,62)],fill=hair)
 d.polygon([(31,32),(41,20),(72,22),(82,36),(79,69),(66,85),(49,84),(32,66)],fill=skin)
 d.polygon([(31,32),(37,28),(37,58),(44,72),(51,79),(48,81),(33,67)],fill='#ffc99a')
 d.polygon([(73,32),(81,36),(77,70),(65,81),(65,74),(73,60)],fill='#b87a69')
 for x,y in [(30,24),(35,13),(44,9),(57,8),(68,13),(77,20)]:
  d.rectangle((x,y,x+12,y+12),fill=hair)
  d.rectangle((x+2,y,x+8,y+2),fill='#c18a43' if i==0 else '#51404c')
 if i==0:
  d.polygon([(26,27),(81,23),(84,35),(27,40)],fill='#fff0d2');d.line([(29,29),(80,26)],fill='#ffffff',width=3)
  for y in range(46,89,9):
   d.line([(27,y),(23,y+10),(30,y+16)],fill='#cc9849',width=3);d.line([(82,y-3),(88,y+9),(82,y+16)],fill='#a7773e',width=3)
 elif i==1:
  for x,y in [(24,24),(30,12),(42,4),(56,3),(69,7),(79,17),(82,29),(25,40),(80,46),(84,62),(78,79)]:
   d.ellipse((x,y,x+15,y+14),fill=hair);d.line([(x+2,y+4),(x+4,y+1),(x+9,y+1)],fill='#564352',width=2)
 for x in [38,62]:
  d.rectangle((x,45,x+13,48),fill=hair);d.rectangle((x+2,50,x+11,52),fill='#fff4d3');d.rectangle((x+6,49,x+9,53),fill='#252335')
 d.polygon([(55,48),(53,63),(61,64),(62,60),(58,58)],fill='#bc806b')
 if i not in [3,7,12]:
  d.polygon([(55,64),(62,64),(66,66),(73,69),(74,75),(66,73),(59,70),(52,71),(44,76),(39,75),(41,69),(49,65)],fill=hair)
  d.line([(43,70),(51,67),(59,67)],fill='#cc9857' if i==0 else '#725645',width=1)
 d.rectangle((51,75,64,77),fill='#8f4c51');d.rectangle((52,75,61,75),fill='#f7dcc0')
 if i==0:
  d.polygon([(20,99),(38,91),(44,143),(12,143)],fill='#233d74');d.polygon([(75,91),(96,99),(107,143),(70,143)],fill='#233d74')
  d.rectangle((27,114,90,135),fill='#f4e4cd')
  # Tiny custom pixel lettering, no third-party marks.
  d.text((42,117),'USA',fill='#b73154',stroke_width=0)
 elif i==1:
  for y in range(99,143,9):d.rectangle((20,y,98,y+2),fill='#637d87');d.rectangle((22,y+4,98,y+4),fill='#29495c')
  d.polygon([(40,89),(54,94),(48,105),(36,94)],fill='#fff3db');d.polygon([(68,89),(56,94),(63,105),(76,95)],fill='#fff3db')
 else:
  d.rectangle((22,100,27,143),fill='#fff1ce');d.rectangle((30,96,32,143),fill='#fff1ce')
 # Forearm and foreshortened paddle, matching the reference's confident pose.
 d.polygon([(16,126),(24,118),(47,127),(66,124),(72,135),(48,142),(26,137)],fill=skin)
 d.rectangle((48,127,53,139),fill='#e4e8d6');d.rectangle((50,128,52,139),fill='#35c7dc' if i%2 else '#e43e64')
 d.line([(67,128),(85,105)],fill='#ecbd80',width=6)
 d.ellipse((70,74,103,115),fill='#111a32');d.ellipse((73,77,100,112),fill='#dd345e' if i%2==0 else '#205b7d')
 d.arc((74,78,100,112),190,290,fill='#ff9f87' if i%2==0 else '#78eff1',width=2)
 im.save(OUT/f'portrait-{name}.png')

# 5x7 handmade Latin alphabet. All UI assets are local, with a readable system fallback.
glyphs={
'A':['01110','10001','10001','11111','10001','10001','10001'],'B':['11110','10001','10001','11110','10001','10001','11110'],'C':['01111','10000','10000','10000','10000','10000','01111'],'D':['11110','10001','10001','10001','10001','10001','11110'],'E':['11111','10000','10000','11110','10000','10000','11111'],'F':['11111','10000','10000','11110','10000','10000','10000'],'G':['01111','10000','10000','10111','10001','10001','01111'],'H':['10001','10001','10001','11111','10001','10001','10001'],'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00010','00010','00010','10010','10010','01100'],'K':['10001','10010','10100','11000','10100','10010','10001'],'L':['10000','10000','10000','10000','10000','10000','11111'],'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['10001','11001','10101','10011','10001','10001','10001'],'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],'Q':['01110','10001','10001','10001','10101','10010','01101'],'R':['11110','10001','10001','11110','10100','10010','10001'],'S':['01111','10000','10000','01110','00001','00001','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],'U':['10001','10001','10001','10001','10001','10001','01110'],'V':['10001','10001','10001','10001','10001','01010','00100'],'W':['10001','10001','10001','10101','10101','10101','01010'],'X':['10001','10001','01010','00100','01010','10001','10001'],'Y':['10001','10001','01010','00100','00100','00100','00100'],'Z':['11111','00001','00010','00100','01000','10000','11111'],
'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
'-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],':':['00000','00110','00110','00000','00110','00110','00000'],'/':['00001','00010','00010','00100','01000','01000','10000'],'!':['00100','00100','00100','00100','00100','00000','00100'],'?':['01110','10001','00001','00010','00100','00000','00100'],'+':['00000','00100','00100','11111','00100','00100','00000'],"'":['00100','00100','00000','00000','00000','00000','00000'],'<':['00010','00100','01000','10000','01000','00100','00010'],'>':['01000','00100','00010','00001','00010','00100','01000'],'(':['00010','00100','01000','01000','01000','00100','00010'],')':['01000','00100','00010','00010','00010','00100','01000'],' ':['00000']*7,
}
for c in list(glyphs):
 if c.isalpha():glyphs[c.lower()]=glyphs[c]
order=['.notdef']+[f'u{ord(c):04X}' for c in glyphs];fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(order);fb.setupCharacterMap({ord(c):f'u{ord(c):04X}' for c in glyphs})
tt={};metrics={}
for name in order:
 pen=TTGlyphPen(None);char=next((c for c in glyphs if name==f'u{ord(c):04X}'),'?')
 for y,row in enumerate(glyphs[char]):
  for x,p in enumerate(row):
   if p=='1':
    xx=x*120;yy=(6-y)*120;pen.moveTo((xx,yy));pen.lineTo((xx,yy+120));pen.lineTo((xx+120,yy+120));pen.lineTo((xx+120,yy));pen.closePath()
 tt[name]=pen.glyph();metrics[name]=(720,0)
fb.setupGlyf(tt);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=900,descent=-160);fb.setupNameTable({'familyName':'Spin City Neon','styleName':'Regular','uniqueFontIdentifier':'SpinCityNeon1','fullName':'Spin City Neon','psName':'SpinCityNeon'});fb.setupOS2(sTypoAscender=900,sTypoDescender=-160,usWinAscent=900,usWinDescent=160);fb.setupPost();fb.save(OUT/'neon.ttf')

for size,name in [(192,'icon-192'),(512,'icon-512'),(180,'apple-touch-icon'),(512,'maskable-512')]:
 im=Image.new('RGB',(64,64),'#100d26');d=ImageDraw.Draw(im)
 d.rectangle((6,6,57,57),outline='#3de7df',width=2);d.rectangle((9,9,54,54),outline='#693566')
 d.line([(21,45),(36,25)],fill='#ffd680',width=6);d.ellipse((11,12,40,40),fill='#ff477f');d.ellipse((14,14,36,36),fill='#d22c66');d.arc((14,14,37,37),180,265,fill='#ffb89c',width=2)
 d.line([(30,46),(44,29)],fill='#ffd680',width=5);d.ellipse((29,21,52,43),fill='#42dbe4');d.ellipse((32,24,49,40),fill='#227ca8');d.ellipse((41,10,49,18),fill='#fff4cc')
 im.resize((size,size),Image.Resampling.NEAREST).save(OUT/f'{name}.png')
print('Created 504 animation frames, 14 portraits, original pixel font and PWA icons.')
