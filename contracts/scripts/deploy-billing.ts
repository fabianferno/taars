import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Deploys the per-minute billing stack to (typically) Sepolia:
 *
 *   1. MockUSDC (open mint, 6 decimals)  — testnet faucet token
 *   2. MockINFT (deployer-restricted mint) — mirrors taars Agent INFT ownership.
 *      Required because the real TaarsAgentNFT is on 0G testnet, and the
 *      billing contract calls `IERC721(inft).ownerOf(tokenId)` — which cannot
 *      be done cross-chain. The off-chain pipeline mints matching tokenIds
 *      on this MockINFT to mirror authoritative ownership from 0G.
 *   3. TaarsBilling wired to (MockUSDC, MockINFT) with deployer as
 *      treasury/oracle/owner.
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

  // 2. MockINFT (Sepolia mirror of the on-0G TaarsAgentNFT)
  // If TAARS_INFT_ADDRESS is set AND points to an INFT live on this network,
  // we re-use it; otherwise we deploy a fresh MockINFT and use that.
  let inftAddress = process.env.TAARS_INFT_ADDRESS ?? "";
  let mockInftDeployed = false;
  if (!inftAddress) {
    const Inft = await ethers.getContractFactory("MockINFT");
    const inft = await Inft.deploy(deployer.address);
    await inft.waitForDeployment();
    inftAddress = await inft.getAddress();
    mockInftDeployed = true;
    console.log("MockINFT deployed to:", inftAddress);
  } else {
    console.log("Using existing INFT at:", inftAddress);
  }

  // 3. TaarsBilling
  const Billing = await ethers.getContractFactory("TaarsBilling");
  const billing = await Billing.deploy(
    usdcAddress,
    deployer.address, // treasury
    deployer.address, // oracle (server signer; rotate via setOracle later)
    inftAddress,
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
      mockInft: mockInftDeployed ? inftAddress : null,
      inft: inftAddress,
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
