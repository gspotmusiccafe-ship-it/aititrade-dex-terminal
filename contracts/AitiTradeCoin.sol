// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * AITITRADE COIN ($AITI) — BEP-20
 * Sovereign Trust Vault: 0x09632e2582E1d21E45852964541b0539D6594b50
 * Total Supply: 100,000,000 AITI (fixed, no mint after deploy)
 * Transfer Tax: 2% routed to Sovereign Vault (Double-Dip Hook)
 */
contract AitiTradeCoin is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;
    uint256 public constant TAX = 2; // 2% Sovereign Tax
    address public trustVault = 0x09632e2582E1d21E45852964541b0539D6594b50;

    constructor() ERC20("AitiTrade Coin", "AITI") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != owner() && to != owner() && from != address(0)) {
            uint256 taxAmount = (amount * TAX) / 100;
            super._update(from, trustVault, taxAmount);
            super._update(from, to, amount - taxAmount);
        } else {
            super._update(from, to, amount);
        }
    }
}
