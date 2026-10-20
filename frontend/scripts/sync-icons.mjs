import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = new URL('../assets/svg/', import.meta.url);
const files = (await readdir(new URL('icons/', root))).filter(name => name.endsWith('.svg')).sort();
const icons = {};
for (const file of files) icons[file.slice(0, -4)] = await readFile(new URL(`icons/${file}`, root), 'utf8');
const empty = await readFile(new URL('illustrations/empty-cart.svg', root), 'utf8');
await writeFile(new URL('../src/components/icon-assets.ts', import.meta.url), '// Generated from assets/svg/icons; run scripts/sync-icons.mjs after editing SVGs.\nexport const iconAssets = ' + JSON.stringify(icons, null, 2) + ' as const;\nexport const emptyCartAsset = ' + JSON.stringify(empty) + ';\n');
console.log(`Synced ${files.length} icons and empty-cart illustration.`);
