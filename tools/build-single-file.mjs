#!/usr/bin/env node
// ============================================================================
// BUILD A SINGLE, DOUBLE-CLICKABLE HTML FILE
// ----------------------------------------------------------------------------
// Browsers refuse to load JavaScript modules from a file:// address, so for
// playing without a web server we bundle everything into one HTML file:
//
//   node tools/build-single-file.mjs      ->  dist/back-to-skool.html
//
// It uses esbuild (fetched on demand by npx) to join the modules, then inlines
// the result and the stylesheet into a copy of index.html.
// ============================================================================

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'dist'), { recursive: true });

const bundlePath = join(root, 'dist', 'bundle.js');
execSync(`npx -y esbuild@0.24.2 src/main.js --bundle --format=iife --outfile=${bundlePath} --log-level=warning`, { cwd: root, stdio: 'inherit' });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const js = readFileSync(bundlePath, 'utf8');

const single = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="src/main.js"></script>', `<script>\n${js}\n</script>`)
  .replace(/<footer class="foot">[\s\S]*?<\/footer>/, '<footer class="foot"><span>Back to Skool remake · single-file build</span></footer>');

writeFileSync(join(root, 'dist', 'back-to-skool.html'), single);
console.log(`Wrote dist/back-to-skool.html (${(single.length / 1024).toFixed(0)} KB)`);

// A second flavour for hosting as a claude.ai artifact, which supplies its own
// <html>/<head>/<body> wrapper: just the title, styles, markup and script.
const bodyInner = html.match(/<body>([\s\S]*?)<script type="module"/)[1]
  .replace(/<footer class="foot">[\s\S]*?<\/footer>/, '<footer class="foot"><span>Back to Skool remake · built to be modified</span></footer>');
const fragment = `<title>Back to Skool</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400&display=swap" rel="stylesheet">
<style>
${css}
</style>
${bodyInner}
<script>
${js}
</script>
`;
writeFileSync(join(root, 'dist', 'artifact.html'), fragment);
console.log(`Wrote dist/artifact.html (${(fragment.length / 1024).toFixed(0)} KB)`);
