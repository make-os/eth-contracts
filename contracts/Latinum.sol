// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./Dilithium.sol";
import "./libraries/token/ERC20/ERC20.sol";

/// @dev Latinum ERC20 contract
contract Latinum is ERC20("Latinum", "LTN"), Owner {
    Dilithium public dil;

    // maxSupply is the initial maximum number of Latinum
    uint256 public maxSupply = 150000000000000000000000000;

    constructor(address dilAddr) public {
        dil = Dilithium(dilAddr);
    }

    /// @dev updateDILDecayState asks the DIL contract to update the account's
    /// Dilithium decay state.
    function updateDILDecayState(address account) public isOwner() {
        dil.updateDecayState(account, block.timestamp);
    }

    /// @dev mint mints and allocates new Latinum to an account.
    /// @param account is the recipient account.
    /// @param amt is the amount of Latinum minted.
    function mint(address account, uint256 amt) public isOwner() {
        require(totalSupply() + amt <= maxSupply, "Cannot exceed max supply");
        _mint(account, amt);
        dil.updateDecayState(account, block.timestamp);
    }
}
