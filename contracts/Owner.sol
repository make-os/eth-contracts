// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

contract Owner {
    address public owner;
    bool ownerSet;

    // TODO: remove in prod
    event LogString(string s);
    event LogAddr(address s);
    event LogInt(uint256 i, uint256 j);

    constructor() public {
        owner = msg.sender;
    }

    // isOwner checks whether the sender is the owner
    modifier isOwner() {
        require(owner == msg.sender, "Sender is not owner");
        _;
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
