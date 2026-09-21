"""
Balayage de contraste WCAG AA (4,5:1 texte normal, 3:1 grand texte) en navigateur réel.

Parcourt tous les onglets + plusieurs types de jour (Travail, CP, Nuit, Maladie, RC, férié, Repos)
+ le menu du jour, en thème clair ET sombre, sur données de test. Échoue (code 1) s'il reste un texte
sous le seuil. Ce que node --check / release-audit ne voient pas : le rendu effectif.

Usage :  python3 qa/contrast-scan.py           (env CHROMIUM_PATH pour un Chromium précis)
Prérequis : pip install playwright && playwright install chromium
"""
import functools, http.server, os, socketserver, sys, threading
from pathlib import Path
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("SKIP: playwright non installé"); sys.exit(0)

WEB = Path(__file__).resolve().parents[1] / "app/src/main/assets/web"
TABS = ['home','jour','mois','paie','analyse','audit','bul','romi','reg',
        'day:2026-09-21','day:2026-09-08','day:2026-09-14','day:2026-09-22',
        'day:2026-09-23','day:2026-09-24','day:2026-09-25','menu:2026-09-14']

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

SEED="""()=>{
const W=(k,deb,fin,p)=>{DB.days[k]={t:'T',deb,fin,p:p||[]}};
W('2026-09-01','06:30','18:30');W('2026-09-02','07:00','13:40');W('2026-09-03','06:45','17:30');W('2026-09-04','06:00','18:00');W('2026-09-05','07:00','14:50');
W('2026-09-07','08:00','18:00',[{d:'12:00',f:'12:30',ty:'ENT'}]);
for(let i=8;i<=12;i++)DB.days['2026-09-'+String(i).padStart(2,'0')]={t:'CP',p:[]};
W('2026-09-14','06:50','17:00',[{d:'11:45',f:'12:15',ty:'EXT'}]);W('2026-09-15','06:20','14:20',[{d:'11:00',f:'11:30',ty:'ENT'}]);
W('2026-09-16','07:20','18:20');W('2026-09-17','07:50','17:50');W('2026-09-18','07:20','15:00');
W('2026-09-22','21:00','05:30');DB.days['2026-09-22'].t='NUIT';
DB.days['2026-09-23']={t:'MAL',p:[]};DB.days['2026-09-24']={t:'RC',p:[]};
W('2026-09-25','05:00','20:30');DB.days['2026-09-25'].fer=true;W('2026-09-26','06:00','19:00',[{d:'12:00',f:'12:30',ty:'DOM'}]);
DB.per={start:'2026-08-24',nb:2};
if(typeof save==='function')save();MH30DataEngine.invalidate('qa');
}"""
JS_SCAN=r"""()=>{
function parse(c){const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[,\/ ]+/).filter(Boolean).map(x=>parseFloat(x));return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
function over(t,b){const a=t.a+b.a*(1-t.a);if(a===0)return {r:0,g:0,b:0,a:0};return {r:(t.r*t.a+b.r*b.a*(1-t.a))/a,g:(t.g*t.a+b.g*b.a*(1-t.a))/a,b:(t.b*t.a+b.b*b.a*(1-t.a))/a,a}}
function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
function ratio(a,b){const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}
const LIGHT=document.documentElement.getAttribute('data-theme')==='light';
const BASE=LIGHT?{r:245,g:247,b:249,a:1}:{r:9,g:13,b:18,a:1};
function key(c){return Math.round(c.r)+','+Math.round(c.g)+','+Math.round(c.b)}
function layers(el){const chain=[];for(let e=el;e&&e.nodeType===1;e=e.parentElement){chain.push(e)}chain.reverse();
 let U=[BASE];
 for(const e of chain){const cs=getComputedStyle(e);let L=[];const bg=parse(cs.backgroundColor);if(bg&&bg.a>0)L.push(bg);
  const bi=cs.backgroundImage;if(bi&&bi!=='none'){const cols=[...bi.matchAll(/rgba?\([^)]+\)/g)].map(m=>parse(m[0])).filter(Boolean);if(cols.length)L=L.concat(cols)}
  if(!L.length)continue;
  // solid opaque bg replaces everything under
  const nu=new Map();
  for(const l of L)for(const u of U){const c=over(l,u);c.a=1;nu.set(key(c),c)}
  U=[...nu.values()].slice(0,16);
 }
 return U}
const out=[];const seen=new Set();
const root=document.querySelector('main')||document.body;
const fabs=[...document.querySelectorAll('.fab,#mhV30Nav,.mh-v30-nav')];
const els=[...root.querySelectorAll('*'),...fabs.flatMap(f=>[f,...f.querySelectorAll('*')])];
for(const el of els){
 if(['SCRIPT','STYLE'].includes(el.tagName.toUpperCase()))continue;
 const own=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim().length>0);
 if(!own.length)continue;
 const txt0=own.map(n=>n.textContent.trim()).join(' ');
 if(!/[A-Za-zÀ-ÿ0-9]/.test(txt0))continue;
 const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
 const cs=getComputedStyle(el);if(cs.visibility==='hidden'||parseFloat(cs.opacity)===0)continue;
 let h=false;for(let e=el;e&&e!==document.documentElement;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'){h=true;break}}if(h)continue;
 const fg0=parse(cs.color);const U=layers(el);
 let worst=99;
 for(const u of U){const fg=over(fg0,u);const cr=ratio(fg,u);if(cr<worst)worst=cr}
 const size=parseFloat(cs.fontSize);const bold=parseInt(cs.fontWeight)>=700;
 const large=size>=24||(size>=18.66&&bold);const need=large?3:4.5;
 if(worst<need){
  const txt=txt0.slice(0,40);
  const k=el.tagName+'.'+String(el.className).split(' ').slice(0,2).join('.')+'|'+txt;
  if(seen.has(k))continue;seen.add(k);
  out.push({ratio:+worst.toFixed(2),need,txt,cls:el.tagName.toLowerCase()+'.'+String(el.className).replace(/\s+/g,'.'),fg:cs.color,bg:U.map(u=>`rgb(${Math.round(u.r)},${Math.round(u.g)},${Math.round(u.b)})`).slice(0,2).join(' | '),size})
 }
}
return out}"""

def main():
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(WEB)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    bad = 0
    with sync_playwright() as p:
        kw = {"executable_path": os.environ["CHROMIUM_PATH"], "args": ["--no-sandbox"]} if os.environ.get("CHROMIUM_PATH") else {}
        b = p.chromium.launch(**kw)
        for theme in ("light", "dark"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", color_scheme=theme)
            ctx.add_init_script(f"try{{localStorage.setItem('mesheures_theme','{theme}')}}catch(e){{}}")
            page = ctx.new_page()
            page.goto(f"http://127.0.0.1:{port}/index.html")
            page.wait_for_timeout(1500)
            page.evaluate(SEED)
            page.wait_for_timeout(300)
            for t in TABS:
                if t.startswith('day:'): page.evaluate(f"mhOpenDay('{t[4:]}')")
                elif t.startswith('menu:'): page.evaluate(f"openDayMenu('{t[5:]}')")
                else: page.evaluate(f"tab('{t}')")
                page.wait_for_timeout(600)
                res = page.evaluate(JS_SCAN)
                ok = not res
                print(("PASS: " if ok else "FAIL: ") + f"{theme} / {t}" + ("" if ok else f" · {len(res)} texte(s) sous le seuil"))
                for r in sorted(res, key=lambda x: x['ratio'])[:6]:
                    print(f"      {r['ratio']}:1 (min {r['need']}) {r['txt']!r} {r['cls'][:50]} {r['fg']} sur {r['bg']}")
                bad += len(res)
            ctx.close()
        b.close()
    print("\nCONTRAST SCAN: " + ("PASS" if bad == 0 else f"FAIL ({bad})"))
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
