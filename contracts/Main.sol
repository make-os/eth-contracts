// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./DepositDIL.sol";
import "./Owner.sol";
import "./Latinum.sol";
import "./Dilithium.sol";
import "./libs/ell/EIP20.sol";

/// @title Main
contract Main is DepositDIL {
    Latinum public ltn;
    Dilithium public dil;
    EIP20 public ell;

    event SwappedMain(address account, uint256 amount);

    /// @dev initializes the contract
    constructor(address ellAddress) {
        ltn = new Latinum();
        dil = new Dilithium();
        ell = EIP20(ellAddress);
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
        ell.transferFrom(from, address(0), swapAmount);
        ltn.mint(from, mintAmount);
        emit SwappedMain(from, swapAmount);
    }
}
