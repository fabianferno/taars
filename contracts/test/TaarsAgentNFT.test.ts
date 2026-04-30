import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("TaarsAgentNFT", () => {
  async function deploy() {
    const [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TaarsAgentNFT");
    const nft = await upgrades.deployProxy(Factory, [owner.address], {
      kind: "uups",
      initializer: "initialize",
    });
    await nft.waitForDeployment();
    return { nft, owner, user1, user2 };
  }

  const sampleData = [
    { dataDescription: "soul.md", dataHash: ethers.keccak256(ethers.toUtf8Bytes("soul")) },
    { dataDescription: "skills.json", dataHash: ethers.keccak256(ethers.toUtf8Bytes("skills")) },
    { dataDescription: "config.json", dataHash: ethers.keccak256(ethers.toUtf8Bytes("config")) },
  ];

  describe("initialize", () => {
    it("sets owner and reverts on second call", async () => {
      const { nft, owner } = await deploy();
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.name()).to.equal("taars");
      expect(await nft.symbol()).to.equal("TAAR");
      await expect(nft.initialize(owner.address)).to.be.revertedWithCustomError(
        nft,
        "InvalidInitialization"
      );
    });
  });

  describe("mint", () => {
    it("mints token #1 with intelligentData and correct owner", async () => {
      const { nft, owner } = await deploy();
      await nft.mint(sampleData, owner.address);
      expect(await nft.ownerOf(1)).to.equal(owner.address);
      const data = await nft.intelligentDataOf(1);
      expect(data.length).to.equal(3);
      expect(data[0].dataDescription).to.equal("soul.md");
      expect(data[1].dataDescription).to.equal("skills.json");
      expect(data[2].dataDescription).to.equal("config.json");
      expect(data[0].dataHash).to.equal(sampleData[0].dataHash);
    });
  });

  describe("iTransfer", () => {
    it("moves ownership and emits Transferred + PublishedSealedKey", async () => {
      const { nft, owner, user1 } = await deploy();
      await nft.mint(sampleData, owner.address);
      await expect(nft.iTransfer(user1.address, 1, []))
        .to.emit(nft, "Transferred")
        .withArgs(owner.address, user1.address, 1)
        .and.to.emit(nft, "PublishedSealedKey")
        .withArgs(1, "0x");
      expect(await nft.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("iClone", () => {
    it("creates token #2 with copied data and emits Cloned", async () => {
      const { nft, owner, user1 } = await deploy();
      await nft.mint(sampleData, owner.address);
      await expect(nft.iClone(user1.address, 1, []))
        .to.emit(nft, "Cloned")
        .withArgs(1, 2, user1.address);
      expect(await nft.ownerOf(2)).to.equal(user1.address);
      const cloned = await nft.intelligentDataOf(2);
      expect(cloned.length).to.equal(3);
      expect(cloned[0].dataDescription).to.equal("soul.md");
      expect(cloned[0].dataHash).to.equal(sampleData[0].dataHash);
    });
  });

  describe("authorizeUsage / revokeAuthorization", () => {
    it("adds user via authorizeUsage and removes via revokeAuthorization", async () => {
      const { nft, owner, user1 } = await deploy();
      await nft.mint(sampleData, owner.address);

      await expect(nft.authorizeUsage(1, user1.address))
        .to.emit(nft, "Authorization")
        .withArgs(1, user1.address);
      let users = await nft.authorizedUsersOf(1);
      expect(users).to.include(user1.address);

      await expect(nft.revokeAuthorization(1, user1.address))
        .to.emit(nft, "AuthorizationRevoked")
        .withArgs(1, user1.address);
      users = await nft.authorizedUsersOf(1);
      expect(users).to.not.include(user1.address);
    });
  });
});
