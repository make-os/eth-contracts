// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "@uniswap/v2-periphery/contracts/interfaces/IERC20.sol";
import "../../math/Math.sol";

struct DecayState {
    uint256 rate;
    uint256 startTime;
    uint256 endTime;
}

/**
 * @dev Implementation of the {IERC20} interface with
 * support for decaying balances.
 */
contract ERC20Decayable is IERC20 {
    using SM for uint256;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    // decayStates holds account decay status.
    mapping(address => DecayState) decayStates;

    // decayHaltFee is the number of DIL required to stop 1 DIL from decaying.
    uint256 public decayHaltFee;

    // decayDur is the number of seconds it takes for DIL to be fully decayed.
    uint256 public decayDur;

    address public ltnAddr;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 _oneDIL;

    event BurnForMainnet(uint256 amount, bytes32 mainnetAddr);

    /**
     * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
     * a default value of 18.
     *
     * To select a different value for {decimals}, use {_setupDecimals}.
     *
     * All three of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(string memory name_, string memory symbol_) public {
        _name = name_;
        _symbol = symbol_;
        _decimals = 18;
        _oneDIL = 10**uint256(decimals());
    }

    function _msgSender() internal view virtual returns (address payable) {
        return payable(msg.sender);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20Decayable} uses, unless {_setupDecimals} is
     * called.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20Decayable}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()].sub(
                amount,
                "ERC20Decayable: transfer amount exceeds allowance"
            )
        );
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue)
        public
        virtual
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].add(addedValue)
        );
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        virtual
        returns (bool)
    {
        _approve(
            _msgSender(),
            spender,
            _allowances[_msgSender()][spender].sub(
                subtractedValue,
                "ERC20Decayable: decreased allowance below zero"
            )
        );
        return true;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(
            sender != address(0),
            "ERC20Decayable: transfer from the zero address"
        );
        require(
            recipient != address(0),
            "ERC20Decayable: transfer to the zero address"
        );

        _beforeTokenTransfer(sender, recipient, amount);
        _burnDecayed(sender);
        _burnDecayed(recipient);

        _balances[sender] = _balanceOf(sender).sub(
            amount,
            "ERC20Decayable: transfer amount exceeds balance"
        );
        _balances[recipient] = _balances[recipient].add(amount);

        _updateDecayStateOnly(sender, block.timestamp);
        _updateDecayStateOnly(recipient, block.timestamp);

        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(
            account != address(0),
            "ERC20Decayable: mint to the zero address"
        );

        _beforeTokenTransfer(address(0), account, amount);
        _burnDecayed(account);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);

        _updateDecayStateOnly(account, block.timestamp);

        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        require(
            account != address(0),
            "ERC20Decayable: burn from the zero address"
        );

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balanceOf(account).sub(
            amount,
            "ERC20Decayable: burn amount exceeds balance"
        );
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(
            owner != address(0),
            "ERC20Decayable: approve from the zero address"
        );
        require(
            spender != address(0),
            "ERC20Decayable: approve to the zero address"
        );

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Sets {decimals} to a value other than the default one of 18.
     *
     * WARNING: This function should only be called from the constructor. Most
     * applications that interact with token contracts will not expect
     * {decimals} to ever change, and may work incorrectly if it does.
     */
    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev _balanceOf implements IERC20.
     * @param account is the target account.
     */
    function _balanceOf(address account) internal view returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev balanceOf implements IERC20. It is like _balanceOf except it subtracts decayed amount.
     * @param account is the target account.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account].sub(decayedBalanceOf(account));
    }

    /// @dev _burnDecayed burns decayed DIL and reset decay state.
    /// @param account is the target account to alter.
    function _burnDecayed(address account) internal {
        _burn(account, decayedBalanceOf(account));
        decayStates[account].rate = 0;
        decayStates[account].startTime = 0;
        decayStates[account].endTime = 0;
    }

    /**
     * @dev decayedBalanceOf returns the amount that has decayed.
     * @param account is the target account.
     */
    function decayedBalanceOf(address account) public view returns (uint256) {
        DecayState memory ds = decayStates[account];

        if (ds.rate == 0) {
            return 0;
        }

        // If decay period has ended, return total decayed amount;
        if (ds.endTime < block.timestamp) {
            return ds.endTime.sub(ds.startTime).mul(ds.rate);
        }

        return block.timestamp.sub(ds.startTime).mul(ds.rate);
    }

    /**
     * @dev getDecayState returns the decay state of an account.
     * @param account is the target account.
     */
    function getDecayState(address account)
        public
        view
        returns (
            uint256 rate,
            uint256 startTime,
            uint256 endTime
        )
    {
        DecayState memory ds = decayStates[account];
        rate = ds.rate;
        startTime = ds.startTime;
        endTime = ds.endTime;
    }

    /// @dev _updateDecayStateOnly only calculates the latest decay state of an account
    /// @param account is the target account.
    /// @param blockTime is the current block timestamp.
    function _updateDecayStateOnly(address account, uint256 blockTime)
        internal
    {
        // Determine the amount of DIL that can be shielded from decay
        uint256 curBalLTN = IERC20(ltnAddr).balanceOf(account);
        uint256 amountShieldable = SM.div(curBalLTN, decayHaltFee) * _oneDIL;

        // Reset state to zero if existing DIL balance can be shielded.
        uint256 curBal = balanceOf(account);
        if (curBal <= amountShieldable) {
            decayStates[account].rate = 0;
            decayStates[account].startTime = 0;
            decayStates[account].endTime = 0;
            return;
        }

        // else, calculate new decay rate and period.
        uint256 amtToDecay = SM.sub(curBal, amountShieldable);
        uint256 decayRatePerSec = SM.div(amtToDecay, decayDur);
        decayStates[account].rate = decayRatePerSec;
        decayStates[account].startTime = blockTime;
        decayStates[account].endTime = SM.add(blockTime, decayDur);
    }

    /// @dev updateDecayState calculates the latest decay state of an account
    /// @param account is the target account.
    /// @param blockTime is the current block timestamp.
    function _updateDecayState(address account, uint256 blockTime) internal {
        _burnDecayed(account);
        _updateDecayStateOnly(account, blockTime);
    }

    /// @dev _setDecayHaltFee sets the decay halt fee (in smallest LTN)
    function _setDecayHaltFee(uint256 val) internal {
        decayHaltFee = val;
    }

    /// @dev _setDecayDuration sets the decay duraion for unshieled DIL.
    function _setDecayDuration(uint256 val) internal {
        decayDur = val;
    }

    /**
     * @dev burnForMainnet burns all account balance and emits an event.
     * @param mainnetAddr is the MakeOS address that will be credited.
     */
    function burnForMainnet(bytes32 mainnetAddr) public {
        uint256 amt = balanceOf(_msgSender());
        _burn(_msgSender(), amt);
        emit BurnForMainnet(amt, mainnetAddr);
    }
}
