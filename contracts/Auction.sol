// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./Latinum.sol";
import "./Dilithium.sol";
import "./libs/math/SafeMath.sol";
import "./libs/math/Math.sol";

/// Claim represents a bidder's claim to a bidding
/// period Latinum supply.
struct Claim {
    uint256 period;
    uint256 bid;
}

/// @dev Period represents an auction period
struct Period {
    uint256 endTime;
    uint256 ltnSupply;
    uint256 totalBids;
}

/// @author The MakeOS Team
/// @title The contract that provides the Latinum dutch auction functionality.
contract Auction is Latinum {
    Dilithium dil;

    // periods contain the auction periods
    Period[] public periods;

    // claims store all bidders Latinum claims
    mapping(address => Claim[]) public claims;

    // MAX_PERIODS is the maximum allowed periods
    int256 public maxPeriods;

    // ltnSupplyPerPeriod is the maximum amount of LTN distributed per auction.
    uint256 public ltnSupplyPerPeriod;

    // minBid is the minimum bid
    uint256 minBid;

    // maxBid is the maximum bid
    uint256 maxBid;

    // minReqDILSupply is the amount of DIL supply required to create the first period.
    uint256 minReqDILSupply;

    /// @dev isAuctionClosed is a modifier to check if the auction has closed.
    modifier isAuctionClosed() {
        require(
            periods.length < uint256(maxPeriods) ||
                periods[periods.length - 1].endTime > block.timestamp,
            "Auction has closed"
        );
        _;
    }

    /// @dev isBidAmountUnlocked is a modifier to check if a bidder has unlocked
    /// the bid amount
    modifier isBidAmountUnlocked(address bidder, uint256 bidAmount) {
        // Ensure the bidder has unlocked the bid amount
        uint256 allowance = dil.allowance(bidder, address(this));
        require(allowance >= bidAmount, "Amount not unlocked");
        _;
    }

    event NewPeriod(uint256 index, uint256 endTime);
    event NewBid(address addr, uint256 amount, uint256 periodIndex);
    event NewClaim(address addr, uint256 amount, uint256 index);

    /// @notice The constructor
    /// @param _dilAddress is the address of the Dilithium contract.
    /// @param _minReqDILSupply is minimum number of DIL supply required to start a
    //  bid period.
    /// @param _maxPeriods is the number of auction periods.
    /// @param _ltnSupplyPerPeriod is the supply of Latinum per period.
    /// @param _minBid is minimum bid per period.
    constructor(
        address _dilAddress,
        uint256 _minReqDILSupply,
        int256 _maxPeriods,
        uint256 _ltnSupplyPerPeriod,
        uint256 _minBid
    ) {
        dil = Dilithium(_dilAddress);
        minBid = _minBid;
        maxPeriods = _maxPeriods;
        ltnSupplyPerPeriod = _ltnSupplyPerPeriod;
        minReqDILSupply = _minReqDILSupply;
    }

    /// @notice makePeriod creates and returns a period. If the
    /// most recent period has not ended, it is returned instead
    /// of creating a new one.
    function makePeriod()
        public
        isAuctionClosed()
        returns (Period memory, uint256)
    {
        require(
            periods.length > 0 || dil.totalSupply() >= minReqDILSupply,
            "Minimum Dilithium supply not reached"
        );

        Period memory period;
        uint256 index;

        // If no period, create one
        if (periods.length == 0) {
            period = Period(block.timestamp + 24 hours, ltnSupplyPerPeriod, 0);
            periods.push(period);
            index = periods.length - 1;
            emit NewPeriod(index, period.endTime);
        }

        // Get the current period or create a new one
        if (period.endTime == 0 && periods.length > 0) {
            period = periods[periods.length - 1];
            index = periods.length - 1;
        }

        // If period has ended, start a new one
        if (period.endTime <= block.timestamp) {
            period = Period(period.endTime + 24 hours, ltnSupplyPerPeriod, 0);
            periods.push(period);
            index = periods.length - 1;
            emit NewPeriod(index, period.endTime);
        }

        return (period, index);
    }

    /// @dev updatePeriodTotalBids updates the total bid of a period.
    function updatePeriodTotalBids(uint256 idx, uint256 newBid) internal {
        periods[idx].totalBids = SafeMath.add(periods[idx].totalBids, newBid);
    }

    /// @notice bid lets an account place a bid.
    /// @param bidAmount is the amount of the DIL to be placed as bid. This amount
    /// must have been unlocked in the DIL contract.
    function bid(uint256 bidAmount)
        public
        isAuctionClosed()
        isBidAmountUnlocked(msg.sender, bidAmount)
        returns (bool)
    {
        require(bidAmount >= minBid, "Bid amount too small");
        require(getNumOfClaims() + 1 <= 5, "Too many unprocessed claims");

        // Get the current period
        Period memory period;
        uint256 index;
        (period, index) = makePeriod();

        // Burn the the bid amount
        dil.transferFrom(msg.sender, address(this), bidAmount);
        dil.burn(bidAmount);

        // Increase the period's bid count
        updatePeriodTotalBids(index, bidAmount);

        // Add a new claim
        claims[msg.sender].push(Claim(index, bidAmount));

        emit NewBid(msg.sender, bidAmount, index);

        return true;
    }

    /// @dev getNumOfPeriods returns the number of periods.
    function getNumOfPeriods() public view returns (uint256) {
        return periods.length;
    }

    /// @dev getNumOfClaims returns the number of claims the sender has.
    function getNumOfClaims() public view returns (uint256) {
        return claims[msg.sender].length;
    }

    /// @dev claim
    function claim() public {
        bool recentActive;

        for (uint256 i = 0; i < getNumOfClaims(); i++) {
            Claim memory claim_ = claims[msg.sender][i];
            Period memory period = periods[claim_.period];

            // Skip claim in current, unexpired period
            if (period.endTime > block.timestamp) {
                recentActive = true;
                continue;
            }

            // Delete claim
            delete claims[msg.sender][i];

            // Get base point for the claim
            uint256 bps = Math.getBPSOfAInB(claim_.bid, period.totalBids);
            uint256 ltnReward = (period.ltnSupply * bps) / 10000;
            _mint(msg.sender, ltnReward);

            emit NewClaim(msg.sender, ltnReward, claim_.period);
        }

        if (recentActive) {
            Claim memory recent =
                claims[msg.sender][claims[msg.sender].length - 1];
            delete claims[msg.sender];
            claims[msg.sender].push(recent);
        } else {
            delete claims[msg.sender];
        }
    }
}