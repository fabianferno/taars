// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TaarsBilling
/// @notice Per-minute USDC billing for taars agent chat sessions with on-chain
///         settlement and a 90 / 7 / 3 revenue split:
///         - 90% to the current INFT owner (claimable)
///         - 7%  to platform treasury (claimable by contract owner)
///         - 3%  to the original creator (claimable). If no creator is set
///                for the tokenId, the 3% is added to the INFT owner share.
contract TaarsBilling is Ownable {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @dev Revenue split in basis points. 9000 + 700 + 300 = 10000.
    uint256 private constant BPS_OWNER = 9000;
    uint256 private constant BPS_TREASURY = 700;
    uint256 private constant BPS_CREATOR = 300;
    uint256 private constant BPS_DENOMINATOR = 10000;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice USDC token (or MockUSDC for hackathon).
    IERC20 public immutable usdc;

    /// @notice Platform treasury address (used for accounting; payout via claimTreasury).
    address public treasury;

    /// @notice Server signer authorized to settle sessions on behalf of users.
    address public oracle;

    /// @notice Per-minute price in USDC atomic units (6 decimals).
    mapping(uint256 => uint128) public ratePerMinute;

    /// @notice Original creator wallet for a given tokenId — receives 3% royalty.
    mapping(uint256 => address) public creator;

    /// @notice Claimable USDC balance accrued to a given tokenId's current owner.
    mapping(uint256 => uint256) public ownerBalance;

    /// @notice Claimable USDC balance for the platform treasury.
    uint256 public treasuryBalance;

    /// @notice Claimable USDC balance per original-creator address.
    mapping(address => uint256) public creatorBalance;

    struct Session {
        uint256 tokenId;
        address caller;
        uint64 startedAt;
        uint64 endedAt;
        uint128 ratePerMinute;
        uint256 paid;
        bool settled;
    }

    /// @notice sessionId => session record.
    mapping(bytes32 => Session) public sessions;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event RateSet(uint256 indexed tokenId, uint128 ratePerMinute);
    event SessionStarted(
        bytes32 indexed sessionId,
        uint256 indexed tokenId,
        address indexed caller,
        uint128 ratePerMinute
    );
    event SessionSettled(
        bytes32 indexed sessionId,
        uint256 indexed tokenId,
        address indexed caller,
        uint256 totalPaid,
        uint256 toOwner,
        uint256 toTreasury,
        uint256 toCreator,
        uint64 durationSeconds
    );
    event RevenueClaimed(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event CreatorRoyaltyClaimed(address indexed creator, uint256 amount);
    event TreasuryClaimed(address indexed to, uint256 amount);
    event CreatorSet(uint256 indexed tokenId, address indexed creator);
    event OracleSet(address indexed oracle);
    event TreasurySet(address indexed treasury);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(
        IERC20 usdc_,
        address treasury_,
        address oracle_,
        address owner_
    ) Ownable(owner_) {
        require(address(usdc_) != address(0), "TaarsBilling: usdc=0");
        require(treasury_ != address(0), "TaarsBilling: treasury=0");
        require(oracle_ != address(0), "TaarsBilling: oracle=0");
        usdc = usdc_;
        treasury = treasury_;
        oracle = oracle_;
    }

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOracle() {
        require(msg.sender == oracle, "TaarsBilling: not oracle");
        _;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "TaarsBilling: oracle=0");
        oracle = oracle_;
        emit OracleSet(oracle_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "TaarsBilling: treasury=0");
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    /// @notice Records the original creator of a tokenId for the 3% royalty.
    ///         For now this is admin-set; future versions can hook into mint.
    function setCreator(uint256 tokenId, address creator_) external onlyOwner {
        creator[tokenId] = creator_;
        emit CreatorSet(tokenId, creator_);
    }

    // ---------------------------------------------------------------------
    // INFT-owner facing
    // ---------------------------------------------------------------------

    /// @notice Oracle sets the per-minute price (in USDC atomic units) for tokenId on behalf of the verified 0G INFT owner.
    function setRate(uint256 tokenId, uint128 ratePerMinute_) external onlyOracle {
        ratePerMinute[tokenId] = ratePerMinute_;
        emit RateSet(tokenId, ratePerMinute_);
    }

    // ---------------------------------------------------------------------
    // Sessions
    // ---------------------------------------------------------------------

    /// @notice Caller (the user) opens a chat session against `tokenId`.
    ///         Snapshots the current per-minute rate at start time so the
    ///         price cannot move under the user during a live session.
    function startSession(bytes32 sessionId, uint256 tokenId) external {
        require(sessions[sessionId].caller == address(0), "TaarsBilling: session exists");

        uint128 snapshotRate = ratePerMinute[tokenId];

        sessions[sessionId] = Session({
            tokenId: tokenId,
            caller: msg.sender,
            startedAt: uint64(block.timestamp),
            endedAt: 0,
            ratePerMinute: snapshotRate,
            paid: 0,
            settled: false
        });

        emit SessionStarted(sessionId, tokenId, msg.sender, snapshotRate);
    }

    /// @notice Oracle settles a session. Computes
    ///         `expected = ratePerMinute * (endedAt - startedAt) / 60`
    ///         and pulls exactly `expected` USDC from the caller (who must
    ///         have approved this contract). Splits 90/7/3.
    function settleSession(bytes32 sessionId, uint64 endedAt) external onlyOracle {
        Session storage s = sessions[sessionId];
        require(s.caller != address(0), "TaarsBilling: unknown session");
        require(!s.settled, "TaarsBilling: already settled");
        require(endedAt >= s.startedAt, "TaarsBilling: endedAt<startedAt");

        uint64 duration = endedAt - s.startedAt;
        uint256 expected = (uint256(s.ratePerMinute) * uint256(duration)) / 60;

        s.endedAt = endedAt;
        s.paid = expected;
        s.settled = true;

        uint256 toOwner;
        uint256 toTreasury;
        uint256 toCreator;

        if (expected > 0) {
            usdc.safeTransferFrom(s.caller, address(this), expected);

            toTreasury = (expected * BPS_TREASURY) / BPS_DENOMINATOR;
            toCreator = (expected * BPS_CREATOR) / BPS_DENOMINATOR;
            // Owner gets the remainder so rounding never leaks value.
            toOwner = expected - toTreasury - toCreator;

            address tokenCreator = creator[s.tokenId];
            if (tokenCreator == address(0)) {
                // No creator set — fold the 3% back into the owner share.
                toOwner += toCreator;
                toCreator = 0;
            } else {
                creatorBalance[tokenCreator] += toCreator;
            }

            ownerBalance[s.tokenId] += toOwner;
            treasuryBalance += toTreasury;
        }

        emit SessionSettled(
            sessionId,
            s.tokenId,
            s.caller,
            expected,
            toOwner,
            toTreasury,
            toCreator,
            duration
        );
    }

    // ---------------------------------------------------------------------
    // Claims
    // ---------------------------------------------------------------------

    /// @notice Oracle pays out accrued revenue for `tokenId` to the verified
    ///         0G INFT owner. The oracle is responsible for reading ownership
    ///         from the canonical INFT on the 0G chain before calling.
    function claimRevenueFor(uint256 tokenId, address tokenOwner) external onlyOracle {
        require(tokenOwner != address(0), "TaarsBilling: owner=0");
        uint256 amount = ownerBalance[tokenId];
        require(amount > 0, "TaarsBilling: nothing to claim");
        ownerBalance[tokenId] = 0;
        usdc.safeTransfer(tokenOwner, amount);
        emit RevenueClaimed(tokenId, tokenOwner, amount);
    }

    /// @notice Pays out accrued royalty to the calling creator.
    function claimCreatorRoyalty() external {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "TaarsBilling: nothing to claim");
        creatorBalance[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit CreatorRoyaltyClaimed(msg.sender, amount);
    }

    /// @notice Pays out accrued treasury balance to `to`.
    function claimTreasury(address to) external onlyOwner {
        require(to != address(0), "TaarsBilling: to=0");
        uint256 amount = treasuryBalance;
        require(amount > 0, "TaarsBilling: nothing to claim");
        treasuryBalance = 0;
        usdc.safeTransfer(to, amount);
        emit TreasuryClaimed(to, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getSession(bytes32 sessionId) external view returns (Session memory) {
        return sessions[sessionId];
    }

    function getRevenue(uint256 tokenId) external view returns (uint256) {
        return ownerBalance[tokenId];
    }
}
