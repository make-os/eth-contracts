// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./Owner.sol";
import "./libs/SafeMath.sol";

/// @notice DepositInfo represents a DIL ownership information
struct DepositInfo {
    uint256 balance;
    uint256 nextLimit;
    bool moved;
}

/// @title DepositDIL
/// @notice This contract mints Dilithium
/// @author kennedy
contract DepositDIL is Owner {
    // Mint fee is the fee paid per mint limit
    uint256 public mintFee = 100000000000000000;

    // The total unit of Dilithium the mint fee can pay for.
    uint256 public limit = 50000;

    // The allocation of minted Dilithium.
    mapping(address => DepositInfo) public deposited;

    event DILMinted(address recipient, uint256 amt);

    /// @notice mint allows the contract owner to mint DIL tokens.
    /// @param recipient is the beneficiary of the minted amount.
    /// @param amt is the amount to be minted.
    function mint(address recipient, uint256 amt)
        public
        payable
        isOwner()
        returns (bool)
    {
        // Get current balance of recipient
        uint256 curBalance = deposited[recipient].balance;
        bool movedBalance = deposited[recipient].moved;

        // If receipient has no balance, allocate the specified amount.
        if (curBalance == 0 && !movedBalance) {
            deposited[recipient] = DepositInfo(amt, limit, false);
            emit DILMinted(recipient, amt);
            return true;
        }

        // If current balance is equal to the address's minit limit or the current balance
        // + the amount to mint is more than the mint limit, we expect a mint fee.
        uint256 mintLimit = getNextMintLimit(recipient);
        bool requireMintFee =
            curBalance > mintLimit || SafeMath.add(curBalance, amt) > mintLimit;
        if (requireMintFee) {
            require(msg.value >= mintFee, "Insufficient mint fee");
        }

        // At this point, the mint fee is okay. Mint and allocate.
        deposited[recipient].balance = SafeMath.add(curBalance, amt);

        // If the address paid a mint fee, we can increase their mint limit.
        if (requireMintFee) {
            deposited[recipient].nextLimit = SafeMath.add(mintLimit, limit);
        }

        emit DILMinted(recipient, amt);

        return true;
    }

    /// @notice getDILBalance returns the Dilithium balance of an address.
    /// @param addr The address whose balance must be looked up.
    function getDILBalance(address addr) public view returns (uint256) {
        return deposited[addr].balance;
    }

    /// @notice getNextMintLimit returns the address's current next limit
    // threshold where it will be expected to pay a mint fee.
    // @param addr The address whose next limit is being queried.
    function getNextMintLimit(address addr) public view returns (uint256) {
        return deposited[addr].nextLimit;
    }

    /// @notice setMintFee sets the mint fee
    /// @param fee is the new fee
    function setMintFee(uint256 fee) public isOwner() {
        mintFee = fee;
    }

    /// @notice setLimit sets the mint limit
    /// @param value is the new limit
    function setLimit(uint256 value) public isOwner() {
        limit = value;
    }
}
