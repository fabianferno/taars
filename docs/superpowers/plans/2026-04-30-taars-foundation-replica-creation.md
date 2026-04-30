# taars Plan 1 — Foundation & Replica Creation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get from empty repo to a working "create your AI replica" flow — voice + personality input, encrypted artifacts on 0G Storage, INFT minted on 0G Chain, ENS subname registered on Base with text records pointing at everything.

**Architecture:** pnpm monorepo. `apps/web` is a Next.js 14 PWA with Privy embedded wallet. `apps/server` is a Hono backend that orchestrates the create pipeline (voice training mock → encrypt → upload to 0G Storage → mint INFT → register ENS subname). `packages/contracts` holds Foundry-managed Solidity. `packages/sdk` is shared TypeScript types/ABIs.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, Privy, wagmi/viem, Foundry, OpenZeppelin, @0gfoundation/0g-ts-sdk, Hono, ElevenLabs (voice mock), Namestone (ENS L2 subnames on Base), Vitest.

**Hackathon pragmatism:** TDD for contracts (where bugs are expensive). Build-then-verify for UI (where iteration is the right loop). Frequent commits. Shipping > perfect tests.

---

## File Structure

```
taars/
├── apps/
│   ├── web/                            # Next.js 14 PWA
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root + providers
│   │   │   ├── page.tsx                # Home
│   │   │   ├── create/page.tsx         # Create wizard
│   │   │   ├── [ensName]/page.tsx      # Replica profile
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── providers.tsx           # Privy + wagmi
│   │   │   ├── voice-recorder.tsx
│   │   │   ├── personality-form.tsx
│   │   │   ├── create-wizard.tsx
│   │   │   └── ui/                     # shadcn/ui
│   │   ├── lib/
│   │   │   ├── env.ts
│   │   │   ├── api.ts                  # Backend client
│   │   │   └── ens.ts                  # ENS resolution helpers
│   │   ├── public/
│   │   │   ├── manifest.webmanifest
│   │   │   └── icons/
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── server/                         # Hono backend
│       ├── src/
│       │   ├── index.ts                # Server entry
│       │   ├── env.ts
│       │   ├── routes/
│       │   │   ├── mint.ts             # POST /mint orchestration
│       │   │   └── health.ts
│       │   └── services/
│       │       ├── voice.ts            # ElevenLabs adapter
│       │       ├── encrypt.ts          # AES-GCM
│       │       ├── storage.ts          # 0G Storage upload
│       │       ├── inft.ts             # INFT mint via viem
│       │       └── ens.ts              # Namestone subname + text records
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── contracts/                      # Foundry
│   │   ├── src/
│   │   │   ├── TaarsINFT.sol
│   │   │   └── TaarsENS.sol            # On-chain registry of ENS->INFT (Base)
│   │   ├── test/
│   │   │   ├── TaarsINFT.t.sol
│   │   │   └── TaarsENS.t.sol
│   │   ├── script/
│   │   │   ├── DeployINFT.s.sol
│   │   │   └── DeployTaarsENS.s.sol
│   │   ├── foundry.toml
│   │   └── remappings.txt
│   └── sdk/                            # Shared TS types/ABIs
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   └── abi/                    # Generated ABIs
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

---

## Task 1: Repo Scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `README.md`

- [ ] **Step 1: Initialize git repo (if needed)**

```bash
cd /Users/fabianferno/Documents/taars
git status >/dev/null 2>&1 || git init
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "taars",
  "private": true,
  "version": "0.0.1",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "pnpm --parallel --recursive --filter './apps/*' dev",
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test",
    "lint": "pnpm --recursive lint",
    "contracts:test": "cd packages/contracts && forge test -vvv",
    "contracts:build": "cd packages/contracts && forge build"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
out/
coverage/
.turbo/
.DS_Store

# Foundry
packages/contracts/cache/
packages/contracts/out/
packages/contracts/broadcast/
```

- [ ] **Step 5: Create .env.example**

```
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=

# Chains
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_OG_CHAIN_ID=16601
NEXT_PUBLIC_BASE_CHAIN_ID=84532

# Server-side
SERVER_PRIVATE_KEY=
ELEVENLABS_API_KEY=
NAMESTONE_API_KEY=
NAMESTONE_DOMAIN=taars.eth
TAARS_INFT_ADDRESS=
TAARS_ENS_ADDRESS=

# Backend
SERVER_PORT=8080
ENCRYPTION_KEY=  # 32-byte hex
```

- [ ] **Step 6: Create README.md**

```markdown
# taars

Creator-owned AI replicas — INFT on 0G Chain, ENS identity on Base, KeeperHub-orchestrated billing.

See `prd.md` for the full product spec.

## Setup

```bash
pnpm install
cp .env.example .env
# fill in secrets
pnpm contracts:build
pnpm dev
```
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore .env.example README.md
git commit -m "feat: initial pnpm monorepo scaffold"
```

---

## Task 2: Foundry Project Init

**Files:**
- Create: `packages/contracts/foundry.toml`, `packages/contracts/remappings.txt`, `packages/contracts/.gitignore`

- [ ] **Step 1: Initialize Foundry project**

```bash
mkdir -p packages/contracts && cd packages/contracts
forge init --no-git --no-commit --force .
rm -rf src/Counter.sol test/Counter.t.sol script/Counter.s.sol README.md
```

- [ ] **Step 2: Install OpenZeppelin contracts**

```bash
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
```

- [ ] **Step 3: Write foundry.toml**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
fs_permissions = [{ access = "read-write", path = "./" }]

[rpc_endpoints]
og_testnet = "${OG_RPC_URL}"
base_sepolia = "${BASE_RPC_URL}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

- [ ] **Step 4: Write remappings.txt**

```
@openzeppelin/=lib/openzeppelin-contracts/
forge-std/=lib/forge-std/src/
```

- [ ] **Step 5: Verify forge build works**

Run: `cd packages/contracts && forge build`
Expected: `Compiler run successful` (no source files yet — clean exit).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): initialize foundry project with OZ"
```

---

## Task 3: TaarsINFT Contract (ERC-7857-style)

**Files:**
- Create: `packages/contracts/src/TaarsINFT.sol`
- Test: `packages/contracts/test/TaarsINFT.t.sol`

> ERC-7857 is still being standardized. We implement an ERC-721 with the iNFT-essential extensions: encrypted metadata URI, secure transfer hook (oracle-mediated re-encryption), authorized usage, clone. For the hackathon, we keep it minimal but real.

- [ ] **Step 1: Write the failing test**

```solidity
// packages/contracts/test/TaarsINFT.t.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TaarsINFT} from "../src/TaarsINFT.sol";

contract TaarsINFTTest is Test {
    TaarsINFT inft;
    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address oracle = address(0x0CA1E);

    function setUp() public {
        inft = new TaarsINFT("taars", "TAAR", oracle);
    }

    function test_mint_setsEncryptedURIAndOwner() public {
        uint256 tokenId = inft.mint(alice, "0g:storage:0xMERKLE", "voice-v1");
        assertEq(inft.ownerOf(tokenId), alice);
        assertEq(inft.encryptedURI(tokenId), "0g:storage:0xMERKLE");
        assertEq(inft.modelVersion(tokenId), "voice-v1");
    }

    function test_directTransfer_revertsWithoutOracle() public {
        uint256 tokenId = inft.mint(alice, "0g:storage:0xMERKLE", "voice-v1");
        vm.prank(alice);
        vm.expectRevert(TaarsINFT.UseSecureTransfer.selector);
        inft.transferFrom(alice, bob, tokenId);
    }

    function test_secureTransfer_updatesOwnerAndURI() public {
        uint256 tokenId = inft.mint(alice, "0g:storage:0xOLD", "voice-v1");
        vm.prank(oracle);
        inft.secureTransfer(alice, bob, tokenId, "0g:storage:0xNEW");
        assertEq(inft.ownerOf(tokenId), bob);
        assertEq(inft.encryptedURI(tokenId), "0g:storage:0xNEW");
    }

    function test_secureTransfer_onlyOracle() public {
        uint256 tokenId = inft.mint(alice, "0g:storage:0xOLD", "voice-v1");
        vm.prank(bob);
        vm.expectRevert(TaarsINFT.OnlyOracle.selector);
        inft.secureTransfer(alice, bob, tokenId, "0g:storage:0xNEW");
    }

    function test_authorizeUsage_grantsTimeBoundedAccess() public {
        uint256 tokenId = inft.mint(alice, "0g:storage:0xMERKLE", "voice-v1");
        uint64 expiresAt = uint64(block.timestamp + 1 days);
        vm.prank(alice);
        inft.authorizeUsage(tokenId, bob, expiresAt);
        assertTrue(inft.isAuthorized(tokenId, bob));
        vm.warp(block.timestamp + 2 days);
        assertFalse(inft.isAuthorized(tokenId, bob));
    }
}
```

- [ ] **Step 2: Run the test (expect compile failure)**

Run: `cd packages/contracts && forge test -vvv`
Expected: Compilation error — `TaarsINFT` does not exist yet.

- [ ] **Step 3: Write the contract**

```solidity
// packages/contracts/src/TaarsINFT.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TaarsINFT — ERC-7857-style INFT for AI replicas.
/// @notice Encrypted metadata pointer (0G Storage merkle root). Direct transfers disabled;
///         transfers go through the oracle which re-encrypts metadata for the new owner.
contract TaarsINFT is ERC721, Ownable {
    error UseSecureTransfer();
    error OnlyOracle();
    error NotOwner();

    address public oracle;
    uint256 private _nextId = 1;

    mapping(uint256 => string) private _encryptedURI;
    mapping(uint256 => string) private _modelVersion;
    mapping(uint256 => mapping(address => uint64)) private _authorizedUntil;

    event Minted(uint256 indexed tokenId, address indexed to, string encryptedURI);
    event SecureTransferred(uint256 indexed tokenId, address indexed from, address indexed to, string newURI);
    event UsageAuthorized(uint256 indexed tokenId, address indexed user, uint64 expiresAt);

    constructor(string memory name_, string memory symbol_, address oracle_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {
        oracle = oracle_;
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
    }

    function mint(address to, string calldata encryptedURI_, string calldata modelVersion_)
        external
        returns (uint256 tokenId)
    {
        tokenId = _nextId++;
        _safeMint(to, tokenId);
        _encryptedURI[tokenId] = encryptedURI_;
        _modelVersion[tokenId] = modelVersion_;
        emit Minted(tokenId, to, encryptedURI_);
    }

    /// @notice Disable direct transfers; force secure path through oracle.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && msg.sender != oracle) {
            revert UseSecureTransfer();
        }
        return super._update(to, tokenId, auth);
    }

    /// @notice Oracle-mediated transfer: oracle re-encrypts metadata, updates URI, transfers token.
    function secureTransfer(address from, address to, uint256 tokenId, string calldata newURI) external {
        if (msg.sender != oracle) revert OnlyOracle();
        _encryptedURI[tokenId] = newURI;
        _safeTransfer(from, to, tokenId, "");
        emit SecureTransferred(tokenId, from, to, newURI);
    }

    function authorizeUsage(uint256 tokenId, address user, uint64 expiresAt) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        _authorizedUntil[tokenId][user] = expiresAt;
        emit UsageAuthorized(tokenId, user, expiresAt);
    }

    function isAuthorized(uint256 tokenId, address user) external view returns (bool) {
        return _authorizedUntil[tokenId][user] > block.timestamp;
    }

    function encryptedURI(uint256 tokenId) external view returns (string memory) {
        return _encryptedURI[tokenId];
    }

    function modelVersion(uint256 tokenId) external view returns (string memory) {
        return _modelVersion[tokenId];
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test -vvv --match-contract TaarsINFTTest`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/TaarsINFT.sol packages/contracts/test/TaarsINFT.t.sol
git commit -m "feat(contracts): TaarsINFT (ERC-7857-style) with oracle transfer + leasing"
```

---

## Task 4: TaarsENS Registry Contract (Base)

> Namestone handles the actual ENS subname registration via API. `TaarsENS` is an on-chain registry that stores the canonical mapping ENS-name → INFT token ID + storage root. This gives us composability — any contract can resolve `vitalik.taars.eth` to the INFT without trusting Namestone.

**Files:**
- Create: `packages/contracts/src/TaarsENS.sol`
- Test: `packages/contracts/test/TaarsENS.t.sol`

- [ ] **Step 1: Write the failing test**

```solidity
// packages/contracts/test/TaarsENS.t.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TaarsENS} from "../src/TaarsENS.sol";

contract TaarsENSTest is Test {
    TaarsENS reg;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address operator = address(0x0FF1CE);

    function setUp() public {
        reg = new TaarsENS(operator);
    }

    function test_register_stores_record() public {
        vm.prank(operator);
        reg.register("alice", alice, 42, "0g:storage:0xMERKLE");
        TaarsENS.Record memory r = reg.recordOf("alice");
        assertEq(r.owner, alice);
        assertEq(r.tokenId, 42);
        assertEq(r.storageRoot, "0g:storage:0xMERKLE");
    }

    function test_register_revertsOnDuplicate() public {
        vm.prank(operator);
        reg.register("alice", alice, 42, "0g:storage:0xMERKLE");
        vm.prank(operator);
        vm.expectRevert(TaarsENS.NameTaken.selector);
        reg.register("alice", bob, 43, "0g:storage:0xOTHER");
    }

    function test_register_onlyOperator() public {
        vm.prank(alice);
        vm.expectRevert(TaarsENS.NotOperator.selector);
        reg.register("alice", alice, 42, "0g:storage:0xMERKLE");
    }

    function test_setText_writesAndReads() public {
        vm.prank(operator);
        reg.register("alice", alice, 42, "0g:storage:0xMERKLE");
        vm.prank(alice);
        reg.setText("alice", "taars.price", "0.10");
        assertEq(reg.text("alice", "taars.price"), "0.10");
    }

    function test_setText_onlyNameOwner() public {
        vm.prank(operator);
        reg.register("alice", alice, 42, "0g:storage:0xMERKLE");
        vm.prank(bob);
        vm.expectRevert(TaarsENS.NotNameOwner.selector);
        reg.setText("alice", "taars.price", "0.10");
    }
}
```

- [ ] **Step 2: Run test (expect compile failure)**

Run: `cd packages/contracts && forge test --match-contract TaarsENSTest`
Expected: Compile failure.

- [ ] **Step 3: Write the contract**

```solidity
// packages/contracts/src/TaarsENS.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TaarsENS — on-chain registry mirroring ENS subnames to INFT/storage refs.
/// @notice The actual ENS subname is registered offchain via Namestone; this gives an on-chain
///         canonical record for composability (other contracts/agents can resolve names).
contract TaarsENS is Ownable {
    error NameTaken();
    error NotOperator();
    error NotNameOwner();
    error UnknownName();

    struct Record {
        address owner;
        uint256 tokenId;
        string storageRoot;
        uint64 createdAt;
    }

    address public operator;
    mapping(string => Record) private _records;
    mapping(string => mapping(string => string)) private _text;

    event Registered(string indexed label, address indexed owner, uint256 indexed tokenId, string storageRoot);
    event TextSet(string indexed label, string key, string value);

    constructor(address operator_) Ownable(msg.sender) {
        operator = operator_;
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
    }

    function register(string calldata label, address owner_, uint256 tokenId, string calldata storageRoot)
        external
    {
        if (msg.sender != operator) revert NotOperator();
        if (_records[label].owner != address(0)) revert NameTaken();
        _records[label] = Record({
            owner: owner_,
            tokenId: tokenId,
            storageRoot: storageRoot,
            createdAt: uint64(block.timestamp)
        });
        emit Registered(label, owner_, tokenId, storageRoot);
    }

    function setText(string calldata label, string calldata key, string calldata value) external {
        Record storage r = _records[label];
        if (r.owner == address(0)) revert UnknownName();
        if (r.owner != msg.sender) revert NotNameOwner();
        _text[label][key] = value;
        emit TextSet(label, key, value);
    }

    function recordOf(string calldata label) external view returns (Record memory) {
        return _records[label];
    }

    function text(string calldata label, string calldata key) external view returns (string memory) {
        return _text[label][key];
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd packages/contracts && forge test --match-contract TaarsENSTest -vvv`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/TaarsENS.sol packages/contracts/test/TaarsENS.t.sol
git commit -m "feat(contracts): TaarsENS on-chain registry mirror"
```

---

## Task 5: Deploy Scripts

**Files:**
- Create: `packages/contracts/script/DeployINFT.s.sol`, `packages/contracts/script/DeployTaarsENS.s.sol`

- [ ] **Step 1: Write DeployINFT script**

```solidity
// packages/contracts/script/DeployINFT.s.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TaarsINFT} from "../src/TaarsINFT.sol";

contract DeployINFT is Script {
    function run() external returns (TaarsINFT inft) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        vm.startBroadcast(pk);
        inft = new TaarsINFT("taars", "TAAR", oracle);
        vm.stopBroadcast();
        console2.log("TaarsINFT deployed:", address(inft));
    }
}
```

- [ ] **Step 2: Write DeployTaarsENS script**

```solidity
// packages/contracts/script/DeployTaarsENS.s.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TaarsENS} from "../src/TaarsENS.sol";

contract DeployTaarsENS is Script {
    function run() external returns (TaarsENS reg) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        vm.startBroadcast(pk);
        reg = new TaarsENS(operator);
        vm.stopBroadcast();
        console2.log("TaarsENS deployed:", address(reg));
    }
}
```

- [ ] **Step 3: Verify scripts compile**

Run: `cd packages/contracts && forge build`
Expected: Successful build.

- [ ] **Step 4: Document deploy commands in contracts/README.md**

Create `packages/contracts/README.md`:

```markdown
# taars contracts

## Deploy to 0G testnet (TaarsINFT)
```bash
DEPLOYER_PK=0x... ORACLE_ADDRESS=0x... \
forge script script/DeployINFT.s.sol --rpc-url $OG_RPC_URL --broadcast
```

## Deploy to Base Sepolia (TaarsENS)
```bash
DEPLOYER_PK=0x... OPERATOR_ADDRESS=0x... \
forge script script/DeployTaarsENS.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
```

After deploy, update `.env` at repo root with the addresses.
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/script packages/contracts/README.md
git commit -m "feat(contracts): deploy scripts for INFT (0G) and ENS registry (Base)"
```

---

## Task 6: SDK Package (Shared Types + ABIs)

**Files:**
- Create: `packages/sdk/package.json`, `packages/sdk/tsconfig.json`, `packages/sdk/src/index.ts`, `packages/sdk/src/types.ts`, `packages/sdk/src/abi/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@taars/sdk",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "abi:gen": "node scripts/gen-abi.mjs"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write shared types**

```typescript
// packages/sdk/src/types.ts
export type EnsLabel = string; // e.g. "alice"

export interface ReplicaRecord {
  label: EnsLabel;
  owner: `0x${string}`;
  tokenId: bigint;
  storageRoot: string;
  createdAt: number;
}

export interface ReplicaTextRecords {
  'taars.inft'?: string;
  'taars.storage'?: string;
  'taars.created'?: string;
  'taars.version'?: string;
  'taars.price'?: string;
  'taars.currency'?: string;
  'taars.network'?: string;
  'taars.voice'?: string;
  'taars.deploy.discord'?: string;
  avatar?: string;
  description?: string;
  url?: string;
}

export interface PersonalityAnswers {
  vibe: string;       // "warm and direct" / "playful and curious" / etc.
  expertise: string;
  catchphrases: string;
  avoid: string;
  example1Q: string;
  example1A: string;
  example2Q: string;
  example2A: string;
  example3Q: string;
  example3A: string;
}

export interface MintRequest {
  ensLabel: string;            // "alice"
  ownerAddress: `0x${string}`;
  voiceSampleBase64: string;   // raw mic recording (webm/mp3)
  personality: PersonalityAnswers;
  pricePerMinUsd: string;      // "0.10"
}

export interface MintResponse {
  ok: true;
  tokenId: string;
  storageRoot: string;
  ensLabel: string;
  voiceProfileId: string;
  txInft: string;
  txEns: string;
}
```

- [ ] **Step 4: Write index.ts**

```typescript
// packages/sdk/src/index.ts
export * from './types.js';
export * as abi from './abi/index.js';
```

- [ ] **Step 5: Generate ABIs from Foundry artifacts**

Create `packages/sdk/scripts/gen-abi.mjs`:

```javascript
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('../contracts/out');
const targets = ['TaarsINFT.sol/TaarsINFT.json', 'TaarsENS.sol/TaarsENS.json'];
const outDir = path.resolve('src/abi');
fs.mkdirSync(outDir, { recursive: true });

const exports = [];
for (const t of targets) {
  const name = path.basename(t, '.json');
  const json = JSON.parse(fs.readFileSync(path.join(root, t), 'utf8'));
  fs.writeFileSync(
    path.join(outDir, `${name}.ts`),
    `export const ${name}Abi = ${JSON.stringify(json.abi, null, 2)} as const;\n`
  );
  exports.push(`export * from './${name}.js';`);
}
fs.writeFileSync(path.join(outDir, 'index.ts'), exports.join('\n') + '\n');
console.log('ABIs generated.');
```

- [ ] **Step 6: Run ABI generation**

Run: `cd packages/contracts && forge build && cd ../sdk && node scripts/gen-abi.mjs`
Expected: `ABIs generated.` and files in `packages/sdk/src/abi/`.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk
git commit -m "feat(sdk): shared types + abi generation script"
```

---

## Task 7: Backend Scaffold (Hono Server)

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/index.ts`, `apps/server/src/env.ts`, `apps/server/src/routes/health.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@taars/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "hono": "^4.6.0",
    "viem": "^2.21.0",
    "zod": "^3.23.8",
    "@taars/sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create env.ts**

```typescript
// apps/server/src/env.ts
import { z } from 'zod';

const schema = z.object({
  SERVER_PORT: z.coerce.number().default(8080),
  SERVER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ELEVENLABS_API_KEY: z.string().min(1),
  NAMESTONE_API_KEY: z.string().min(1),
  NAMESTONE_DOMAIN: z.string().default('taars.eth'),
  TAARS_INFT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  TAARS_ENS_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  OG_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  OG_INDEXER_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export const env = schema.parse(process.env);
```

- [ ] **Step 4: Create health route**

```typescript
// apps/server/src/routes/health.ts
import { Hono } from 'hono';

export const health = new Hono();

health.get('/', (c) => c.json({ ok: true, ts: Date.now() }));
```

- [ ] **Step 5: Create server entry**

```typescript
// apps/server/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env.js';
import { health } from './routes/health.js';

const app = new Hono();

app.use('*', cors());
app.route('/health', health);

const port = env.SERVER_PORT;
console.log(`taars server listening on :${port}`);
serve({ fetch: app.fetch, port });
```

- [ ] **Step 6: Verify it starts**

Run: `pnpm install && cd apps/server && pnpm dev`
Expected: `taars server listening on :8080`. Then `curl localhost:8080/health` → `{"ok":true,"ts":...}`.

- [ ] **Step 7: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): hono scaffold with health route + zod env"
```

---

## Task 8: Encryption Service (AES-GCM)

**Files:**
- Create: `apps/server/src/services/encrypt.ts`
- Test: `apps/server/src/services/encrypt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/services/encrypt.test.ts
import { describe, it, expect } from 'vitest';
import { encryptBlob, decryptBlob } from './encrypt.js';

const KEY = 'a'.repeat(64); // 32-byte hex

describe('encryptBlob / decryptBlob', () => {
  it('roundtrips arbitrary bytes', async () => {
    const plain = new TextEncoder().encode('hello taars');
    const cipher = await encryptBlob(plain, KEY);
    const round = await decryptBlob(cipher, KEY);
    expect(new TextDecoder().decode(round)).toBe('hello taars');
  });

  it('produces ciphertext different from plaintext', async () => {
    const plain = new TextEncoder().encode('hello taars');
    const cipher = await encryptBlob(plain, KEY);
    expect(Buffer.from(cipher).toString('hex')).not.toBe(Buffer.from(plain).toString('hex'));
  });

  it('different IV per call', async () => {
    const plain = new TextEncoder().encode('repeat');
    const a = await encryptBlob(plain, KEY);
    const b = await encryptBlob(plain, KEY);
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });
});
```

- [ ] **Step 2: Run (expect failure — module doesn't exist)**

Add `vitest.config.ts` to `apps/server`:

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

Run: `cd apps/server && pnpm exec vitest run`
Expected: Module not found.

- [ ] **Step 3: Implement encrypt.ts**

```typescript
// apps/server/src/services/encrypt.ts
import { webcrypto } from 'node:crypto';

const IV_LEN = 12;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return webcrypto.subtle.importKey(
    'raw',
    hexToBytes(hexKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/// Returns: IV (12 bytes) || ciphertext+tag.
export async function encryptBlob(plaintext: Uint8Array, hexKey: string): Promise<Uint8Array> {
  const key = await importKey(hexKey);
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

export async function decryptBlob(packed: Uint8Array, hexKey: string): Promise<Uint8Array> {
  const key = await importKey(hexKey);
  const iv = packed.slice(0, IV_LEN);
  const ct = packed.slice(IV_LEN);
  const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/server && pnpm exec vitest run`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/encrypt.ts apps/server/src/services/encrypt.test.ts apps/server/vitest.config.ts
git commit -m "feat(server): AES-GCM blob encryption service"
```

---

## Task 9: Voice Service (ElevenLabs Adapter)

**Files:**
- Create: `apps/server/src/services/voice.ts`

> The voice service is mocked-but-real: we send the user's voice samples to ElevenLabs Voice Cloning API, which returns a voice_id we can use for synth. In the demo narrative, this represents what 0G Compute would do: take voice samples, return voice profile artifacts.

- [ ] **Step 1: Write the service**

```typescript
// apps/server/src/services/voice.ts
import { env } from '../env.js';

export interface VoiceProfile {
  voiceId: string;
  provider: 'elevenlabs';
  modelVersion: string;
}

/// Train a voice profile from a single mic sample.
/// In production this would call 0G Compute (TEE fine-tune).
export async function trainVoiceProfile(
  ensLabel: string,
  sampleBytes: Uint8Array
): Promise<VoiceProfile> {
  const form = new FormData();
  form.append('name', `taars-${ensLabel}`);
  form.append('description', `Voice profile for ${ensLabel}.taars.eth`);
  form.append('files', new Blob([sampleBytes], { type: 'audio/webm' }), 'sample.webm');

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs voice add failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { voice_id: string };
  return {
    voiceId: json.voice_id,
    provider: 'elevenlabs',
    modelVersion: 'eleven_turbo_v2_5',
  };
}

/// Synthesize speech in the cloned voice.
export async function synthesize(voiceId: string, text: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/server && pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/voice.ts
git commit -m "feat(server): voice training adapter (ElevenLabs, narrated as 0G Compute)"
```

---

## Task 10: 0G Storage Service

**Files:**
- Create: `apps/server/src/services/storage.ts`
- Modify: `apps/server/package.json` (add `@0glabs/0g-ts-sdk` dep)

- [ ] **Step 1: Add 0G SDK dependency**

```bash
cd apps/server && pnpm add @0glabs/0g-ts-sdk
```

- [ ] **Step 2: Write the service**

```typescript
// apps/server/src/services/storage.ts
import { Indexer, MemData, getFlowContract } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { env } from '../env.js';

const FLOW_CONTRACT = '0xbD2C3F0E65eDF5582141C35969d66e34629cC768'; // 0G testnet flow

export interface UploadResult {
  merkleRoot: string;
  txHash: string;
}

/// Upload encrypted bytes to 0G Storage and return the merkle root URI.
export async function uploadToZeroG(payload: Uint8Array): Promise<UploadResult> {
  const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL);
  const signer = new ethers.Wallet(env.SERVER_PRIVATE_KEY, provider);

  const memData = new MemData(payload);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) throw treeErr;
  const merkleRoot = tree.rootHash();

  const indexer = new Indexer(env.OG_INDEXER_URL);
  const [tx, err] = await indexer.upload(memData, env.OG_RPC_URL, signer);
  if (err) throw err;

  return { merkleRoot, txHash: tx };
}
```

- [ ] **Step 3: Verify TS compiles**

Run: `cd apps/server && pnpm exec tsc --noEmit`
Expected: No errors. (If the SDK API differs in the installed version, adjust import names per `@0glabs/0g-ts-sdk` docs and re-run.)

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/storage.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): 0G storage upload service"
```

---

## Task 11: INFT Mint Service

**Files:**
- Create: `apps/server/src/services/inft.ts`

- [ ] **Step 1: Write the service**

```typescript
// apps/server/src/services/inft.ts
import { createPublicClient, createWalletClient, http, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { abi } from '@taars/sdk';
import { env } from '../env.js';

const ogChain = {
  id: 16601,
  name: '0G Testnet',
  nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: [env.OG_RPC_URL] } },
} as const;

const account = privateKeyToAccount(env.SERVER_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: ogChain, transport: http() });
const walletClient = createWalletClient({ account, chain: ogChain, transport: http() });

export async function mintINFT(
  to: `0x${string}`,
  encryptedURI: string,
  modelVersion: string
): Promise<{ tokenId: bigint; txHash: `0x${string}` }> {
  const txHash = await walletClient.writeContract({
    address: env.TAARS_INFT_ADDRESS as `0x${string}`,
    abi: abi.TaarsINFTAbi,
    functionName: 'mint',
    args: [to, encryptedURI, modelVersion],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: abi.TaarsINFTAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Minted') {
        return { tokenId: decoded.args.tokenId as bigint, txHash };
      }
    } catch { /* not our event */ }
  }
  throw new Error('Minted event not found in receipt');
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `cd apps/server && pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/inft.ts
git commit -m "feat(server): INFT mint service via viem"
```

---

## Task 12: ENS Subname Service (Namestone + on-chain mirror)

**Files:**
- Create: `apps/server/src/services/ens.ts`

- [ ] **Step 1: Write the service**

```typescript
// apps/server/src/services/ens.ts
import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { abi } from '@taars/sdk';
import { env } from '../env.js';

const account = privateKeyToAccount(env.SERVER_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(env.BASE_RPC_URL) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(env.BASE_RPC_URL) });

interface NamestoneTextRecord { key: string; value: string }

/// 1. Reserve subname via Namestone API (issues alice.taars.eth on Base).
async function namestoneClaim(label: string, ownerAddress: string, textRecords: NamestoneTextRecord[]) {
  const body = {
    domain: env.NAMESTONE_DOMAIN,
    name: label,
    address: ownerAddress,
    text_records: Object.fromEntries(textRecords.map(t => [t.key, t.value])),
  };
  const res = await fetch('https://namestone.com/api/public_v1/set-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.NAMESTONE_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Namestone set-name failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/// 2. Mirror the record on-chain in TaarsENS for composability.
async function onchainRegister(label: string, owner: `0x${string}`, tokenId: bigint, storageRoot: string) {
  const txHash = await walletClient.writeContract({
    address: env.TAARS_ENS_ADDRESS as `0x${string}`,
    abi: abi.TaarsENSAbi,
    functionName: 'register',
    args: [label, owner, tokenId, storageRoot],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function registerSubname(opts: {
  label: string;
  owner: `0x${string}`;
  tokenId: bigint;
  storageRoot: string;
  textRecords: NamestoneTextRecord[];
}): Promise<{ namestone: unknown; txHash: `0x${string}` }> {
  const namestone = await namestoneClaim(opts.label, opts.owner, opts.textRecords);
  const txHash = await onchainRegister(opts.label, opts.owner, opts.tokenId, opts.storageRoot);
  return { namestone, txHash };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `cd apps/server && pnpm exec tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/ens.ts
git commit -m "feat(server): ENS subname registration via namestone + on-chain mirror"
```

---

## Task 13: Mint Orchestration Route

**Files:**
- Create: `apps/server/src/routes/mint.ts`
- Modify: `apps/server/src/index.ts` (mount route)

- [ ] **Step 1: Write the route**

```typescript
// apps/server/src/routes/mint.ts
import { Hono } from 'hono';
import { z } from 'zod';
import type { MintRequest, MintResponse } from '@taars/sdk';
import { trainVoiceProfile } from '../services/voice.js';
import { encryptBlob } from '../services/encrypt.js';
import { uploadToZeroG } from '../services/storage.js';
import { mintINFT } from '../services/inft.js';
import { registerSubname } from '../services/ens.js';
import { env } from '../env.js';

export const mint = new Hono();

const personalitySchema = z.object({
  vibe: z.string(), expertise: z.string(), catchphrases: z.string(), avoid: z.string(),
  example1Q: z.string(), example1A: z.string(),
  example2Q: z.string(), example2A: z.string(),
  example3Q: z.string(), example3A: z.string(),
});

const requestSchema = z.object({
  ensLabel: z.string().regex(/^[a-z0-9-]{2,32}$/),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  voiceSampleBase64: z.string(),
  personality: personalitySchema,
  pricePerMinUsd: z.string().regex(/^\d+(\.\d+)?$/),
});

mint.post('/', async (c) => {
  const body = (await c.req.json()) as MintRequest;
  const parsed = requestSchema.parse(body);

  // 1. Voice training (mock for 0G Compute fine-tune).
  const voiceBytes = Buffer.from(parsed.voiceSampleBase64, 'base64');
  const voice = await trainVoiceProfile(parsed.ensLabel, voiceBytes);

  // 2. Build the model artifact bundle (voice profile + personality config).
  const artifact = JSON.stringify({
    voice,
    personality: parsed.personality,
    createdAt: Date.now(),
    version: 'taars-v1',
  });

  // 3. Encrypt with the platform's content key (caller decryption gated by INFT ownership).
  const encrypted = await encryptBlob(new TextEncoder().encode(artifact), env.ENCRYPTION_KEY);

  // 4. Upload to 0G Storage.
  const { merkleRoot } = await uploadToZeroG(encrypted);
  const storageRoot = `0g:storage:${merkleRoot}`;

  // 5. Mint INFT on 0G Chain.
  const { tokenId, txHash: txInft } = await mintINFT(
    parsed.ownerAddress as `0x${string}`,
    storageRoot,
    'taars-v1'
  );

  // 6. Register ENS subname on Base + mirror on-chain.
  const textRecords = [
    { key: 'taars.inft', value: `0g:chain:${tokenId.toString()}` },
    { key: 'taars.storage', value: storageRoot },
    { key: 'taars.created', value: String(Math.floor(Date.now() / 1000)) },
    { key: 'taars.version', value: 'taars-v1' },
    { key: 'taars.price', value: parsed.pricePerMinUsd },
    { key: 'taars.currency', value: 'USDC' },
    { key: 'taars.network', value: 'base' },
    { key: 'taars.voice', value: voice.voiceId },
    { key: 'description', value: `taars replica forged ${new Date().toISOString().slice(0, 10)}` },
  ];
  const { namestone, txHash: txEns } = await registerSubname({
    label: parsed.ensLabel,
    owner: parsed.ownerAddress as `0x${string}`,
    tokenId,
    storageRoot,
    textRecords,
  });

  const response: MintResponse = {
    ok: true,
    tokenId: tokenId.toString(),
    storageRoot,
    ensLabel: parsed.ensLabel,
    voiceProfileId: voice.voiceId,
    txInft,
    txEns,
  };
  return c.json(response);
});
```

- [ ] **Step 2: Mount route in server entry**

Edit `apps/server/src/index.ts`:

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env.js';
import { health } from './routes/health.js';
import { mint } from './routes/mint.js';

const app = new Hono();

app.use('*', cors());
app.route('/health', health);
app.route('/mint', mint);

const port = env.SERVER_PORT;
console.log(`taars server listening on :${port}`);
serve({ fetch: app.fetch, port });
```

- [ ] **Step 3: Verify TS compiles + server runs**

Run: `cd apps/server && pnpm exec tsc --noEmit && pnpm dev`
Expected: No errors. Server logs start. Hit `curl localhost:8080/health` → ok.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/mint.ts apps/server/src/index.ts
git commit -m "feat(server): /mint orchestration route — full create pipeline"
```

---

## Task 14: Next.js PWA Scaffold

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/public/manifest.webmanifest`, `apps/web/lib/env.ts`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd apps && pnpm create next-app@latest web --ts --tailwind --app --eslint --use-pnpm --no-src-dir --import-alias "@/*" --no-turbopack
cd web && rm -rf app/api app/favicon.ico
```

- [ ] **Step 2: Add deps for Privy, wagmi, viem, shadcn deps**

```bash
cd apps/web && pnpm add @privy-io/react-auth @privy-io/wagmi wagmi viem @tanstack/react-query class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D @types/node
```

- [ ] **Step 3: Create lib/env.ts**

```typescript
// apps/web/lib/env.ts
export const env = {
  PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  BASE_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL!,
  OG_RPC_URL: process.env.NEXT_PUBLIC_OG_RPC_URL!,
  BASE_CHAIN_ID: Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID ?? 84532),
  SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:8080',
};
```

- [ ] **Step 4: Create providers component**

```tsx
// apps/web/components/providers.tsx
'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { env } from '@/lib/env';

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http(env.BASE_RPC_URL) },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={env.PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

- [ ] **Step 5: Wire providers + PWA manifest in root layout**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'taars',
  description: 'Your AI Replica. Your Identity. Your Rules.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: PWA manifest**

```json
// apps/web/public/manifest.webmanifest
{
  "name": "taars",
  "short_name": "taars",
  "description": "Your AI replica. Your identity. Your rules.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

(Generate icons later — placeholder PNGs OK for hackathon.)

- [ ] **Step 7: Verify it builds + runs**

Run: `cd apps/web && pnpm dev`
Expected: Next.js dev server up on :3000, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): next.js pwa scaffold with privy + wagmi providers"
```

---

## Task 15: Home Page (Featured taars)

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/featured-card.tsx`, `apps/web/lib/featured.ts`

- [ ] **Step 1: Define featured roster**

```typescript
// apps/web/lib/featured.ts
export interface FeaturedTaar {
  ensLabel: string;
  displayName: string;
  bio: string;
  avatar: string;
  pricePerMin: string;
}

export const featured: FeaturedTaar[] = [
  { ensLabel: 'vitalik',  displayName: 'Vitalik Buterin',     bio: 'Ethereum co-founder. Trained on public writings.',     avatar: '/featured/vitalik.png',  pricePerMin: '0.10' },
  { ensLabel: 'trump',    displayName: 'Donald Trump',        bio: 'Argue with the replica.',                              avatar: '/featured/trump.png',    pricePerMin: '0.10' },
  { ensLabel: 'fabian',   displayName: 'Fabian Ferno',        bio: 'Builder. Dogfooding taars.',                            avatar: '/featured/fabian.png',   pricePerMin: '0.05' },
  { ensLabel: 'balaji',   displayName: 'Balaji Srinivasan',   bio: 'Crypto thinker. Trained on Network State.',            avatar: '/featured/balaji.png',   pricePerMin: '0.15' },
];
```

- [ ] **Step 2: Featured card component**

```tsx
// apps/web/components/featured-card.tsx
import Link from 'next/link';
import type { FeaturedTaar } from '@/lib/featured';

export function FeaturedCard({ t }: { t: FeaturedTaar }) {
  return (
    <Link
      href={`/${t.ensLabel}`}
      className="group rounded-2xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-600"
    >
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.avatar} alt={t.displayName} className="h-14 w-14 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t.displayName}</div>
          <div className="text-xs text-neutral-400">{t.ensLabel}.taars.eth</div>
        </div>
        <div className="text-right text-xs text-neutral-400">
          <div className="font-mono">${t.pricePerMin}/min</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-neutral-300">{t.bio}</p>
    </Link>
  );
}
```

- [ ] **Step 3: Home page**

```tsx
// apps/web/app/page.tsx
'use client';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { featured } from '@/lib/featured';
import { FeaturedCard } from '@/components/featured-card';

export default function Home() {
  const { login, authenticated, user, logout } = usePrivy();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">taars</h1>
        {authenticated ? (
          <button onClick={logout} className="text-sm text-neutral-400 hover:text-neutral-100">
            {user?.email?.address ?? user?.wallet?.address?.slice(0, 6)}
          </button>
        ) : (
          <button onClick={login} className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-950">
            Sign in
          </button>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">Featured</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((t) => <FeaturedCard key={t.ensLabel} t={t} />)}
        </div>
      </section>

      <Link
        href="/create"
        className="block rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 p-6 text-center font-medium"
      >
        Forge your own taar →
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Verify it renders**

Run: `cd apps/web && pnpm dev` and open `http://localhost:3000`.
Expected: Title, sign-in button, four featured cards, big create CTA.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/featured-card.tsx apps/web/lib/featured.ts
git commit -m "feat(web): home page with featured taars + privy login"
```

---

## Task 16: Voice Recorder Component

**Files:**
- Create: `apps/web/components/voice-recorder.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/components/voice-recorder.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: (blob: Blob) => void;
  maxSeconds?: number;
}

export function VoiceRecorder({ onComplete, maxSeconds = 60 }: Props) {
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function start() {
    chunksRef.current = [];
    setSecondsLeft(maxSeconds);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setRecordedUrl(URL.createObjectURL(blob));
      onComplete(blob);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    mediaRef.current = rec;
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { stop(); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-3 text-sm text-neutral-400">
        Record a 60-second voice sample. Talk naturally — your voice character matters more than what you say.
      </div>
      {recording ? (
        <button onClick={stop} className="rounded-full bg-red-500 px-5 py-2 text-sm font-medium">
          Stop ({secondsLeft}s)
        </button>
      ) : (
        <button onClick={start} className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950">
          {recordedUrl ? 'Re-record' : 'Start recording'}
        </button>
      )}
      {recordedUrl && (
        <audio src={recordedUrl} controls className="mt-3 w-full" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders + records (manual)**

Spin up dev server, mount the component on a test page, record, verify playback.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/voice-recorder.tsx
git commit -m "feat(web): voice recorder component (MediaRecorder API)"
```

---

## Task 17: Personality Form Component

**Files:**
- Create: `apps/web/components/personality-form.tsx`

- [ ] **Step 1: Build the form**

```tsx
// apps/web/components/personality-form.tsx
'use client';
import { useState } from 'react';
import type { PersonalityAnswers } from '@taars/sdk';

const QUESTIONS: { key: keyof PersonalityAnswers; label: string; placeholder: string }[] = [
  { key: 'vibe', label: 'How would a close friend describe your vibe in one sentence?', placeholder: 'warm, direct, a bit chaotic' },
  { key: 'expertise', label: 'What three things do you know more about than 99% of people?', placeholder: 'rollups, climbing, ramen' },
  { key: 'catchphrases', label: 'Words or phrases you say constantly', placeholder: 'frankly, like, you know what I mean' },
  { key: 'avoid', label: 'Topics you avoid or don\'t want your replica to engage with', placeholder: 'family stuff, salary' },
  { key: 'example1Q', label: 'Sample Q #1', placeholder: 'How would you fix Ethereum scaling?' },
  { key: 'example1A', label: 'Sample A #1 (in your words)', placeholder: 'Honestly, I think the answer is...' },
  { key: 'example2Q', label: 'Sample Q #2', placeholder: 'Best book you read this year?' },
  { key: 'example2A', label: 'Sample A #2', placeholder: '...' },
  { key: 'example3Q', label: 'Sample Q #3', placeholder: 'What\'s your hot take on AI agents?' },
  { key: 'example3A', label: 'Sample A #3', placeholder: '...' },
];

export function PersonalityForm({ value, onChange }: {
  value: PersonalityAnswers;
  onChange: (v: PersonalityAnswers) => void;
}) {
  return (
    <div className="space-y-4">
      {QUESTIONS.map((q) => (
        <label key={q.key} className="block">
          <div className="mb-1 text-sm text-neutral-300">{q.label}</div>
          <textarea
            value={value[q.key] ?? ''}
            onChange={(e) => onChange({ ...value, [q.key]: e.target.value })}
            placeholder={q.placeholder}
            rows={2}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </label>
      ))}
    </div>
  );
}

export const emptyPersonality: PersonalityAnswers = {
  vibe: '', expertise: '', catchphrases: '', avoid: '',
  example1Q: '', example1A: '',
  example2Q: '', example2A: '',
  example3Q: '', example3A: '',
};
```

- [ ] **Step 2: Add @taars/sdk to web's deps**

```bash
cd apps/web && pnpm add @taars/sdk@workspace:*
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/personality-form.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): personality form component with 10 questions"
```

---

## Task 18: Create Wizard Page

**Files:**
- Create: `apps/web/app/create/page.tsx`, `apps/web/lib/api.ts`

- [ ] **Step 1: Backend client**

```typescript
// apps/web/lib/api.ts
import type { MintRequest, MintResponse } from '@taars/sdk';
import { env } from './env';

export async function mintReplica(req: MintRequest): Promise<MintResponse> {
  const res = await fetch(`${env.SERVER_URL}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Mint failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}
```

- [ ] **Step 2: Wizard page**

```tsx
// apps/web/app/create/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { VoiceRecorder } from '@/components/voice-recorder';
import { PersonalityForm, emptyPersonality } from '@/components/personality-form';
import { mintReplica, blobToBase64 } from '@/lib/api';
import type { PersonalityAnswers, MintResponse } from '@taars/sdk';

type Step = 'name' | 'voice' | 'personality' | 'price' | 'minting' | 'done';

export default function Create() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  const [step, setStep] = useState<Step>('name');
  const [ensLabel, setEnsLabel] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [personality, setPersonality] = useState<PersonalityAnswers>(emptyPersonality);
  const [price, setPrice] = useState('0.05');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResponse | null>(null);

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-3 text-2xl font-bold">Sign in to forge a taar</h1>
        <button onClick={login} className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950">
          Sign in
        </button>
      </main>
    );
  }

  async function forge() {
    if (!wallet || !voiceBlob) return;
    setStep('minting');
    setError(null);
    try {
      const voiceSampleBase64 = await blobToBase64(voiceBlob);
      const res = await mintReplica({
        ensLabel,
        ownerAddress: wallet.address as `0x${string}`,
        voiceSampleBase64,
        personality,
        pricePerMinUsd: price,
      });
      setResult(res);
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStep('price');
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <button onClick={() => router.push('/')} className="mb-4 text-sm text-neutral-400">← Home</button>
      <h1 className="mb-6 text-2xl font-bold">Forge your taar</h1>

      {step === 'name' && (
        <div className="space-y-3">
          <label className="block text-sm text-neutral-300">Pick your taar name</label>
          <div className="flex items-center gap-2">
            <input
              value={ensLabel}
              onChange={(e) => setEnsLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="alice"
              className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 p-3"
            />
            <span className="text-sm text-neutral-400">.taars.eth</span>
          </div>
          <button
            disabled={ensLabel.length < 2}
            onClick={() => setStep('voice')}
            className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {step === 'voice' && (
        <div className="space-y-3">
          <VoiceRecorder onComplete={setVoiceBlob} />
          <button
            disabled={!voiceBlob}
            onClick={() => setStep('personality')}
            className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {step === 'personality' && (
        <div className="space-y-4">
          <PersonalityForm value={personality} onChange={setPersonality} />
          <button onClick={() => setStep('price')} className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950">
            Next
          </button>
        </div>
      )}

      {step === 'price' && (
        <div className="space-y-3">
          <label className="block text-sm text-neutral-300">Per-minute rate (USDC)</label>
          <input
            type="number" step="0.01" min="0"
            value={price} onChange={(e) => setPrice(e.target.value)}
            className="w-32 rounded-xl border border-neutral-800 bg-neutral-950 p-3"
          />
          <button onClick={forge} className="block rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 px-6 py-2.5 font-medium">
            Forge My taar
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === 'minting' && (
        <div className="space-y-2 text-sm text-neutral-300">
          <p>Training voice profile…</p>
          <p>Encrypting + uploading to 0G Storage…</p>
          <p>Minting INFT on 0G Chain…</p>
          <p>Registering ENS subname on Base…</p>
          <p>(This takes ~30s.)</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-3 rounded-2xl border border-fuchsia-700 bg-neutral-900 p-5">
          <h2 className="text-xl font-bold">Live at {result.ensLabel}.taars.eth</h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            <li>INFT token: <span className="font-mono">{result.tokenId}</span></li>
            <li>Storage root: <span className="break-all font-mono">{result.storageRoot}</span></li>
            <li>Voice profile: <span className="font-mono">{result.voiceProfileId}</span></li>
          </ul>
          <button onClick={() => router.push(`/${result.ensLabel}`)} className="rounded-full bg-neutral-100 px-5 py-2 text-sm font-medium text-neutral-950">
            View profile
          </button>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify the wizard flow renders all steps**

Run: `cd apps/web && pnpm dev` and walk through all four steps without backend (the backend call will fail; that's expected — UI flow is the goal).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/create/page.tsx apps/web/lib/api.ts
git commit -m "feat(web): create wizard — name, voice, personality, price, mint"
```

---

## Task 19: Profile Page by ENS Name

**Files:**
- Create: `apps/web/app/[ensName]/page.tsx`, `apps/web/lib/ens.ts`

- [ ] **Step 1: ENS resolution helper**

```typescript
// apps/web/lib/ens.ts
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { abi } from '@taars/sdk';
import { env } from './env';

const TAARS_ENS_ADDRESS = process.env.NEXT_PUBLIC_TAARS_ENS_ADDRESS as `0x${string}`;

const client = createPublicClient({ chain: baseSepolia, transport: http(env.BASE_RPC_URL) });

export async function resolveLabel(label: string) {
  const record = await client.readContract({
    address: TAARS_ENS_ADDRESS,
    abi: abi.TaarsENSAbi,
    functionName: 'recordOf',
    args: [label],
  });
  return record;
}

export async function readText(label: string, key: string): Promise<string> {
  const value = await client.readContract({
    address: TAARS_ENS_ADDRESS,
    abi: abi.TaarsENSAbi,
    functionName: 'text',
    args: [label, key],
  });
  return value as string;
}

const TEXT_KEYS = [
  'taars.inft', 'taars.storage', 'taars.created', 'taars.version',
  'taars.price', 'taars.currency', 'taars.network', 'taars.voice',
  'description', 'avatar',
];

export async function readAllTextRecords(label: string): Promise<Record<string, string>> {
  const entries = await Promise.all(TEXT_KEYS.map(async (k) => [k, await readText(label, k)] as const));
  return Object.fromEntries(entries);
}
```

- [ ] **Step 2: Profile page (server component is simpler, but Privy needs client; use client)**

```tsx
// apps/web/app/[ensName]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { resolveLabel, readAllTextRecords } from '@/lib/ens';

interface PageProps { params: { ensName: string } }

export default function ProfilePage({ params }: PageProps) {
  const label = params.ensName;
  const [record, setRecord] = useState<Awaited<ReturnType<typeof resolveLabel>> | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await resolveLabel(label);
        setRecord(r);
        if (r.owner === '0x0000000000000000000000000000000000000000') {
          setError(`No replica registered at ${label}.taars.eth`);
          return;
        }
        const t = await readAllTextRecords(label);
        setTexts(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    })();
  }, [label]);

  if (error) return <main className="mx-auto max-w-2xl p-6 text-red-400">{error}</main>;
  if (!record) return <main className="mx-auto max-w-2xl p-6 text-neutral-400">Resolving {label}.taars.eth…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="mb-4 inline-block text-sm text-neutral-400">← Home</Link>
      <h1 className="text-2xl font-bold">{label}.taars.eth</h1>
      <p className="mt-2 text-neutral-300">{texts.description ?? '—'}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Per-minute" value={`$${texts['taars.price'] ?? '—'}`} />
        <Stat label="Currency"    value={texts['taars.currency'] ?? '—'} />
        <Stat label="Network"     value={texts['taars.network'] ?? '—'} />
        <Stat label="Version"     value={texts['taars.version'] ?? '—'} />
      </div>

      <details className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <summary className="cursor-pointer text-sm text-neutral-300">Receipts</summary>
        <ul className="mt-3 space-y-1 font-mono text-xs text-neutral-400">
          <li>owner:        {record.owner}</li>
          <li>tokenId:      {String(record.tokenId)}</li>
          <li>storageRoot:  {record.storageRoot}</li>
          <li>voiceId:      {texts['taars.voice'] ?? '—'}</li>
        </ul>
      </details>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 p-5 text-center">
        <p className="text-sm">Chat & voice coming in Plan 2.</p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify profile page resolves a registered name**

After contracts are deployed and a replica is minted via the wizard, visit `/{label}` — should show owner, tokenId, storage root, text records.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\[ensName\]/page.tsx apps/web/lib/ens.ts
git commit -m "feat(web): replica profile page resolved by ENS label"
```

---

## Task 20: End-to-End Smoke Test + Demo Walkthrough

**Files:** None new — this is a verification + documentation task.

- [ ] **Step 1: Deploy contracts**

```bash
# 0G Chain (TaarsINFT)
cd packages/contracts
DEPLOYER_PK=$DEPLOYER_PK ORACLE_ADDRESS=$ORACLE_ADDRESS \
forge script script/DeployINFT.s.sol --rpc-url $OG_RPC_URL --broadcast

# Base Sepolia (TaarsENS)
DEPLOYER_PK=$DEPLOYER_PK OPERATOR_ADDRESS=$OPERATOR_ADDRESS \
forge script script/DeployTaarsENS.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
```

Update `.env` with both addresses.

- [ ] **Step 2: Re-generate ABIs after contracts deployed**

```bash
cd packages/contracts && forge build
cd ../sdk && node scripts/gen-abi.mjs
```

- [ ] **Step 3: Start backend + frontend**

```bash
pnpm install
pnpm dev
```

- [ ] **Step 4: Walk the create flow end-to-end**

1. Open `http://localhost:3000`.
2. Sign in with Privy email.
3. Click "Forge your own taar."
4. Pick label `test1`, record 10s of voice, fill personality (anything), set price `0.05`, click "Forge My taar."
5. Wait ~30s. Verify success screen shows tokenId, storageRoot, voiceId.
6. Click "View profile" → confirm the profile page resolves all text records.
7. Verify on Basescan that `register()` was called on TaarsENS.
8. Verify on 0G explorer that `mint()` was called on TaarsINFT.
9. Verify Namestone admin shows `test1.taars.eth` mapped to your wallet.

- [ ] **Step 5: Update README with what's working + screenshot the flow**

Append to root `README.md`:

```markdown
## Plan 1 status: ✅ replica creation pipeline live

Demo: open the PWA, sign in with email (Privy), record 60s of voice, answer personality questions, set a per-minute rate, click "Forge My taar." The pipeline:

1. Voice → ElevenLabs voice cloning (mock for 0G Compute fine-tune)
2. Encrypt artifact bundle (AES-GCM)
3. Upload encrypted blob to 0G Storage → merkle root
4. Mint INFT on 0G Chain (encrypted URI = storage root)
5. Register ENS subname on Base via Namestone + mirror in TaarsENS contract

Result: a replica live at `<label>.taars.eth` with all text records populated.

Next plans: Plan 2 (chat + voice + per-minute billing via KeeperHub), Plan 3 (INFT transfer, Discord deploy, taars MCP).
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: plan 1 complete — replica creation pipeline working end-to-end"
```

---

## Self-Review

**Spec coverage check:** Plan 1 covers the prd.md "Creating a Replica" flow (steps 1–13) end-to-end:
- ✅ PWA + Privy login (Tasks 14, 15)
- ✅ ENS subname pick (Task 18)
- ✅ Voice + personality input (Tasks 16, 17, 18)
- ✅ Pay USDC for creation: NOT in Plan 1 — currently the backend signs txs as the operator. **Deferred to Plan 2** (per-minute billing flow includes the user-pays piece). Document this gap clearly.
- ✅ TEE training (mocked via ElevenLabs, narrated correctly): Tasks 9, 13
- ✅ Encryption + 0G Storage upload: Tasks 8, 10
- ✅ INFT mint with encrypted URI: Tasks 3, 11, 13
- ✅ ENS subname + text records: Tasks 4, 12, 13
- ✅ Profile page resolution: Task 19

Plan 2 will own: caller-side x402 payment, KeeperHub MCP integration, chat/voice UI, inference, earnings dashboard.
Plan 3 will own: INFT transfer orchestration, Discord deploy, taars MCP server.

**Placeholder scan:** No "TODO/TBD" remain. The "icons later" note in Task 14 is acknowledged as hackathon-acceptable polish.

**Type consistency check:**
- `MintRequest` / `MintResponse` defined in `packages/sdk/src/types.ts` (Task 6), used identically in server route (Task 13) and frontend client (Task 18). ✅
- `PersonalityAnswers` keys match across SDK (Task 6), form component (Task 17), and zod schema (Task 13). ✅
- Contract function names match between Foundry tests (Tasks 3, 4) and TS callsites: `mint`, `register`, `setText`, `recordOf`, `text`. ✅
- `TaarsINFT` event `Minted` decoded in Task 11 matches the event signature in Task 3. ✅

---

## Execution Handoff

Plan 1 saved to `docs/superpowers/plans/2026-04-30-taars-foundation-replica-creation.md`. After this is implemented and demoable, write Plan 2 (chat + voice + KeeperHub billing) and Plan 3 (transfer + Discord + MCP).
