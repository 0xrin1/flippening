//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;

import '@rari-capital/solmate/src/tokens/ERC20.sol';
import '@rari-capital/solmate/src/mixins/ERC4626.sol';

import 'hardhat/console.sol';

contract sFLIP is ERC4626 {
    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol
    ) ERC4626(_underlying, _name, _symbol) {}
    function totalHoldings() public view virtual override returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function afterDeposit(uint256 underlyingAmount) internal virtual override {
        console.log('after deposit');
    }
}
