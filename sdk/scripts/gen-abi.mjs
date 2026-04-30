import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const artifactsDir = path.resolve(root, '../contracts/artifacts/contracts');

const targets = [
  { name: 'TaarsAgentNFT', file: 'TaarsAgentNFT.sol/TaarsAgentNFT.json' },
];

const outDir = path.resolve(root, 'src/abi');
fs.mkdirSync(outDir, { recursive: true });

const indexExports = [];
for (const t of targets) {
  const artifactPath = path.join(artifactsDir, t.file);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Artifact not found: ${artifactPath}. Run \`pnpm --filter @taars/contracts compile\` first.`);
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const out = path.join(outDir, `${t.name}.ts`);
  fs.writeFileSync(
    out,
    `export const ${t.name}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`
  );
  indexExports.push(`export * from './${t.name}.js';`);
  console.log(`Wrote ABI: ${out}`);
}
fs.writeFileSync(path.join(outDir, 'index.ts'), indexExports.join('\n') + '\n');
console.log('Done.');
