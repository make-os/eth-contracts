// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./libraries/token/ERC20/ERC20Decayable.sol";
import "./Auction.sol";
import "./libraries/math/Math.sol";

/// @dev Dilithium ERC20 contract
contract Dilithium is ERC20Decayable("Dilithium", "DIL"), Owner {
    // disableBurn when false indicated burning operaion is allowed.
    bool public disableBurn = false;

    // ltnAddr is the address of the latinum/auction contract
    // address public ltnAddr;

    // isLatinumContract checks whether the sender is the auction/latinum contract.
    modifier isLatinumContract() {
        require(ltnAddr == msg.sender, "Sender is not auction contract");
        _;
    }

    /// @dev initialize the contract.
    /// @param _decayHaltFee is the amount of LTN required to prevent DIL from decaying
    /// @param _decayDur is the number of secods before DIL is completely decayed.
    constructor(uint256 _decayHaltFee, uint256 _decayDur) public {
        decayHaltFee = _decayHaltFee;
        decayDur = _decayDur;
    }

    /// @dev mint allocates new DIL supply to an account.
    /// @param account is the beneficiary.
    /// @param amount is the number of DIL to issue.
    function mint(address account, uint256 amount) public isOwner() {
        _mint(account, amount);
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
        _updateDecayStateOnly(msg.sender, block.timestamp);
    }

    /// @dev setLTNAddress sets the address of the Latinum token contract.
    function setLTNAddress(address addr) external isOwner() {
        ltnAddr = addr;
    }

    /// @dev updateDecayState allows the auction/Latinum contract to
    /// update the decay state of an account.
    /// @param account is the target account to be updated.
    /// @param blockTime is the current block timestamp. We are not using
    /// block.timestamp directly for testability reasons.
    function updateDecayState(address account, uint256 blockTime)
        public
        isLatinumContract
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
