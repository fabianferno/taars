# @taars/contracts

ERC-7857 Intelligent NFT contracts for **taars**. Each user mints a `TaarsAgentNFT` representing their AI replica. Encrypted model artifacts live on 0G Storage; the INFT stores `IntelligentData[]` referencing those storage hashes.

- Standard: ERC-7857 (Intelligent NFT)
- Token name: `taars`
- Symbol: `TAAR`
- Pattern: UUPS upgradeable proxy (OpenZeppelin)
- Solidity: 0.8.24 (cancun, optimizer 200 runs)
- Default network: 0G testnet (chainId 16602)

## Setup

```bash
pnpm install
cp .env.example .env  # then fill in DEPLOYER_PRIVATE_KEY
```

Environment variables:

- `DEPLOYER_PRIVATE_KEY` -- hex-encoded private key for the deployer.
- `OG_RPC_URL` -- optional. Defaults to `https://evmrpc-testnet.0g.ai`.
- `SEPOLIA_RPC_URL` -- optional. For deploying to Sepolia.

## Commands

```bash
pnpm compile        # compile solidity
pnpm test           # run hardhat tests
pnpm deploy:0g      # deploy UUPS proxy to 0g-testnet
pnpm demo:mint      # mint 3 demo INFTs (vitalik, fabian, balaji)
```

After `deploy:0g`, the proxy address is written to `deployments/og-testnet.json`. `demo:mint` reads from that file.

## Explorer

0G testnet (Galileo) explorer: <https://chainscan-galileo.0g.ai>

## Layout

```
contracts/
  TaarsAgentNFT.sol           # ERC-7857 implementation, UUPS upgradeable
  interfaces/
    IERC7857.sol
    IERC7857DataVerifier.sol
    IERC7857Metadata.sol
scripts/
  deploy.ts                   # deploy UUPS proxy, write deployments/<network>.json
  demo-mint.ts                # mint 3 demo agents
test/
  TaarsAgentNFT.test.ts       # initialize, mint, iTransfer, iClone, authorize/revoke
```

## Notes

- Storage uses ERC-7201 namespaced layout under `taars.storage.TaarsAgentNFT`.
- `iTransfer` emits `Transferred` and `PublishedSealedKey(tokenId, "")`. Real sealed-key delivery happens off-chain via the TEE oracle.
- Only the contract owner can `mint`. Token owners control `iTransfer`, `iClone`, `authorizeUsage`, `revokeAuthorization`, and `delegateAccess` for their tokens.
