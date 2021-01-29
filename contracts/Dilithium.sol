// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./libs/token/ERC20/ERC20.sol";

/// @dev Dilithium ERC20 contract
contract Dilithium is ERC20("Dilithium", "DIL"), Owner {
    bool public disableBurn = false;
    bool ownerSet;

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
        _burn(msg.sender, amount);
    }

    /// @dev setOwnerOnce sets the final owner.
    /// Reverts if called a second time.
    ///
    /// Requires the caller to be the current owner.
    ///
    /// @param owner_ is the new owner.
    function setOwnerOnce(address owner_) public isOwner() {
        require(!ownerSet, "Owner already set");
        owner = owner_;
        ownerSet = true;
    }
}
