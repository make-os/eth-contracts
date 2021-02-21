// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./Dilithium.sol";
import "./Auction.sol";
import "./libraries/ell/EIP20Interface.sol";
import "./libraries/math/Math.sol";

/// @title Main
contract Main is Owner {
    // ell is the Ellcrys token contract.
    EIP20Interface ell;

    // dil is Dilithium token contract.
    Dilithium public dil;

    // auc is the Latinum auction toke contract.
    Auction public auc;

    // swapped keeps count of the number of LTN minted for swapped ELL tokens.
    uint256 public swapped;

    // ellSwapped is the number of ELL swapped.
    uint256 public ellSwapped;

    // maxSwappableELL is the maximum number of ELL that can be swapped.
    uint256 public maxSwappableELL;

    event SwappedELL(address account, uint256 amount);
    event DILMinted(address recipient, uint256 amt);

    /// @dev initializes the contract
    /// @param _maxSwappableELL max. number of ELL that can be swapped.
    /// @param _ellAddress is the contract address of the ELL token.
    /// @param _dilAddress is the contract address of the DIL token.
    constructor(
        uint256 _maxSwappableELL,
        address _ellAddress,
        address _dilAddress
    ) public {
        ell = EIP20Interface(_ellAddress);
        dil = Dilithium(_dilAddress);
        maxSwappableELL = _maxSwappableELL;
    }

    /// @dev setAuc sets the auction contract address
    function setAuc(address payable addr) public isOwner() {
        require(auc == Auction(address(0)), "Already set");
        auc = Auction(addr);
    }

    /// @dev swapELL swaps ELL approved by <from> by burning it
    /// and minting LTN of upto 10% of the burned ELL.
    ///
    /// Requirement: The function requires the ELL account (from) to have allowed
    /// the contract to transfer the swap amount.
    ///
    /// @param swapAmount is the amount of ELL that 'from' has approved to be burned.
    function swapELL(uint256 swapAmount) public {
        require(swapAmount > 0, "Amount cannot be zero");
        require(
            ell.allowance(msg.sender, address(this)) >= swapAmount,
            "Amount not unlocked"
        );
        require(
            SM.add(ellSwapped, swapAmount) <= maxSwappableELL,
            "Total swappable ELL reached"
        );

        uint256 mintAmount =
            SM.sub(swapAmount, SM.div(SM.mul(swapAmount, 900), 1000));

        ell.transferFrom(msg.sender, address(0), swapAmount);
        auc.mint(msg.sender, mintAmount);
        swapped = SM.add(swapped, mintAmount);
        ellSwapped = SM.add(ellSwapped, swapAmount);
        emit SwappedELL(msg.sender, swapAmount);
    }

    /// @notice mintDIL allows the contract owner to mint DIL tokens.
    /// @param recipient is the beneficiary of the minted amount.
    /// @param amt is the amount to be minted.
    function mintDIL(address recipient, uint256 amt)
        public
        isOwner()
        returns (bool)
    {
        dil.mint(recipient, amt);
        emit DILMinted(recipient, amt);
        return true;
    }

    /// @dev setFundingAddress sets the funding address
    /// @param addr is the address to change to.
    function setFundingAddress(address addr) public isOwner() {
        auc.setFundingAddress(addr);
    }

    /// @dev setFee sets the auction fee.
    /// @param _fee is the new auction fee.
    function setFee(uint256 _fee) public isOwner() {
        auc.setFee(_fee);
    }

    /// @dev transferUnallocated transfers unallocated Latinum supply to an
    /// account.
    /// @param to is the account to transfer to.
    /// @param amt is the amount to tranfer.
    function transferUnallocated(address to, uint256 amt) public isOwner() {
        auc.transferUnallocated(to, amt);
    }

    /// @dev setMaxPeriods updates the number of auction periods.
    /// @param n is the new number of periods
    function setMaxPeriods(uint256 n) public isOwner() {
        auc.setMaxPeriods(n);
    }

    /// @dev setMinReqDILTotalSupply updates the required min DIL supply.
    /// @param n is the new value
    function setMinReqDILTotalSupply(uint256 n) public isOwner() {
        auc.setMinReqDILTotalSupply(n);
    }
}
