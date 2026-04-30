// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Testnet faucet-style USDC mock with 6 decimals (matches real USDC).
///         Anyone can mint to themselves or others. Do NOT deploy to mainnet.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    /// @inheritdoc ERC20
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints `amount` mUSDC to `to`. Open to anyone for hackathon faucet use.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
