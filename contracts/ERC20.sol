// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import '@rari-capital/solmate/src/tokens/ERC20.sol';

contract ERC20Basic is ERC20 {
    constructor() ERC20("ERC20 token", "ERC", 18) {
        balanceOf[msg.sender] = 1000000000000000000000000; // 1 million * 1e18
    }
}

contract WAVAX is ERC20 {
    constructor() ERC20("Wrapped Avax", "WAVAX", 18) {
        balanceOf[msg.sender] = 1000000000000000000000000; // 1 million * 1e18
    }
}

contract FLIP is ERC20 {
    address owner;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor(address _owner) ERC20("Flippening Token", "FLIP", 18) {
        owner = _owner;
    }

    function mint(address to, uint256 amount) public payable onlyOwner {
        _mint(to, amount);
    }
}
