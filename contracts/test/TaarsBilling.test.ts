import { expect } from "chai";
import { ethers } from "hardhat";
import type { TaarsBilling, MockUSDC } from "../typechain-types";

const RATE = 6_000_000n; // 6 USDC per minute (6 decimals)
const ONE_HOUR = 3600n;
const TOKEN_ID = 1n;

function sid(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("TaarsBilling", () => {
  async function deploy() {
    const [owner, treasury, oracle, agentOwner, creator, user, other] =
      await ethers.getSigners();

    const Usdc = await ethers.getContractFactory("MockUSDC");
    const usdc = (await Usdc.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();

    const Billing = await ethers.getContractFactory("TaarsBilling");
    const billing = (await Billing.deploy(
      await usdc.getAddress(),
      treasury.address,
      oracle.address,
      owner.address
    )) as unknown as TaarsBilling;
    await billing.waitForDeployment();

    // fund the user with mUSDC and approve billing
    const seed = ethers.parseUnits("1000", 6);
    await usdc.mint(user.address, seed);
    await usdc
      .connect(user)
      .approve(await billing.getAddress(), ethers.MaxUint256);

    // Off-chain (oracle-attested) ownership tracking. The contract no longer
    // reads ERC721 ownership; the oracle is the source of truth.
    let inftOwner: string = agentOwner.address;

    return {
      usdc,
      billing,
      owner,
      treasury,
      oracle,
      agentOwner,
      creator,
      user,
      other,
      getInftOwner: () => inftOwner,
      setInftOwner: (addr: string) => {
        inftOwner = addr;
      },
    };
  }

  describe("setRate", () => {
    it("only callable by oracle", async () => {
      const { billing, oracle, other } = await deploy();
      await expect(
        billing.connect(other).setRate(TOKEN_ID, RATE)
      ).to.be.revertedWith("TaarsBilling: not oracle");

      await expect(billing.connect(oracle).setRate(TOKEN_ID, RATE))
        .to.emit(billing, "RateSet")
        .withArgs(TOKEN_ID, RATE);

      expect(await billing.ratePerMinute(TOKEN_ID)).to.equal(RATE);
    });
  });

  describe("startSession", () => {
    it("records snapshot rate; cannot reuse sessionId", async () => {
      const { billing, oracle, user } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      const sessionId = sid("session-1");
      await expect(billing.connect(user).startSession(sessionId, TOKEN_ID))
        .to.emit(billing, "SessionStarted")
        .withArgs(sessionId, TOKEN_ID, user.address, RATE);

      const s = await billing.getSession(sessionId);
      expect(s.tokenId).to.equal(TOKEN_ID);
      expect(s.caller).to.equal(user.address);
      expect(s.ratePerMinute).to.equal(RATE);
      expect(s.settled).to.equal(false);

      // bumping the rate after start does NOT affect the snapshot
      await billing.connect(oracle).setRate(TOKEN_ID, RATE * 10n);
      const s2 = await billing.getSession(sessionId);
      expect(s2.ratePerMinute).to.equal(RATE);

      // cannot reuse sessionId
      await expect(
        billing.connect(user).startSession(sessionId, TOKEN_ID)
      ).to.be.revertedWith("TaarsBilling: session exists");
    });
  });

  describe("settleSession", () => {
    it("only callable by oracle", async () => {
      const { billing, oracle, user, other } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);
      const sessionId = sid("session-only-oracle");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);

      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      await expect(
        billing.connect(other).settleSession(sessionId, endedAt)
      ).to.be.revertedWith("TaarsBilling: not oracle");
    });

    it("transfers correct amount and splits 90/7/3 with creator set", async () => {
      const { billing, owner, oracle, creator, user, usdc, treasury } =
        await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);
      await billing.connect(owner).setCreator(TOKEN_ID, creator.address);

      const sessionId = sid("session-split-90-7-3");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR; // exactly 60 minutes
      const expected = RATE * 60n; // 360_000_000 (360 mUSDC)

      const toTreasury = (expected * 700n) / 10000n;
      const toCreator = (expected * 300n) / 10000n;
      const toOwner = expected - toTreasury - toCreator;

      const userBefore = await usdc.balanceOf(user.address);

      await expect(billing.connect(oracle).settleSession(sessionId, endedAt))
        .to.emit(billing, "SessionSettled")
        .withArgs(
          sessionId,
          TOKEN_ID,
          user.address,
          expected,
          toOwner,
          toTreasury,
          toCreator,
          ONE_HOUR
        );

      const userAfter = await usdc.balanceOf(user.address);
      expect(userBefore - userAfter).to.equal(expected);
      expect(await usdc.balanceOf(await billing.getAddress())).to.equal(expected);

      expect(await billing.ownerBalance(TOKEN_ID)).to.equal(toOwner);
      expect(await billing.treasuryBalance()).to.equal(toTreasury);
      expect(await billing.creatorBalance(creator.address)).to.equal(toCreator);

      // sanity: 90 / 7 / 3
      expect(toOwner).to.equal((expected * 9000n) / 10000n);
      expect(toTreasury).to.equal((expected * 700n) / 10000n);
      expect(toCreator).to.equal((expected * 300n) / 10000n);

      // treasury wallet receives only on claim; balance still 0
      expect(await usdc.balanceOf(treasury.address)).to.equal(0n);

      // double-settle prevented
      await expect(
        billing.connect(oracle).settleSession(sessionId, endedAt)
      ).to.be.revertedWith("TaarsBilling: already settled");
    });

    it("with no creator, the 3% folds into owner share (effectively 93/7/0)", async () => {
      const { billing, oracle, user } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      const sessionId = sid("session-no-creator");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      const expected = RATE * 60n;

      const toTreasury = (expected * 700n) / 10000n;
      const toOwnerExpected = expected - toTreasury; // 93%

      await expect(billing.connect(oracle).settleSession(sessionId, endedAt))
        .to.emit(billing, "SessionSettled")
        .withArgs(
          sessionId,
          TOKEN_ID,
          user.address,
          expected,
          toOwnerExpected,
          toTreasury,
          0n,
          ONE_HOUR
        );

      expect(await billing.ownerBalance(TOKEN_ID)).to.equal(toOwnerExpected);
      expect(await billing.treasuryBalance()).to.equal(toTreasury);
    });

    it("rejects unknown session and endedAt < startedAt", async () => {
      const { billing, oracle, user } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      await expect(
        billing.connect(oracle).settleSession(sid("missing"), 1n)
      ).to.be.revertedWith("TaarsBilling: unknown session");

      const sessionId = sid("session-bad-end");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      await expect(
        billing.connect(oracle).settleSession(sessionId, s.startedAt - 1n)
      ).to.be.revertedWith("TaarsBilling: endedAt<startedAt");
    });

    it("partial-minute duration prorates by seconds (rate * seconds / 60)", async () => {
      const { billing, oracle, user } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      const sessionId = sid("session-30s");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + 30n;
      const expected = (RATE * 30n) / 60n; // half a minute

      await billing.connect(oracle).settleSession(sessionId, endedAt);
      const after = await billing.getSession(sessionId);
      expect(after.paid).to.equal(expected);
    });
  });

  describe("claimRevenueFor", () => {
    it("oracle pays the verified INFT owner (mirrors post-transfer ownership)", async () => {
      const {
        billing,
        oracle,
        user,
        usdc,
        other,
        setInftOwner,
        getInftOwner,
      } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      const sessionId = sid("session-claim");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      await billing.connect(oracle).settleSession(sessionId, endedAt);

      const expected = RATE * 60n;
      const toOwner = (expected * 9300n) / 10000n; // no creator set => 93%
      expect(await billing.ownerBalance(TOKEN_ID)).to.equal(toOwner);

      // off-chain "transfer" of INFT to `other` BEFORE claim — oracle reads
      // canonical 0G ownership and supplies `other`.
      setInftOwner(other.address);

      const before = await usdc.balanceOf(other.address);
      await expect(
        billing.connect(oracle).claimRevenueFor(TOKEN_ID, getInftOwner())
      )
        .to.emit(billing, "RevenueClaimed")
        .withArgs(TOKEN_ID, other.address, toOwner);

      const after = await usdc.balanceOf(other.address);
      expect(after - before).to.equal(toOwner);
      expect(await billing.ownerBalance(TOKEN_ID)).to.equal(0n);

      await expect(
        billing.connect(oracle).claimRevenueFor(TOKEN_ID, getInftOwner())
      ).to.be.revertedWith("TaarsBilling: nothing to claim");
    });

    it("only callable by oracle; rejects zero owner", async () => {
      const { billing, oracle, agentOwner, other } = await deploy();
      await expect(
        billing.connect(other).claimRevenueFor(TOKEN_ID, agentOwner.address)
      ).to.be.revertedWith("TaarsBilling: not oracle");

      await expect(
        billing.connect(oracle).claimRevenueFor(TOKEN_ID, ethers.ZeroAddress)
      ).to.be.revertedWith("TaarsBilling: owner=0");
    });
  });

  describe("claimCreatorRoyalty", () => {
    it("pays the creator address", async () => {
      const { billing, owner, oracle, creator, user, usdc } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);
      await billing.connect(owner).setCreator(TOKEN_ID, creator.address);

      const sessionId = sid("session-royalty");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      await billing.connect(oracle).settleSession(sessionId, endedAt);

      const expected = RATE * 60n;
      const toCreator = (expected * 300n) / 10000n;

      const before = await usdc.balanceOf(creator.address);
      await expect(billing.connect(creator).claimCreatorRoyalty())
        .to.emit(billing, "CreatorRoyaltyClaimed")
        .withArgs(creator.address, toCreator);
      const after = await usdc.balanceOf(creator.address);
      expect(after - before).to.equal(toCreator);
      expect(await billing.creatorBalance(creator.address)).to.equal(0n);
    });
  });

  describe("claimTreasury", () => {
    it("only owner; pays accrued treasury balance to `to`", async () => {
      const { billing, owner, oracle, user, usdc, other } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);

      const sessionId = sid("session-treasury");
      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      await billing.connect(oracle).settleSession(sessionId, endedAt);

      const expected = RATE * 60n;
      const toTreasury = (expected * 700n) / 10000n;

      await expect(
        billing.connect(other).claimTreasury(other.address)
      ).to.be.revertedWithCustomError(billing, "OwnableUnauthorizedAccount");

      const before = await usdc.balanceOf(other.address);
      await expect(billing.connect(owner).claimTreasury(other.address))
        .to.emit(billing, "TreasuryClaimed")
        .withArgs(other.address, toTreasury);
      const after = await usdc.balanceOf(other.address);
      expect(after - before).to.equal(toTreasury);
      expect(await billing.treasuryBalance()).to.equal(0n);
    });
  });

  describe("round trip", () => {
    it("approve + start + settle + claim — verify USDC balances", async () => {
      const {
        billing,
        owner,
        oracle,
        agentOwner,
        creator,
        user,
        usdc,
        treasury,
        getInftOwner,
      } = await deploy();
      await billing.connect(oracle).setRate(TOKEN_ID, RATE);
      await billing.connect(owner).setCreator(TOKEN_ID, creator.address);

      const sessionId = sid("session-roundtrip");
      const userBefore = await usdc.balanceOf(user.address);

      await billing.connect(user).startSession(sessionId, TOKEN_ID);
      const s = await billing.getSession(sessionId);
      const endedAt = s.startedAt + ONE_HOUR;
      await billing.connect(oracle).settleSession(sessionId, endedAt);

      const expected = RATE * 60n;
      const toTreasury = (expected * 700n) / 10000n;
      const toCreator = (expected * 300n) / 10000n;
      const toOwner = expected - toTreasury - toCreator;

      // claim everything
      await billing.connect(oracle).claimRevenueFor(TOKEN_ID, getInftOwner());
      await billing.connect(creator).claimCreatorRoyalty();
      await billing.connect(owner).claimTreasury(treasury.address);

      const userAfter = await usdc.balanceOf(user.address);
      expect(userBefore - userAfter).to.equal(expected);

      expect(await usdc.balanceOf(agentOwner.address)).to.equal(toOwner);
      expect(await usdc.balanceOf(creator.address)).to.equal(toCreator);
      expect(await usdc.balanceOf(treasury.address)).to.equal(toTreasury);

      // contract should be empty
      expect(
        await usdc.balanceOf(await billing.getAddress())
      ).to.equal(0n);
    });
  });
});
