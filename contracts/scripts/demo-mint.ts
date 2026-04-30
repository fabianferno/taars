/**
 * demo-mint.ts -- Mint sample taars INFTs for the demo.
 *
 * Usage:
 *   pnpm demo:mint
 *
 * Reads the deployed contract address from deployments/<network>.json
 * (created by scripts/deploy.ts).
 */

import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

const EXPLORER = "https://chainscan-galileo.0g.ai";

const AGENTS = [
  {
    name: "vitalik",
    soul: "I am vitalik. I think in protocols, cryptography, and credibly neutral systems.",
    skills: '["protocol-design","cryptoeconomics","longform-essays"]',
    config: '{"tone":"thoughtful","channels":["x","blog"]}',
  },
  {
    name: "fabian",
    soul: "I am fabian. I ship hackathons, build agents, and care about user experience.",
    skills: '["full-stack","agent-design","demo-day"]',
    config: '{"tone":"playful","channels":["x","telegram"]}',
  },
  {
    name: "balaji",
    soul: "I am balaji. I think in network states, exit, and the future of governance.",
    skills: '["network-states","macro","predictions"]',
    config: '{"tone":"provocative","channels":["x","podcast"]}',
  },
];

function hashData(content: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

async function main() {
  const deploymentFile = resolve(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );
  const { address } = JSON.parse(readFileSync(deploymentFile, "utf8")) as {
    address: string;
  };

  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(70));
  console.log("taars -- ERC-7857 Intelligent NFT demo mint");
  console.log("=".repeat(70));
  console.log(`Network:  ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Contract: ${address}`);
  console.log(`Explorer: ${EXPLORER}/address/${address}`);
  console.log();

  const nft = await ethers.getContractAt("TaarsAgentNFT", address);

  const results: Array<{ name: string; tokenId: string; txHash: string }> = [];

  for (const agent of AGENTS) {
    const intelligentData = [
      { dataDescription: "soul.md", dataHash: hashData(agent.soul) },
      { dataDescription: "skills.json", dataHash: hashData(agent.skills) },
      { dataDescription: "config.json", dataHash: hashData(agent.config) },
    ];

    const tx = await nft.mint(intelligentData, deployer.address);
    const receipt = await tx.wait();

    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const transferLog = receipt!.logs.find(
      (log: { topics: ReadonlyArray<string> }) =>
        log.topics[0] === transferTopic
    );
    const tokenId = transferLog
      ? BigInt(transferLog.topics[3]).toString()
      : "?";

    results.push({ name: agent.name, tokenId, txHash: receipt!.hash });

    console.log(`  ${agent.name} (Token #${tokenId})`);
    console.log(`    Tx: ${EXPLORER}/tx/${receipt!.hash}`);
  }

  console.log();
  console.log("=".repeat(70));
  console.log("Summary");
  console.log("=".repeat(70));
  for (const r of results) {
    console.log(
      `  #${r.tokenId.padEnd(3)} ${r.name.padEnd(10)} ${EXPLORER}/tx/${r.txHash}`
    );
  }
  console.log();
  console.log(`Contract: ${EXPLORER}/address/${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
