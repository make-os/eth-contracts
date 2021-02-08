// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "./Owner.sol";
import "./Dilithium.sol";
import "./Auction.sol";
import "./libraries/ell/EIP20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./libraries/uniswap/UniswapV2Router02.sol";
import "./libraries/math/Math.sol";

struct LiquidityTicket {
    uint256 amount;
    uint256 lockedAt;
    bool LTN_ETH;
    bool DIL_ETH;
}

/// @title Main
contract Main is Owner {
    // ell is the Ellcrys token contract.
    EIP20 ell;

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

    // rewardK is K constant in liquidity reward calculation
    uint256 public rewardK;

    // lockedLTN_WETH is the locked LTN/WETH Uniswap pool tokens.
    mapping(address => LiquidityTicket) public lockedLTN_WETH;

    // router is the Uniswap v2 router
    UniswapV2Router02 router;

    event SwappedELL(address account, uint256 amount);
    event LiquidityLocked(address owner, uint256 amount);
    event LiquidityUnLocked(address owner, uint256 amount);
    event DILMinted(address recipient, uint256 amt);

    /// @dev initializes the contract
    /// @param _maxSwappableELL max. number of ELL that can be swapped.
    /// @param _ellAddress is the contract address of the ELL token.
    /// @param _dilAddress is the contract address of the DIL token.
    /// @param _aucAddress is the contract address of the auction and LTN token.
    /// @param _uniswapV2RouterAddress is the contract address of uniswap V2 router.
    constructor(
        uint256 _maxSwappableELL,
        address _ellAddress,
        address _dilAddress,
        address payable _aucAddress,
        address payable _uniswapV2RouterAddress
    ) public {
        ell = EIP20(_ellAddress);
        auc = Auction(_aucAddress);
        dil = Dilithium(_dilAddress);
        maxSwappableELL = _maxSwappableELL;
        router = UniswapV2Router02(_uniswapV2RouterAddress);
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

    /// @dev lockLiquidity locks LTN/ETH Uniswap liquidity.
    /// @param amount is the number of liquidity to lock. Up to this amount
    /// must have been approved by the sender.
    function lockLiquidity(uint256 amount) external {
        address token = address(auc);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));

        require(
            pair.allowance(msg.sender, address(this)) >= amount,
            "Amount not approved"
        );

        pair.transferFrom(msg.sender, address(this), amount);

        lockedLTN_WETH[msg.sender].amount = SM.add(
            lockedLTN_WETH[msg.sender].amount,
            amount
        );
        lockedLTN_WETH[msg.sender].LTN_ETH = true;
        lockedLTN_WETH[msg.sender].DIL_ETH = false;
        if (lockedLTN_WETH[msg.sender].lockedAt == 0) {
            lockedLTN_WETH[msg.sender].lockedAt = block.timestamp;
        }

        emit LiquidityLocked(msg.sender, amount);
    }

    /// @dev unlockLiquidity unlocks locked LTN/ETH Uniswap
    /// liquidity.
    function unlockLiquidity() external {
        address token = address(auc);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));

        LiquidityTicket memory ticket = lockedLTN_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        pair.transfer(msg.sender, ticket.amount);

        delete lockedLTN_WETH[msg.sender];

        emit LiquidityUnLocked(msg.sender, ticket.amount);
    }

    /// @dev totalLiquidity returns the total liquidity in a LTN/WETH pool.
    function totalLiquidity() public view returns (uint256) {
        address token = address(auc);
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        IUniswapV2Pair pair =
            IUniswapV2Pair(factory.getPair(token, router.WETH()));
        return pair.totalSupply();
    }

    /// @dev setK sets the funding address
    /// @param _k is the new liquidity reward K constant.
    function setK(uint256 _k) public isOwner() {
        rewardK = _k;
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
    ) public view returns (uint256) {
        uint256 x =
            SM.sqrt(SM.div(SM.mul(_liquidity, _liquidityAge), _totalLiquidity));
        return SM.add(x, rewardK);
    }

    /// @dev calcSenderLiquidityReward claims the current reward earned by a
    /// liquidity ticket.
    /// @param _now is the current unix time (preferrable the last block timestamp).
    function calcSenderLiquidityReward(uint256 _now)
        public
        view
        returns (uint256)
    {
        LiquidityTicket memory ticket = lockedLTN_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        return
            calcLiquidityReward(
                _now - ticket.lockedAt,
                ticket.amount,
                totalLiquidity()
            );
    }

    /// @dev claimLiquidityReward claims the current reward earned by a
    /// liquidity ticket.
    function claimLiquidityReward() public {
        LiquidityTicket memory ticket = lockedLTN_WETH[msg.sender];
        require(ticket.lockedAt > 0, "Liquidity not found");

        uint256 reward =
            calcLiquidityReward(
                block.timestamp - ticket.lockedAt,
                ticket.amount,
                totalLiquidity()
            );

        ticket.lockedAt = block.timestamp;
        lockedLTN_WETH[msg.sender] = ticket;

        auc.mint(msg.sender, 1 wei * reward);
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

    /// @dev setDecayHaltFee sets the decay halt fee.
    function setDecayHaltFee(uint256 val) public isOwner() {
        dil.setDecayHaltFee(val);
    }

    /// @dev setDecayDuration sets the number of seconds it takes for DIL to decay.
    function setDecayDuration(uint256 val) public isOwner() {
        dil.setDecayDuration(val);
    }

    /// @dev setFundingAddress sets the funding address
    /// @param addr is the address to change to.
    function setFundingAddress(address addr) public isOwner() {
        auc.setFundingAddress(addr);
    }
}
