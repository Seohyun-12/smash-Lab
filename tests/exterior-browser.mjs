import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const output=new URL('../outputs/exterior/',import.meta.url);
await mkdir(output,{recursive:true});
const hook=await readFile(new URL('./exterior-hooks.js',import.meta.url),'utf8');
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/game.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text())+'\n'+hook});
  });
  await page.goto(process.env.SMASH_TEST_URL||'http://127.0.0.1:8787',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__exteriorTest?.ready());
  for(const mode of ['orbit','road','map']){
    await page.evaluate(mode=>window.__exteriorTest.preset(mode),mode);
    await page.locator('.arena').screenshot({path:new URL(mode+'.png',output).pathname});
    console.log('PASS exterior render: '+mode);
  }
  const views=[['E','+z'],['E','-z'],['E','-x'],['E','+x'],['F','+z'],['F','-z'],['F','+x']];
  const records=[];
  for(let i=0;i<views.length;i++){
    const [id,side]=views[i];
    const record=await page.evaluate(([id,side])=>window.__exteriorTest.inspect(id,side),[id,side]);
    const file=String(i+1).padStart(2,'0')+'-'+id+'-'+(side[0]==='+'?'plus':'minus')+side[1]+'.png';
    await page.locator('.arena').screenshot({path:new URL(file,output).pathname});
    records.push({...record,file});
    console.log('PASS reference view '+(i+1)+': '+id+' '+side);
  }
  assert.deepEqual(errors,[]);
  await writeFile(new URL('views.json',output),JSON.stringify(records,null,2));
  // Local-only review page links to reference files without copying their pixels.
  const referenceRoot='/home/tjgus/smash-lab-reference/';
  let html='<!doctype html><meta charset="utf-8"><title>Exterior observation review</title><style>body{font:16px system-ui;background:#182128;color:#eef4f4;margin:24px}section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:30px}img{width:100%;height:420px;object-fit:contain;background:#24313a}p{line-height:1.7}</style><h1>관찰 자료와 게임 화면 비교</h1><p>참고 사진은 외부 로컬 경로를 읽기만 하며, 이 문서와 검증 스크린샷은 Git·배포 대상이 아닙니다. 참고 지점은 주변 건물의 가림을 피하기 위해 최대 45도 이내에서 조정했습니다.</p>';
  for(const [render,reference,title] of [['road','junglim/thumb.jpg','대왕판교로 쪽'],['orbit','cosmax/pangyo_hq.jpg','우주공원 쪽'],['map','vworld/ef_roof_crop.png','옥상']]){
    html+='<h2>'+title+'</h2><section><img src="'+pathToFileURL(referenceRoot+reference).href+'"><img src="'+render+'.png"></section>';
  }
  await writeFile(new URL('comparison.html',output),html);
  console.log('PASS: three overview renders and seven local reference views; no page errors');
}finally{await browser.close();}
