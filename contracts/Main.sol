// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./DepositDIL.sol";
import "./Owner.sol";
import "./Latinum.sol";
import "./Dilithium.sol";
import "./Auction.sol";
import "./libs/ell/EIP20.sol";

/// @title Main
contract Main is DepositDIL {
    Latinum public ltn;
    Dilithium public dil;
    EIP20 ell;
    Auction auc;

    event SwappedELL(address account, uint256 amount);

    /// @dev initializes the contract
    constructor(
        address ellAddress,
        int256 maxAuctionPeriods,
        uint256 ltnSupplyPerAuctionPeriod
    ) {
        ltn = new Latinum();
        dil = new Dilithium();
        ell = EIP20(ellAddress);
        auc = new Auction(
            ltn,
            dil,
            maxAuctionPeriods,
            ltnSupplyPerAuctionPeriod
        );
    }

    /// @dev swapELL swaps ELL approved by from by burning it
    /// and minting new LTN up to the given mint amount.
    ///
    /// Requirement: The function requires the ELL account (from) to have allowed
    /// the contract to transfer the swap amount.
    ///
    /// @param from is the account whose ELL will be burned for LTN.
    /// @param swapAmount is the amount of ELL that from has approved to be burned.
    /// @param mintAmount is the amount of LTN that the contract will swap burned ELL for.
    function swapELL(
        address from,
        uint256 swapAmount,
        uint256 mintAmount
    ) public isOwner() {
        require(
            ell.allowance(from, address(this)) >= swapAmount,
            "Swap amount not unlocked"
        );
        ell.transferFrom(from, address(0), swapAmount);
        ltn.mint(from, mintAmount);
        emit SwappedELL(from, swapAmount);
    }
}
