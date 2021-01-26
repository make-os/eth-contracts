// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./Owner.sol";
import "./libs/token/ERC20/ERC20.sol";

/// @dev Latinum ERC20 contract
contract Latinum is ERC20("Latinum", "LTN"), Owner {
    bool ownerSet;

    // maxSupply is the initial maximum number of Latinum
    uint256 public maxSupply = 150000000000000000000000000;

    /// @dev mint mints and allocates new Latinum to an account.
    /// @param account is the recipient account.
    /// @param amt is the amount of Latinum minted.
    function mint(address account, uint256 amt) public isOwner() {
        require(totalSupply() + amt <= maxSupply, "Cannot exceed max supply");
        _mint(account, amt);
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
