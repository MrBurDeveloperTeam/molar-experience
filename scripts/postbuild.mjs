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
// 2) Copies the plain, pre-authored CSS foundation (Cat/AI, and the pet
//    overlay's own non-Tailwind rules) into dist/styles.css.
//
// 3) Compiles the ported Virtual Pet components' Tailwind classNames into
//    a real stylesheet via the Tailwind CLI, scopes every selector under
//    `.snabbb-molar-experience` (see `src/pet/tailwind-entry.css`'s own
//    header for why this exists instead of a hand-authored BEM
//    conversion), and appends the scoped result to dist/styles.css.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';
import prefixSelector from 'postcss-prefix-selector';

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

// --- Scoped Tailwind utilities for the ported Virtual Pet components ---
const tailwindEntry = join(root, 'src', 'pet', 'tailwind-entry.css');
const tailwindRawOut = join(distDir, '_pet-tailwind-raw.css');
const tailwindCli = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss');

execFileSync(tailwindCli, ['-i', tailwindEntry, '-o', tailwindRawOut, '--cwd', root], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log(`[postbuild] compiled ${tailwindEntry} -> ${tailwindRawOut}`);

const rawCss = readFileSync(tailwindRawOut, 'utf8');
const scoped = await postcss([
  prefixSelector({
    prefix: '.snabbb-molar-experience',
    transform(prefix, selector, prefixedSelector) {
      // Theme-variable declarations compile to `:root`/`:host` — scope
      // those to the wrapper class itself (not the page root) instead of
      // descendant-prefixing them, so CSS custom properties are still
      // visible to every descendant utility class.
      if (selector === ':root' || selector === ':host') return prefix;
      return prefixedSelector;
    },
  }),
]).process(rawCss, { from: tailwindRawOut });

const existingCss = readFileSync(cssOut, 'utf8');
writeFileSync(
  cssOut,
  `${existingCss}\n\n/* ==========================================================================\n   Scoped Tailwind utilities — compiled from src/pet/tailwind-entry.css for\n   the ported Virtual Pet components' Tailwind classNames. See that file's\n   header for why this exists instead of a hand-authored BEM conversion.\n   ========================================================================== */\n\n${scoped.css}`,
  'utf8'
);
unlinkSync(tailwindRawOut);
console.log(`[postbuild] appended scoped Tailwind utilities to ${cssOut}`);
