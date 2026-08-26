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

// --- Tailwind v3-host transform/translate compatibility reset ---
//
// Tailwind v4 (this package's compiled output above) represents
// translate/rotate/scale as their own individual CSS properties
// (`translate:`, `rotate:`, `scale:`). Tailwind v3 (still used by some
// consuming hosts, e.g. E-Learning/Appointments) compiles the *same*
// utility class names (`-translate-x-1/2`, `scale-95`, `rotate-180`, …) to
// the legacy composite `transform:` property instead. Because `transform`
// and `translate`/`rotate`/`scale` are different CSS properties, a
// Tailwind-v3 host that happens to use one of these exact class names
// anywhere in its own source causes BOTH declarations to apply to the same
// scoped element simultaneously — the browser composes them, doubling the
// effective translation/rotation/scale. See the class-level docs on
// `SharedVirtualPet` for the full write-up of this cross-major collision.
//
// Fix: emit an UNLAYERED companion rule (`transform: none;`) for every
// exact selector this package compiled above that sets `translate`,
// `rotate`, or `scale` — scoped identically, so it stays exactly as
// specific as the layered rule it accompanies. Per the CSS cascade-layer
// spec, unlayered declarations always outrank layered ones for the same
// property regardless of specificity, so this reset wins against a
// Tailwind-v3 host's `transform:` declaration (itself always unlayered)
// purely by being unlayered too — the ordinary `.snabbb-molar-experience`
// double-class specificity margin (see selector below) is what then keeps
// it from ever being beaten by a bare, unscoped host utility of the same
// name. This section is deliberately generated from the actual compiled
// output above (never a hand-maintained selector list) so it can never
// drift out of sync with the utilities this package actually ships, and it
// only ever targets the exact selectors already proven to exist — never a
// wildcard or family-wide reset — so it cannot affect SVG
// `<animateTransform>` elements, the stink-line/chew-mouth keyframe
// animations (authored as plain hand-written CSS, not Tailwind utilities),
// or any element that intentionally relies on the composite `transform`
// property.
const scopedRoot = postcss.parse(scoped.css);
const resetRules = [];

function collectResetRules(container, media) {
  container.each((node) => {
    if (node.type === 'atrule' && node.name === 'media') {
      collectResetRules(node, node.params);
      return;
    }
    if (node.type !== 'rule') return;
    const props = new Set();
    node.walkDecls((decl) => props.add(decl.prop));
    // Only the individual transform-family properties are candidates —
    // never touch a rule that already declares `transform` itself (this
    // package's own `.transform` 3D-rotation utility, if ever used, is
    // deliberately excluded by this check).
    const isCandidate = ['translate', 'rotate', 'scale'].some((p) => props.has(p)) && !props.has('transform');
    if (!isCandidate) return;
    resetRules.push({ selector: node.selector, media });
  });
}

postcss.parse(scoped.css).walkAtRules('layer', (layerRule) => {
  collectResetRules(layerRule);
});

if (resetRules.length === 0) {
  throw new Error('[postbuild] transform-compat: no candidate translate/rotate/scale rules found — refusing to emit an empty/unproven compatibility section');
}

// Build the unlayered CSS text directly (not via postcss.Root round-trip)
// so there is no risk of it accidentally being re-wrapped in a layer.
const byMedia = new Map();
for (const { selector, media } of resetRules) {
  const key = media || '';
  if (!byMedia.has(key)) byMedia.set(key, []);
  byMedia.get(key).push(selector);
}

let compatCss = '';
for (const [media, selectors] of byMedia) {
  const body = selectors.map((s) => `  ${s} {\n    transform: none;\n  }`).join('\n');
  compatCss += media ? `@media ${media} {\n${body}\n}\n\n` : `${body}\n\n`;
}

const finalCss = readFileSync(cssOut, 'utf8');
writeFileSync(
  cssOut,
  `${finalCss}\n/* ==========================================================================\n   Tailwind v3-host transform/translate compatibility reset — deliberately\n   UNLAYERED (outside every @layer block above) and generated from the\n   exact selectors compiled above; see this section's own doc comment in\n   scripts/postbuild.mjs for the full mechanism. Do not hand-edit — rerun\n   the build. Targets ${resetRules.length} exact selector(s).\n   ========================================================================== */\n\n${compatCss}`,
  'utf8'
);
console.log(`[postbuild] appended ${resetRules.length} unlayered transform-compat selector(s) to ${cssOut}`);
