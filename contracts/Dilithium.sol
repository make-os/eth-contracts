// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./libraries/token/ERC20/ERC20Decayable.sol";
import "./Auction.sol";
import "./libraries/math/SafeMath.sol";

/// @dev Dilithium ERC20 contract
contract Dilithium is ERC20Decayable("Dilithium", "DIL"), Owner {
    uint256 oneDIL;

    // disableBurn when false indicated burning operaion is allowed.
    bool public disableBurn = false;

    // ltnAddr is the address of the latinum/auction contract
    address public ltnAddr;

    // isAuctionContract checks whether the sender is the auction/latinum contract.
    modifier isAuctionContract() {
        require(ltnAddr == msg.sender, "Sender is not auction contract");
        _;
    }

    /// @dev initialize the contract.
    /// @param _decayHaltFee is the amount of LTN required to prevent DIL from decaying
    /// @param _decayDur is the number of secods before DIL is completely decayed.
    constructor(uint256 _decayHaltFee, uint256 _decayDur) public {
        oneDIL = 10**uint256(decimals());
        decayHaltFee = _decayHaltFee;
        decayDur = _decayDur;
    }

    /// @dev mint allocates new DIL supply to an account.
    /// @param account is the beneficiary.
    /// @param amount is the number of DIL to issue.
    function mint(address account, uint256 amount) public isOwner() {
        _mint(account, amount);
        _updateDecayState(account, block.timestamp);
    }

    /// @dev offBurning disables burning function.
    function offBurning() public isOwner() {
        disableBurn = true;
    }

    /// @dev burn destroys the given amount of the sender's balance .
    /// @param amount is the number of DIL to destroy.
    function burn(uint256 amount) public {
        require(!disableBurn, "Burn disabled");
        _burnDecayed(msg.sender);
        _burn(msg.sender, amount);
    }

    /// @dev setLTNAddress sets the address of the Latinum token contract.
    function setLTNAddress(address addr) external isOwner() {
        ltnAddr = addr;
    }

    /// @dev updateDecayState calculates the latest decay state of an account
    /// @param account is the target account.
    /// @param blockTime is the current block timestamp.
    function _updateDecayState(address account, uint256 blockTime) internal {
        // Burn decayed DIL
        _burnDecayed(account);

        // Determine the amount of DIL that can be shielded from decay
        uint256 curBalLTN = Auction(ltnAddr).balanceOf(account);
        uint256 amountShieldable = SM.div(curBalLTN, decayHaltFee) * oneDIL;

        // Reset state to zero if existing DIL balance can be shielded.
        uint256 curBal = balanceOf(account);
        if (curBal <= amountShieldable) {
            decayStates[account].rate = 0;
            decayStates[account].startTime = 0;
            decayStates[account].endTime = 0;
            return;
        }

        // else, calculate new decay rate and period.
        uint256 amtToDecay = SM.sub(curBal, amountShieldable);
        uint256 decayRatePerSec = SM.div(amtToDecay, decayDur);
        decayStates[account].rate = decayRatePerSec;
        decayStates[account].startTime = blockTime;
        decayStates[account].endTime = SM.add(blockTime, decayDur);
    }

    function updateDecayState(address account, uint256 blockTime)
        public
        isAuctionContract
    {
        _updateDecayState(account, blockTime);
    }

    /// @dev setDecayHaltFee sets the decay halt fee (in smallest LTN)
    function setDecayHaltFee(uint256 val) public isOwner() {
        super._setDecayHaltFee(val);
    }

    /// @dev setDecayDuration sets the decay duraion for unshieled DIL.
    function setDecayDuration(uint256 val) public isOwner() {
        super._setDecayDuration(val);
    }
}
