// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./SafeMath.sol";

/**
 * @dev Provides math functions.
 */
library Math {
    /// @dev getBPSOfAInB calculate the percentage of a in b and returns the
    /// base point of the percentage. 'a' is called up before use and scaled
    /// back down before base point calculation.
    function getBPSOfAInB(uint256 a, uint256 b)
        internal
        pure
        returns (uint256)
    {
        uint256 scale = 10**18;
        uint256 scaledA = SM.mul(a, scale);
        uint256 x = SM.mul(SM.div(scaledA, b), 100);
        uint256 bps = SM.div(SM.mul(x, 100), scale);
        return bps;
    }
}
