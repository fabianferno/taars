import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Deploys the per-minute billing stack to (typically) Sepolia:
 *
 *   1. MockUSDC (open mint, 6 decimals)  — testnet faucet token
 *   2. TaarsBilling wired to MockUSDC with deployer as
 *      treasury / oracle / owner.
 *
 * Billing is now ORACLE-ONLY: it does not read INFT ownership on-chain. The
 * server (oracle) verifies real INFT ownership against the canonical 0G
 * TaarsAgentNFT contract and supplies the owner address when calling
 * `claimRevenueFor`. This removes the cross-chain mirror requirement that
 * MockINFT used to satisfy.
 *
 * Writes the addresses to `contracts/deployments/<network>.billing.json`.
 *
 * Run with: `pnpm deploy:billing` (defaults to --network sepolia).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TaarsBilling stack with:", deployer.address);
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance));

  // 1. MockUSDC
  const Usdc = await ethers.getContractFactory("MockUSDC");
  const usdc = await Usdc.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // 2. TaarsBilling (oracle-attested ownership; no on-chain INFT dep)
  const Billing = await ethers.getContractFactory("TaarsBilling");
  const billing = await Billing.deploy(
    usdcAddress,
    deployer.address, // treasury
    deployer.address, // oracle (server signer; rotate via setOracle later)
    deployer.address // owner
  );
  await billing.waitForDeployment();
  const billingAddress = await billing.getAddress();
  console.log("TaarsBilling deployed to:", billingAddress);

  // Persist deployment record
  const deploymentsDir = resolve(__dirname, "..", "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }
  const outFile = resolve(deploymentsDir, `${network.name}.billing.json`);
  const record = {
    network: network.name,
    chainId: Number(network.config.chainId ?? 0),
    addresses: {
      mockUsdc: usdcAddress,
      billing: billingAddress,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
