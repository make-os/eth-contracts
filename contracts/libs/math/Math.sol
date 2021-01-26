// SPDX-License-Identifier: MIT
pragma solidity >0.4.25 <0.9.0;

import "./SafeMath.sol";

/**
 * @dev Provides math functions.
 */
library Math {
    event X(uint256 x);

    /// @dev getBPSOfAInB calculate the percentage of a in b and returns the
    /// base point of the percentage. 'a' is called up before use and scaled
    /// back down before base point calculation.
    function getBPSOfAInB(uint256 a, uint256 b)
        internal
        pure
        returns (uint256)
    {
        uint256 scale = 10**18;
        uint256 scaledA = SafeMath.mul(a, scale);
        uint256 x = SafeMath.mul(SafeMath.div(scaledA, b), 100);
        uint256 bps = SafeMath.div(SafeMath.mul(x, 100), scale);
        return bps;
    }
}
