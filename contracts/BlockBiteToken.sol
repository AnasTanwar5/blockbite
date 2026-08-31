// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlockBiteToken ($BITE)
 * @notice ERC20 Reward Token for the BLOCKBITE Decentralized Food Delivery Platform.
 * @dev Implements custom minting roles for the Escrow contract, pause functionality, and ownership controls.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract BlockBiteToken is IERC20 {
    string public name = "BlockBite Reward Token";
    string public symbol = "BITE";
    uint8 public decimals = 18;
    uint256 private _totalSupply;

    address public owner;
    address public escrowContract;
    bool public paused;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EscrowContractUpdated(address indexed previousEscrow, address indexed newEscrow);
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyOwner() {
        require(msg.sender == owner, "BlockBiteToken: caller is not the owner");
        _;
    }

    modifier onlyEscrowOrOwner() {
        require(
            msg.sender == escrowContract || msg.sender == owner,
            "BlockBiteToken: caller is not authorized minter"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "BlockBiteToken: token transfers are paused");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply * 10**uint256(decimals));
        }
    }

    function setEscrowContract(address _escrow) external onlyOwner {
        require(_escrow != address(0), "BlockBiteToken: invalid escrow address");
        emit EscrowContractUpdated(escrowContract, _escrow);
        escrowContract = _escrow;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "BlockBiteToken: new owner is 0 address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external override whenNotPaused returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) external view override returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) external override whenNotPaused returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "BlockBiteToken: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);
        _transfer(sender, recipient, amount);
        return true;
    }

    function mintReward(address recipient, uint256 amount) external onlyEscrowOrOwner whenNotPaused returns (bool) {
        require(recipient != address(0), "BlockBiteToken: mint to 0 address");
        _mint(recipient, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwner whenNotPaused returns (bool) {
        _mint(to, amount);
        return true;
    }

    function _approve(address ownerAccount, address spender, uint256 amount) internal {
        require(ownerAccount != address(0), "BlockBiteToken: approve from 0 address");
        require(spender != address(0), "BlockBiteToken: approve to 0 address");
        _allowances[ownerAccount][spender] = amount;
        emit Approval(ownerAccount, spender, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "BlockBiteToken: transfer from 0 address");
        require(recipient != address(0), "BlockBiteToken: transfer to 0 address");
        require(_balances[sender] >= amount, "BlockBiteToken: transfer amount exceeds balance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "BlockBiteToken: mint to 0 address");
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }
}
