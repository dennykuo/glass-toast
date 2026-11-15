import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const fixture = mkdtempSync(join(tmpdir(), 'glass-toast-package-'));
const run = (script, args, cwd = process.cwd()) =>
  execFileSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' });
const npm = (args, cwd) => run(process.env.npm_execpath, args, cwd);
const tool = (path, args, cwd) => run(fileURLToPath(new URL(path, import.meta.url)), args, cwd);

try {
  npm(['pack', '--ignore-scripts', '--pack-destination', fixture, '--silent']);
  const archive = join(fixture, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`);
  tool('../node_modules/publint/src/cli.js', ['run', archive, '--strict']);
  // CSS is a bundler entry. /auto uses Node's require(esm) on supported Node versions.
  tool('../node_modules/@arethetypeswrong/cli/dist/index.js', [
    archive, '--profile', 'node16', '--exclude-entrypoints', './style.css',
    '--ignore-rules', 'cjs-resolves-to-esm',
  ]);
  writeFileSync(join(fixture, 'package.json'), '{"private":true}\n');
  npm(['install', archive, '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--no-package-lock'], fixture);
  const installed = join(fixture, 'node_modules', pkg.name);
  for (const cdn of ['unpkg', 'jsdelivr']) {
    assert.match(pkg[cdn], /\.js$/, `${cdn} must serve a browser script with a .js extension`);
    assert.deepEqual(readFileSync(join(installed, pkg[cdn])), readFileSync(join(installed, pkg.main)));
  }
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    for (const api of [await import('${pkg.name}'), require('${pkg.name}'), await import('${pkg.name}/auto')]) {
      assert.doesNotThrow(() => api.show('Server message')());
    }
  `], { cwd: fixture, stdio: 'inherit' });

  const examples = ['README.md', 'README.zh-TW.md'].map((name) => {
    const markdown = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    const block = [...markdown.matchAll(/```js\n([\s\S]*?)\n```/g)]
      .find(([, code]) => code.includes(`import '${pkg.name}/style.css';`));
    if (!block) throw new Error(`CSS import example missing from ${name}`);
    const filename = `${name}.mts`;
    writeFileSync(join(fixture, filename), block[1]);
    return filename;
  });
  writeFileSync(join(fixture, 'consumer.cts'), [
    `import toast = require('${pkg.name}');`,
    `import auto = require('${pkg.name}/auto');`,
    "const dismiss: () => void = toast.show('Saved', { type: 'success' });",
    "auto.register({ closeLabel: 'Dismiss notification' });",
    "toast.error('Retry', { dialog: document.createElement('dialog'),",
    "  action: { label: 'Retry', onClick: async () => 'done' } });",
    'dismiss();',
    '// @ts-expect-error Unknown positions must be rejected.',
    "toast.show('Invalid', { position: 'middle' });",
  ].join('\n'));
  const tsc = (args) => tool('../node_modules/typescript/bin/tsc', [
    '--strict', '--noEmit', '--noUncheckedSideEffectImports', ...args,
  ], fixture);
  tsc(['--module', 'esnext', '--moduleResolution', 'bundler', ...examples]);
  tsc(['--module', 'node20', 'consumer.cts']);
} finally {
  rmSync(fixture, { force: true, recursive: true });
}
