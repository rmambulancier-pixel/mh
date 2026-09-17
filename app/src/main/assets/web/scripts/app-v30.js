/* MesHeures V30 — background evidence + cryptographic detached PDF signature */
(function(){
'use strict';
const V='30.0.0';
function ascii(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?')}
function esc(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function snapshot(){return {format:'MesHeures Probatory Dossier',version:V,createdAt:new Date().toISOString(),data:JSON.parse(JSON.stringify(window.DB||{}))}}
function lines(s){const d=s.data||{},days=Object.keys(d.days||{}).sort();const out=[];out.push('MESHEURES - DOSSIER PROBATOIRE');out.push('Version '+V);out.push('Genere le '+s.createdAt);out.push('');out.push('DONNEES JOURNALIERES: '+days.length);days.forEach(k=>{const x=d.days[k]||{};out.push(k+' | '+(x.t||'')+' | '+(x.deb||'')+' -> '+(x.fin||'')+' | pauses '+((x.p||[]).length));});out.push('');out.push('BULLETINS: '+((d.bulletins||[]).length));(d.bulletins||[]).forEach(b=>out.push((b.mois||'')+' | brut '+(b.brut??'')+' | HS25 '+(b.hs25H??'')+' | HS50 '+(b.hs50H??'')));out.push('');out.push('CONSTATS: '+((d.constats||[]).length));(d.constats||[]).forEach(c=>out.push((c.id||'')+' | '+(c.jour_concerne||'')+' | '+(c.regle_violie||'')));return out}
function makePdf(textLines){
 const pages=[];for(let i=0;i<textLines.length;i+=48)pages.push(textLines.slice(i,i+48));if(!pages.length)pages.push(['MesHeures - dossier vide']);
 const objs=[];const add=x=>{objs.push(x);return objs.length};
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const pageIds=[],contentIds=[];
 pages.forEach(ls=>{let stream='BT /F1 9 Tf 40 800 Td 0 -15 Td ';ls.forEach((l,j)=>{if(j===0)stream='BT /F1 9 Tf 40 800 Td '; else stream+='0 -15 Td ';stream+='('+esc(l.slice(0,115))+') Tj ';});stream+='ET';const cid=add('<< /Length '+stream.length+' >>\\nstream\\n'+stream+'\\nendstream');contentIds.push(cid);pageIds.push(add(''))});
 const kids=pageIds.map((id,i)=>id+' 0 R').join(' ');const pagesId=add('<< /Type /Pages /Kids ['+kids+'] /Count '+pageIds.length+' >>');
 pageIds.forEach((id,i)=>objs[id-1]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+font+' 0 R >> >> /Contents '+contentIds[i]+' 0 R >>');
 const catalog=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');
 let pdf='%PDF-1.4\n',offs=[0];objs.forEach((o,i)=>{offs[i+1]=pdf.length;pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const x=pdf.length;pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';for(let i=1;i<offs.length;i++)pdf+=String(offs[i]).padStart(10,'0')+' 00000 n \n';pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+x+'\n%%EOF';return new TextEncoder().encode(pdf)
}
async function sha(bytes){const h=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function keypair(){const k='mh30-signing-key';return new Promise((resolve,reject)=>{const r=indexedDB.open('mesheures-v30-keys',1);r.onupgradeneeded=()=>{try{r.result.createObjectStore('keys')}catch(e){}};r.onerror=()=>reject(r.error);r.onsuccess=async()=>{try{const db=r.result,tx=db.transaction('keys','readonly'),st=tx.objectStore('keys'),g=st.get(k);g.onsuccess=async()=>{if(g.result){resolve(g.result);return}const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const pub=await crypto.subtle.exportKey('jwk',kp.publicKey),priv=await crypto.subtle.exportKey('jwk',kp.privateKey);const w=db.transaction('keys','readwrite');w.objectStore('keys').put({pub,priv},k);resolve({pub,priv})}}catch(e){reject(e)}}})}
async function sign(hash){const kp=await keypair();const priv=await crypto.subtle.importKey('jwk',kp.priv,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},priv,new TextEncoder().encode(hash));return {algorithm:'ECDSA-P256-SHA256',hashAlgorithm:'SHA-256',hash,signature:btoa(String.fromCharCode(...new Uint8Array(sig))),publicKeyJwk:kp.pub,signedAt:new Date().toISOString(),note:'Signature detachee du PDF; verifier avec la cle publique et l empreinte SHA-256.'}}
function download(name,bytes,mime){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
window.mhV30ExportSignedPDF=async function(){try{const s=snapshot(),pdf=makePdf(lines(s)),hash=await sha(pdf),sig=await sign(hash),date=new Date().toISOString().slice(0,10);download('MesHeures-dossier-probatoire-'+date+'.pdf',pdf,'application/pdf');download('MesHeures-dossier-probatoire-'+date+'.sig.json',new TextEncoder().encode(JSON.stringify(sig,null,2)),'application/json');alert('✅ PDF probatoire exporte.\nEmpreinte SHA-256 : '+hash+'\nSignature ECDSA detachee exportee avec sa cle publique.')}catch(e){alert('❌ Export PDF signe impossible : '+e.message)}};
window.mhV18DossierRefresh=function(){};
})();
