// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockINFT
/// @notice Minimal ERC721 used to mirror the taars Agent INFT ownership on
///         networks where the real TaarsAgentNFT (deployed on 0G testnet) is
///         not available — e.g., Sepolia. Only the deployer (owner) can mint.
contract MockINFT is ERC721, Ownable {
    constructor(address initialOwner)
        ERC721("Mock TaarsAgentNFT", "mTAAR")
        Ownable(initialOwner)
    {}

    /// @notice Mints `tokenId` to `to`. Restricted to owner so that ownership
    ///         can be authoritatively mirrored from 0G off-chain.
    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }
}
