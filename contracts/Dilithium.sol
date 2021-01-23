// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./Owner.sol";
import "./libs/token/ERC20/ERC20.sol";

/// @dev Dilithium ERC20 contract
contract Dilithium is ERC20("Dilithium", "DIL"), Owner {

}
