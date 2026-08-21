// Postbuild step.
//
// 1) esbuild (via tsup) strips top-level "use client" string-literal
//    directives unconditionally — confirmed by inspecting dist output
//    after a plain build (they were present in every relevant .tsx source
//    file and absent from every .js output file). Relying on esbuild to
//    preserve them was not actually safe, despite disabling minification
//    and splitting. This script deterministically re-prepends the
//    directive to exactly the entry files that contain client
//    hooks/context (index.js, cat.js, ai.js, pet.js) and skips the ones
//    that don't need it (contracts.js is pure types/empty at runtime).
//
// 2) Copies the plain, pre-authored CSS foundation into dist/styles.css
//    (no Tailwind/PostCSS pipeline involved by design — see README).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');

const CLIENT_ENTRIES = ['index.js', 'cat.js', 'ai.js', 'pet.js'];
const DIRECTIVE = '"use client";\n';

for (const file of CLIENT_ENTRIES) {
  const filePath = join(distDir, file);
  const content = readFileSync(filePath, 'utf8');
  if (content.startsWith(DIRECTIVE)) {
    console.log(`[postbuild] ${file} already has "use client", skipping`);
    continue;
  }
  writeFileSync(filePath, DIRECTIVE + '\n' + content, 'utf8');
  console.log(`[postbuild] prepended "use client" to ${file}`);
}

const cssSrc = join(root, 'src', 'styles', 'index.css');
const cssOut = join(distDir, 'styles.css');
mkdirSync(distDir, { recursive: true });
copyFileSync(cssSrc, cssOut);
console.log(`[postbuild] ${cssSrc} -> ${cssOut}`);
