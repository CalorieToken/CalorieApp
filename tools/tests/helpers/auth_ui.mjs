import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../../frontend/package.json',import.meta.url));
const ts=require('typescript');
function load(path,imports){
 const source=readFileSync(new URL('../../../frontend/'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(Object.hasOwn(imports,name))return imports[name];throw new Error('Unexpected auth display import '+name);}});
 return module.exports;
}
export const authCopy=JSON.parse(readFileSync(new URL('../../../frontend/config/auth-ui-copy.json',import.meta.url),'utf8'));
const registry=JSON.parse(readFileSync(new URL('../../../frontend/config/locales.json',import.meta.url),'utf8'));
const locales=load('lib/locales.ts',{'@/config/locales.json':{default:registry}});
export const authUi=load('lib/authUi.ts',{'@/config/auth-ui-copy.json':{default:authCopy},'@/lib/locales':locales});
