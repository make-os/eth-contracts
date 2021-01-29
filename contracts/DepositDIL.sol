// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./Dilithium.sol";
import "./libs/math/SafeMath.sol";

/// @notice DepositInfo represents a DIL ownership information
struct DepositInfo {
    uint256 balance;
}

/// @title DepositDIL
/// @notice This contract mints Dilithium
/// @author kennedy
contract DepositDIL is Owner {
    Dilithium dil;

    // deposit fee is the fee paid per 1 minted DIL
    uint256 public depositFee;

    // The allocation of minted Dilithium.
    mapping(address => DepositInfo) public deposited;

    event DILMinted(address recipient, uint256 amt);

    /// @notice mintDIL allows the contract owner to mint DIL tokens.
    /// @param recipient is the beneficiary of the minted amount.
    /// @param amt is the amount to be minted.
    function mintDIL(address recipient, uint256 amt)
        public
        payable
        isOwner()
        returns (bool)
    {
        // Get current balance of recipient
        uint256 curBalance = deposited[recipient].balance;

        // If recipient has no balance, allocate the specified amount
        // without a deposit fee required.
        if (curBalance == 0) {
            transferDIL(recipient, amt);
            return true;
        }

        // Require a deposit fee to be sent. Total deposit fee
        // is depositFee * amount to be deposited.
        require(
            msg.value >= SM.mul(depositFee, amt),
            "Insufficient deposit fee"
        );

        // Mint and allocate.
        transferDIL(recipient, amt);
        return true;
    }

    /// @dev transferDIL transfer mints DIL on the DIL token contract.
    function transferDIL(address to, uint256 amount) internal {
        uint256 curBal = deposited[to].balance;
        deposited[to].balance = SM.add(curBal, amount);
        dil.mint(to, amount);
        emit DILMinted(to, amount);
    }

    /// @notice totalDepositedDIL returns the total deposited Dilithium balance of an address.
    /// @param addr The address whose balance must be looked up.
    function totalDepositedDIL(address addr) public view returns (uint256) {
        return deposited[addr].balance;
    }

    /// @notice setDepositFee sets the deposit fee
    /// @param fee is the new fee
    function setDepositFee(uint256 fee) public isOwner() {
        depositFee = fee;
    }

    /// @dev setDilInstance sets the DIL contract instance
    /// @param _dil is the DIL contract.
    function setDilInstance(Dilithium _dil) internal {
        dil = _dil;
    }
}
