import { ethers, upgrades, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TaarsAgentNFT with:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance));

  const Factory = await ethers.getContractFactory("TaarsAgentNFT");
  const proxy = await upgrades.deployProxy(Factory, [deployer.address], {
    kind: "uups",
    initializer: "initialize",
  });
  await proxy.waitForDeployment();

  const address = await proxy.getAddress();
  console.log("TaarsAgentNFT proxy deployed to:", address);

  const deploymentsDir = resolve(__dirname, "..", "deployments");
  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }
  const outFile = resolve(deploymentsDir, `${network.name}.json`);
  const record = {
    network: network.name,
    chainId: Number(network.config.chainId ?? 0),
    address,
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
