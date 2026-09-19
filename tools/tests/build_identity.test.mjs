import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync(new URL('../../frontend/app/layout.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
function buildId(env) {
  const module = {exports: {}};
  vm.runInNewContext(compiled, {module, exports: module.exports, process: {env}, require(name) {
    if (name === 'react/jsx-runtime') return {jsx: (type, props) => ({type, props})};
    if (name === './globals.css') return {};
    if (name === '@/components/DisplayLanguageProvider') return {DisplayLanguageProvider: 'DisplayLanguageProvider'};
    throw Error(`Unexpected import ${name}`);
  }});
  return module.exports.default({children: null}).props['data-calorieapp-build-id'];
}
test('Rendered build metadata uses a valid Render commit only when no explicit release ID exists', () => {
  const sha = '2ad5d87e74a0169dfa069fb77babe27d592c9f8b';
  assert.equal(buildId({RENDER_GIT_COMMIT: sha}), sha);
  assert.equal(buildId({RENDER_GIT_COMMIT: ' ' + sha + ' ', NEXT_PUBLIC_CALORIEAPP_BUILD_ID: ' '}), sha);
  assert.equal(buildId({RENDER_GIT_COMMIT: sha, NEXT_PUBLIC_CALORIEAPP_BUILD_ID: 'release-1'}), 'release-1');
  assert.equal(buildId({RENDER_GIT_COMMIT: sha, NEXT_PUBLIC_CALORIEAPP_BUILD_ID: 'development'}), 'development');
  assert.equal(buildId({RENDER_GIT_COMMIT: 'invalid provider text'}), 'development');
  assert.equal(buildId({}), 'development');
  assert.throws(() => buildId({NEXT_PUBLIC_CALORIEAPP_BUILD_ID: 'invalid explicit value', RENDER_GIT_COMMIT: sha}));
});
