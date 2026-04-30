/**
 * Register the parent ENS name (taars.eth) on Sepolia via commit-reveal.
 *
 * Run once after funding DEPLOYER_PRIVATE_KEY on Sepolia (~0.01 ETH).
 *
 *   pnpm --filter @taars/server tsx src/scripts/register-parent-ens.ts
 */
import { ensureParentEns, isParentRegistered } from '../services/ens.js';
import { env } from '../env.js';

async function main() {
  console.log(`[ens] checking ${env.PARENT_ENS_NAME} on Sepolia`);
  const before = await isParentRegistered();
  if (before.owner !== '0x0000000000000000000000000000000000000000') {
    console.log(`[ens] already registered. owner = ${before.owner}`);
    return;
  }
  console.log('[ens] not registered yet — kicking off commit-reveal flow (this takes ~60s for the commitment to ripen).');
  const result = await ensureParentEns();
  console.log(`[ens] success. owner = ${result.owner}, tx = ${result.txHash ?? '(no tx — already owned)'}`);
}

main().catch((err) => {
  console.error('[ens] failed:', err);
  process.exit(1);
});
