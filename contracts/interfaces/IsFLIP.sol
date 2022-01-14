// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IsFLIP {
    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function deposit(address to, uint256 underlyingAmount) external returns (uint256 shares);

    function mint(address to, uint256 shareAmount) external returns (uint256 underlyingAmount);

    function withdraw(address from, address to, uint256 underlyingAmount) external returns (uint256 shares);

    function redeem(address from, address to, uint256 shareAmount) external returns (uint256 underlyingAmount);

    /*///////////////////////////////////////////////////////////////
                        VAULT ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    function totalHoldings() external view returns (uint256);

    function balanceOfUnderlying(address user) external view returns (uint256);

    function calculateShares(uint256 underlyingAmount) external view returns (uint256);

    function calculateUnderlying(uint256 shareAmount) external view returns (uint256);
}
