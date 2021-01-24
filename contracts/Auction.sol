// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./Latinum.sol";
import "./Dilithium.sol";
import "./libs/math/SafeMath.sol";

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
contract Auction {
    Latinum ltn;
    Dilithium dil;

    // periods contain the auction periods
    Period[] public periods;

    // claims store all bidders Latinum claims
    mapping(address => Claim[]) public claims;

    // MAX_PERIODS is the maximum allowed periods
    int256 public maxPeriods;

    // ltnSupplyPerPeriod is the maximum amount of LTN distributed per auction.
    uint256 public ltnSupplyPerPeriod;

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

    event NewAuctionPeriod(uint256 index, uint256 endTime);

    // / @notice The constructor
    // / @param _ltn is the Latinum  contract.
    // / @param _dil is the Dilithium  contract.
    // / @param _maxPeriods is the number of auction periods.
    // / @param _ltnSupplyPerPeriod is the supply of Latinum per period.
    constructor(
        Latinum _ltn,
        Dilithium _dil,
        int256 _maxPeriods,
        uint256 _ltnSupplyPerPeriod
    ) {
        ltn = _ltn;
        dil = _dil;
        maxPeriods = _maxPeriods;
        ltnSupplyPerPeriod = _ltnSupplyPerPeriod;
    }

    /// @notice makePeriod creates and returns a period. If the
    /// most recent period has not ended, it is returned instead
    /// of creating a new one.
    function makePeriod()
        public
        isAuctionClosed()
        returns (Period memory, uint256)
    {
        Period memory period;
        uint256 index;

        // Get the current period or create a new one
        if (periods.length > 0) {
            period = periods[periods.length - 1];
            index = periods.length - 1;
        } else {
            period = Period(block.timestamp + 24 hours, ltnSupplyPerPeriod, 0);
            periods.push(period);
            index = periods.length - 1;
            emit NewAuctionPeriod(index, period.endTime);
        }

        // If period has ended, start a new one
        if (period.endTime <= block.timestamp) {
            period = Period(period.endTime + 24 hours, ltnSupplyPerPeriod, 0);
            periods.push(period);
            index = periods.length - 1;
            emit NewAuctionPeriod(index, period.endTime);
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
        require(bidAmount > 0, "Bid amount too small");

        // Burn the the bid amount
        dil.transferFrom(msg.sender, address(this), bidAmount);
        dil.burn(bidAmount);

        // Get the current period
        Period memory period;
        uint256 index;
        (period, index) = makePeriod();

        // Increase the period's bid count
        updatePeriodTotalBids(index, bidAmount);

        // Add a new claim
        claims[msg.sender].push(Claim(index, bidAmount));

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
}
