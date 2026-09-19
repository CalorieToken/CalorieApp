import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const ts=require('typescript');
const copy=JSON.parse(readFileSync(new URL('../../frontend/config/diary-copy.json',import.meta.url),'utf8'));
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../frontend/lib/foodDiary.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:()=>({default:copy}),Date,URLSearchParams});
const diary=module.exports;
test('calendar days respect DST and Monday-based weeks cross months and years',()=>{
 const old=process.env.TZ;process.env.TZ='Europe/Amsterdam';
 try {
  const march=diary.diaryRange('day','2026-03-29');assert.equal((march.end-march.start)/3600000,23);
  const october=diary.diaryRange('day','2026-10-25');assert.equal((october.end-october.start)/3600000,25);
  const week=diary.diaryRange('week','2026-01-01');assert.equal(diary.localDiaryDate(week.start),'2025-12-29');assert.equal(diary.localDiaryDate(week.end),'2026-01-05');
  const month=diary.diaryRange('month','2024-02-29');assert.equal(diary.localDiaryDate(month.start),'2024-02-01');assert.equal(diary.localDiaryDate(month.end),'2024-03-01');
  assert.equal(diary.moveDiaryDate('month','2026-01-31',1),'2026-02-01');
  assert.equal(diary.diaryParams('all','2026-09-11'),'');
  assert.throws(()=>diary.diaryRange('day','2026-02-31'));
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('all supported languages have the same diary/search labels and substitution fields',()=>{
 const keys=Object.keys(copy.en).sort();
 for(const [locale,row] of Object.entries(copy)){
  assert.deepEqual(Object.keys(row).sort(),keys,locale);
  for(const key of keys){assert.ok(row[key].trim());assert.deepEqual((row[key].match(/\{\w+\}/g)||[]).sort(),(copy.en[key].match(/\{\w+\}/g)||[]).sort(),`${locale}/${key}`);}
 }
});
