// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./DepositDIL.sol";
import "./Owner.sol";
import "./Dilithium.sol";
import "./Auction.sol";
import "./libraries/ell/EIP20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./libraries/uniswap/UniswapV2Router02.sol";
import "./libraries/math/SafeMath.sol";

struct LiquidityTicket {
    uint256 amount;
    uint256 lockedAt;
    bool LTN_ETH;
    bool DIL_ETH;
}

/// @title Main
contract Main is DepositDIL {
    // ell is the Ellcrys token contract.
    EIP20 ell;

    // Auction is the Latinum auction contract and token.
    Auction public auc;

    // swapped keeps count of the number of LTN minted for swapped ELL tokens.
    uint256 public swapped;

    // ellSwapped is the number of ELL swapped.
    uint256 public ellSwapped;

    // maxSwappableELL is the maximum number of ELL that can be swapped.
    uint256 public maxSwappableELL;

    // fundingAddress is the address where contract fund can be transfered to.
    address public fundingAddress;

    // lockedLTN_WETH is the locked LTN/WETH Uniswap pool tokens.
    mapping(address => LiquidityTicket) public lockedLTN_WETH;

    // lockedDIL_WETH is the locked DIL/WETH Uniswap pool tokens.
    mapping(address => LiquidityTicket) public lockedDIL_WETH;

    // router is the Uniswap v2 router
    UniswapV2Router02 router;

    event SwappedELL(address account, uint256 amount);
    event LiquidityLocked(address owner, uint256 amount, bool LTN_ETH);
    event LiquidityUnLocked(address owner, uint256 amount, bool LTN_ETH);

    /// @dev initializes the contract
    /// @param _dilDepositFee is the DIL deposit fee.
    /// @param _maxSwappableELL max. number of ELL that can be swapped.
    /// @param _ellAddress is the contract address of the ELL token.
    /// @param _dilAddress is the contract address of the DIL token.
    /// @param _aucAddress is the contract address of the auction and LTN token.
    /// @param _uniswapV2RouterAddress is the contract address of uniswap V2 router.
    constructor(
        uint256 _dilDepositFee,
        uint256 _maxSwappableELL,
        address _ellAddress,
        address _dilAddress,
        address _aucAddress,
        address _fundingAddress,
        address payable _uniswapV2RouterAddress
    ) public {
        ell = EIP20(_ellAddress);
        auc = Auction(_aucAddress);
        dil = Dilithium(_dilAddress);
        maxSwappableELL = _maxSwappableELL;
        fundingAddress = _fundingAddress;
        setDilInstance(dil);
        setDepositFee(_dilDepositFee);
        router = UniswapV2Router02(_uniswapV2RouterAddress);
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
        require(msg.sender == fundingAddress, "Not authorized");
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
            SM.add(ellSwapped, swapAmount) <= maxSwappableELL,
            "Total swappable ELL reached"
        );

        ell.transferFrom(from, address(0), swapAmount);
        auc.mint(from, mintAmount);
        swapped = SM.add(swapped, mintAmount);
        ellSwapped = SM.add(ellSwapped, swapAmount);
        emit SwappedELL(from, swapAmount);
    }

    /// @dev lockLiquidity locks LTN/ETH and DIL/ETH Uniswap liquidity.
    /// @param amount is the number of liquidity to lock. Up to this amount
    /// must have been approved by the sender.
    /// @param ltnEth indicates that the LTN/ETH liquidity should be locked
    /// instead of the DIL/ETH pool liquidity
    function lockLiquidity(uint256 amount, bool ltnEth) external {
        address token = (ltnEth) ? address(auc) : address(dil);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));

        require(
            pair.allowance(msg.sender, address(this)) >= amount,
            "Amount not approved"
        );

        pair.transferFrom(msg.sender, address(this), amount);

        if (ltnEth) {
            lockedLTN_WETH[msg.sender].amount = SM.add(
                lockedLTN_WETH[msg.sender].amount,
                amount
            );
            lockedLTN_WETH[msg.sender].LTN_ETH = true;
            lockedLTN_WETH[msg.sender].DIL_ETH = false;
            if (lockedLTN_WETH[msg.sender].lockedAt == 0) {
                lockedLTN_WETH[msg.sender].lockedAt = block.timestamp;
            }
        } else {
            lockedDIL_WETH[msg.sender].amount = SM.add(
                lockedDIL_WETH[msg.sender].amount,
                amount
            );
            lockedDIL_WETH[msg.sender].LTN_ETH = false;
            lockedDIL_WETH[msg.sender].DIL_ETH = true;
            if (lockedDIL_WETH[msg.sender].lockedAt == 0) {
                lockedDIL_WETH[msg.sender].lockedAt = block.timestamp;
            }
        }

        emit LiquidityLocked(msg.sender, amount, ltnEth);
    }

    /// @dev unlockLiquidity unlocks locked LTN/ETH or DIL/ETH Uniswap
    /// liquidity.
    /// @param ltnEth indicates that the LTN/ETH liquidity should be unlocked
    /// instead of the DIL/ETH pool liquidity
    function unlockLiquidity(bool ltnEth) external {
        address token = (ltnEth) ? address(auc) : address(dil);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));

        LiquidityTicket memory ticket =
            (ltnEth) ? lockedLTN_WETH[msg.sender] : lockedDIL_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        pair.transfer(msg.sender, ticket.amount);

        if (ltnEth) {
            delete lockedLTN_WETH[msg.sender];
        } else {
            delete lockedDIL_WETH[msg.sender];
        }

        emit LiquidityUnLocked(msg.sender, ticket.amount, ltnEth);
    }

    /// @dev totalLiquidity returns the total liquidity in a LTN/WETH or
    /// DIL/WETH pool.
    /// @param ltnEth targets the LTN/ETH pool liquidity, otherwise, the DIL/ETH.
    function totalLiquidity(bool ltnEth) public view returns (uint256) {
        address token = (ltnEth) ? address(auc) : address(dil);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));
        return pair.totalSupply();
    }

    /// @dev calcLiquidityReward calculates an LP's reward given the
    /// liquidity, liquidity age and total liquidity.
    /// @param _liquidityAge is the age of the liquidity.
    /// @param _liquidity is the LP's amount liquidity.
    /// @param _totalLiquidity is the total liquidity from all LPs.
    function calcLiquidityReward(
        uint256 _liquidityAge,
        uint256 _liquidity,
        uint256 _totalLiquidity
    ) public pure returns (uint256) {
        return
            SM.sqrt(SM.div(SM.mul(_liquidity, _liquidityAge), _totalLiquidity));
    }

    /// @dev calcSenderLiquidityReward claims the current reward earned by a
    /// liquidity ticket.
    /// @param _ltnEth targets the LTN/ETH pool liquidity, otherwise, the DIL/ETH.
    /// @param _now is the current unix time (preferrable the last block timestamp).
    function calcSenderLiquidityReward(bool _ltnEth, uint256 _now)
        public
        view
        returns (uint256)
    {
        LiquidityTicket memory ticket =
            (_ltnEth) ? lockedLTN_WETH[msg.sender] : lockedDIL_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        return
            calcLiquidityReward(
                _now - ticket.lockedAt,
                ticket.amount,
                totalLiquidity(_ltnEth)
            );
    }

    /// @dev claimLiquidityReward claims the current reward earned by a
    /// liquidity ticket.
    /// @param ltnEth targets the LTN/ETH pool liquidity, otherwise, the DIL/ETH.
    function claimLiquidityReward(bool ltnEth) public {
        LiquidityTicket memory ticket =
            (ltnEth) ? lockedLTN_WETH[msg.sender] : lockedDIL_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        uint256 reward =
            calcLiquidityReward(
                block.timestamp - ticket.lockedAt,
                ticket.amount,
                totalLiquidity(ltnEth)
            );

        ticket.lockedAt = block.timestamp;
        if (ltnEth) {
            lockedLTN_WETH[msg.sender] = ticket;
        } else {
            lockedDIL_WETH[msg.sender] = ticket;
        }

        auc.mint(msg.sender, 1 wei * reward);
    }
}
