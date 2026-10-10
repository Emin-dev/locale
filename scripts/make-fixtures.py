"""Original synthetic UI capture fixtures. No real app or personal data."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1]/'web'
a=root/'fixtures';a.mkdir(exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def f(n,b=False):return ImageFont.truetype(bold if b else font,n)
locales={'en-US':['Find your slower day.','Beautiful stays, closer to nature.','Where would you like to go?','Discover stays','A cabin of your own','Forest hideaway','No stays found','Try another place or date.','Your stay is confirmed','A little escape awaits.'], 'de-DE':['Zeit für eine Pause.','Besondere Orte in der Natur.','Wohin möchtest du reisen?','Unterkünfte entdecken','Deine eigene Hütte','Waldversteck','Keine Ergebnisse','Versuche einen anderen Ort.','Dein Aufenthalt ist gebucht','Deine kleine Auszeit wartet.'], 'fr-FR':['Le temps de ralentir.','De beaux séjours, en pleine nature.','Où voulez-vous aller ?','Explorer les séjours','Votre propre cabane','Refuge en forêt','Aucun séjour trouvé','Essayez un autre lieu.','Votre séjour est confirmé','Une petite escapade vous attend.'], 'ar-SA':['وقت للاسترخاء','إقامة جميلة بالقرب من الطبيعة','إلى أين تريد الذهاب؟','اكتشف الإقامة','كوخ خاص بك','ملاذ الغابة','لا توجد نتائج','جرّب مكانًا آخر','تم تأكيد إقامتك','تنتظرك رحلة جميلة']}
cat=hashlib.sha256(b'synthetic-vale-catalog-1').hexdigest()
manifest=dict(schema_version=1,project='Vale',release='Autumn release',build='vale-0.8.4',catalog_hash=cat,expected=[],captures=[])
for si,(screen,state) in enumerate([('Explore','default'),('Search','empty'),('Booking','confirmation')]):
 for li,(locale,t) in enumerate(locales.items()):
  slot=dict(locale=locale,screen=screen,state=state,configuration='mobile-390',text_size='standard',appearance='light')
  manifest['expected'].append(slot)
  if (si,li) in [(0,3),(1,2),(2,3)]:continue
  im=Image.new('RGB',(390,740),'#f8f7f2');d=ImageDraw.Draw(im)
  d.text((24,20),'9:41',fill='#22362e',font=f(13,True));d.text((325,20),'▰  ▰',fill='#22362e',font=f(13))
  d.text((25,63),'vale',fill='#283d31',font=f(31,True));d.ellipse((331,64,365,98),fill='#e1e7dc');d.text((341,72),'V',fill='#283d31',font=f(14))
  if si==0:
   d.text((25,139),t[0],fill='#283d31',font=f(25,True));d.text((25,180),t[1],fill='#778077',font=f(13))
   d.rounded_rectangle((24,222,366,280),radius=12,fill='white',outline='#dadfd3');d.text((40,243),t[2],fill='#6c756d',font=f(13))
   d.rounded_rectangle((24,307,366,531),radius=14,fill='#cad2c0')
   # Stylized entirely generated landscape and cabin, not a photograph.
   d.polygon([(24,417),(109,333),(214,432),(306,349),(366,398),(366,531),(24,531)],fill='#879c82')
   d.polygon([(24,462),(168,382),(270,462),(366,420),(366,531),(24,531)],fill='#607f69')
   d.polygon([(121,428),(194,371),(267,428)],fill='#344d40');d.rectangle((133,428,255,511),fill='#b69770');d.rectangle((182,454,211,511),fill='#384e41');d.rectangle((144,446,168,474),fill='#efe3bb');d.line((151,446,151,474),fill='#b69770',width=2)
   d.rounded_rectangle((40,323,151,350),radius=12,fill='#f8f7f2');d.text((52,330),'SLOW WEEKENDS',fill='#425b47',font=f(9,True))
   d.text((26,555),t[4],fill='#283d31',font=f(20,True));d.text((26,587),t[5],fill='#7d847a',font=f(13));d.text((26,622),'€ 120  / night',fill='#283d31',font=f(14,True))
  elif si==1:
   d.text((25,143),t[3],fill='#283d31',font=f(23,True));d.rounded_rectangle((24,200,366,257),radius=12,fill='white',outline='#dadfd3');d.text((42,220),'Forest • 12—14 Oct',fill='#6c756d',font=f(14))
   d.ellipse((141,310,249,418),fill='#e5e9df');d.ellipse((176,336,217,377),outline='#879c82',width=4);d.line((210,372,229,391),fill='#879c82',width=4)
   d.text((35,453),t[6],fill='#283d31',font=f(22,True));d.text((35,493),t[7],fill='#778077',font=f(14))
   d.rounded_rectangle((35,543,355,592),radius=10,fill='#334e3e');d.text((90,559),t[3],fill='white',font=f(13,True))
  else:
   d.ellipse((150,148,240,238),fill='#dce6d6');d.line([(176,191),(189,204),(216,178)],fill='#47644b',width=4)
   d.text((25,279),t[8],fill='#283d31',font=f(21,True));d.text((25,321),t[9],fill='#778077',font=f(14))
   d.rounded_rectangle((24,376,366,572),radius=12,fill='white',outline='#e1e2da');d.text((44,398),t[5],fill='#283d31',font=f(20,True));d.text((44,449),'12—14 October',fill='#778077',font=f(16));d.text((44,491),'2 guests · 2 nights',fill='#778077',font=f(14));d.text((44,533),'DEMO–0842',fill='#778077',font=f(12))
  d.line((24,677,366,677),fill='#e3e6dc');d.text((46,699),'Explore',fill='#3d5846',font=f(12,True));d.text((170,699),'Saved',fill='#929b90',font=f(12));d.text((281,699),'Trips',fill='#929b90',font=f(12))
  name=f'{screen.lower()}-{locale}.png';im.save(a/name,optimize=True)
  manifest['captures'].append(dict(slot=slot,build='vale-0.8.3' if (si,li)==(1,3) else manifest['build'],catalog_hash='' if (si,li)==(2,2) else cat,image=name,captured_at='2026-10-09T10:30:00Z',sha256=''))
(root/'sample-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
