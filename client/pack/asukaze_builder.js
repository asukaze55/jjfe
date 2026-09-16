import { spawnSync } from 'child_process';
import * as esbuild from 'esbuild'
import fs from 'node:fs';
import path from 'node:path';

/** @typedef {{module: string, output: string, strip: string}} DeclType */
/** @typedef {{entryPoint: string, path: string}} SourceType */
/** @typedef {{file: string, path: string}} TargetType */
/** @typedef {{decl?: DeclType, extraJs?: string[], source: SourceType, noStrict?: boolean, target: TargetType}} Config */

/** @param {Config} config */
function preprocessJs(config) {
  const files = fs.globSync(path.resolve(config.source.path, '*.js'));
  for (const file of files) {
    const content = fs.readFileSync(file).toString()
        .replace(/net.asukaze.module\([\(\w\s,\)]+=>\s*\{(.*)\}\);/s, '$1')
        .replaceAll(
            /const (\{.*\}) = require\(('.*')\);/g, 'import $1 from $2;')
        .replaceAll(/module.exports\s*=/g, 'export ');
    fs.writeFileSync(path.resolve('src', path.basename(file)), content);
  }
}

/** @param {Config} config */
function copyTs(config) {
  const files = fs.globSync(path.resolve(config.source.path, '*.ts'));
  for (const file of files) {
    fs.copyFileSync(file, path.resolve('src', path.basename(file)));
  }
}

/** @param {Config} config */
function runTsc(config) {
  const emitParams = config.decl
      ? `--declaration --emitDeclarationOnly --outDir decl`
      : '--noEmit'
  const strictParam = config.noStrict ? '--strictNullChecks false' : '';
  const tscResult = spawnSync(
      `npx tsc ${path.resolve('src', config.source.entryPoint)} \
      --target es2025 --checkJs ${emitParams} --strict ${strictParam} \
      --module esnext --moduleResolution bundler`, {shell: true});
  if (tscResult.error && tscResult.error.toString()) {
    throw tscResult.error.toString();
  }
  if (tscResult.stdout && tscResult.stdout.toString()) {
    throw 'tsc error:\n' + tscResult.stdout.toString();
  }
}

/** @param {Config} config */
async function generateJs(config) {
  await esbuild.build({
    entryPoints: [path.resolve('src', config.source.entryPoint)],
    bundle: true,
    minify: true,
    outfile: path.resolve(config.target.path, config.target.file)
  });
}

/** @param {Config} config */
function copyDeclaration(config) {
  const declFileName = `${config.decl.module}.d.ts`;
  let decl = fs.readFileSync(path.resolve('decl', declFileName)).toString();
  if (config.decl.strip != null) {
    decl = decl.split('\n')
        .filter(line => !line.includes(config.decl.strip))
        .join('\n');
  }
  fs.writeFileSync(path.resolve(config.target.path, config.decl.output), decl);
}

/** @param {Config} config */
function copyExtraJs(config) {
  if (config.extraJs) {
    for (const file of config.extraJs) {
      fs.copyFileSync(path.resolve(config.source.path, file),
          path.resolve(config.target.path, file));
    }
  }
}

/** @param {Config} config */
function copyHtml(config) {
  const files = fs.globSync(path.resolve(config.source.path, '*.html'));
  for (const file of files) {
    const html = fs.readFileSync(file).toString().replaceAll(
        /(<script src=")(\w+.js)("><\/script>\r?\n?)/g,
        (match, p1, p2, p3) => (p2 == config.source.entryPoint)
            ? p1 + config.target.file + p3
            : config.extraJs?.includes(p2) ? match : '');
    fs.writeFileSync(
        path.resolve(config.target.path, path.basename(file)), html);
  }
}

/** @param {Config} config */
function copyCss(config) {
  const files = fs.globSync(path.resolve(config.source.path, '*.css'));
  for (const file of files) {
    fs.copyFileSync(
        file, path.resolve(config.target.path, path.basename(file)));
  }
}

/** @param {Config} config */
async function build(config) {
  try {
    fs.mkdirSync(config.target.path, {recursive: true});
    fs.mkdirSync('src', {recursive: true});
    if (config.decl) {
      fs.mkdirSync('decl', {recursive: true});
    }
    preprocessJs(config);
    copyTs(config);
    runTsc(config);
    if (config.decl) {
      copyDeclaration(config);
    }
    await generateJs(config);
    copyExtraJs(config);
    copyHtml(config);
    copyCss(config);
  } finally {
    fs.rmSync('src', {recursive: true});
    if (config.decl) {
      fs.rmSync('decl', {recursive: true});
    }
  }
}

export { build };
