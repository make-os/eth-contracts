// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./DepositDIL.sol";
import "./Owner.sol";
import "./Dilithium.sol";
import "./Auction.sol";
import "./libs/ell/EIP20.sol";

/// @title Main
contract Main is DepositDIL {
    Dilithium public dil;
    EIP20 ell;
    Auction public auc;
    uint256 public swapped;
    uint256 public ellSwapped;
    uint256 public maxSwappableELL;
    address public fundingAddress;

    event SwappedELL(address account, uint256 amount);

    /// @dev initializes the contract
    /// @param _maxSwappableELL max. number of ELL that can be swapped.
    /// @param _ellAddress is the contract address of the ELL token.
    /// @param _dilAddress is the contract address of the DIL token.
    /// @param _aucAddress is the contract address of the auction and LTN token.
    constructor(
        uint256 _maxSwappableELL,
        address _ellAddress,
        address _dilAddress,
        address _aucAddress,
        address _fundingAddress
    ) {
        dil = Dilithium(_dilAddress);
        ell = EIP20(_ellAddress);
        auc = Auction(_aucAddress);
        maxSwappableELL = _maxSwappableELL;
        fundingAddress = _fundingAddress;
    }

    receive() external payable {}

    fallback() external payable {}

    /// @dev setFundingAddress sets the funding address
    /// @param addr is the address to change to.
    function setFundingAddress(address addr) public isOwner() {
        fundingAddress = addr;
    }

    /// @dev withdraw sends ETH to the funding address.
    /// @param amount is the amount to be withdrawn.
    function withdraw(uint256 amount) external {
        require(msg.sender == fundingAddress, "Sender not the funding address");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    /// @dev swapELL swaps ELL approved by from by burning it
    /// and minting new LTN up to the given mint amount.
    ///
    /// Requirement: The function requires the ELL account (from) to have allowed
    /// the contract to transfer the swap amount.
    ///
    /// @param from is the account whose ELL will be burned for LTN.
    /// @param swapAmount is the amount of ELL that 'from' has approved to be burned.
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
        require(
            ellSwapped + swapAmount <= maxSwappableELL,
            "Total swappable ELL reached"
        );

        ell.transferFrom(from, address(0), swapAmount);
        auc.mint(from, mintAmount);
        swapped += mintAmount;
        ellSwapped += swapAmount;
        emit SwappedELL(from, swapAmount);
    }
}
