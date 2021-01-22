// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

contract Owner {
    address public owner;

    // TODO: remove in prod
    event LogString(string s);
    event LogAddr(address s);
    event LogInt(uint256 i);

    constructor() {
        owner = msg.sender;
    }

    // isOwner checks whether the sender is the owner
    modifier isOwner() {
        require(owner == msg.sender, "Sender is not owner");
        _;
    }
}
