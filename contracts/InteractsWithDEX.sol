// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './interfaces/IERC20.sol';
import './interfaces/IFLIP.sol';

import './libraries/SafeMath.sol';

import '@traderjoe-xyz/core/contracts/traderjoe/libraries/JoeLibrary.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoePair.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeFactory.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeRouter02.sol';

abstract contract InteractsWithDEX {
	using SafeMath for *;

    IERC20 WAVAXToken;

    IFLIP flipsToken;

    IJoeRouter02 private joeRouter;

    IJoeFactory private joeFactory;

	address private owner;

	/**
		* @dev Throws if called by any account other than the owner.
		*/
	modifier onlyOwner() {
		require(owner == msg.sender, 'Ownable: caller is not the owner');
		_;
	}

	constructor(
		address _owner,
		address WAVAXAddress,
		address joeRouterAddress
	) {
        owner = _owner;
		WAVAXToken = IERC20(WAVAXAddress);
		joeRouter = IJoeRouter02(joeRouterAddress);
		joeFactory = IJoeFactory(joeRouter.factory());
	}

	function setFlipsAddress(address _flipsAddress) public onlyOwner {
		flipsToken = IFLIP(_flipsAddress);
	}

	// Determine liquidity pair for flips and wavax tokens and create if null address returned.
	function getLiquidityPair() internal returns (IJoePair pair) {
		address pairAddress = joeFactory.getPair(address(flipsToken), address(WAVAXToken));

		if (pairAddress == address(0)) {
			pairAddress = joeFactory.createPair(address(flipsToken), address(WAVAXToken));
		}

		return IJoePair(pairAddress);
	}

	/// Get WETH pair of provided token.
	function getPair(address token) internal view returns (IJoePair) {
		(address tokenA, address tokenB) = JoeLibrary.sortTokens(token, address(WAVAXToken));
		return IJoePair(joeFactory.getPair(tokenA, tokenB));
	}

    /// Get pair via address.
    function getAndCreatePair(address token) public payable returns (IJoePair) {
		if (address(flipsToken) == token) {
		    return getLiquidityPair();
		}

		return getPair(token);
    }

	/// Get current price in WETH of provided token.
	function wethQuote(uint256 amount, address token) public view returns (uint256) {
        IJoePair pair = getPair(token);

		(uint256 reserveInput, uint256 reserveOutput, ) = pair.getReserves();

        if (reserveInput == 0 && reserveOutput == 0) {
            // TODO: Revise whether ratio should be 1:1 initially
            return amount;
        }

		// TODO: Find more elegant way to sort pair in correct direction, automatically.
		if (pair.token0() == token) {
			return JoeLibrary.quote(amount, reserveOutput, reserveInput);
		}

		return JoeLibrary.quote(amount, reserveInput, reserveOutput);
	}

	/// Determine how many ERC20 tokens are equal in value to the provided amount of avax tokens.
	function determineERC20WithEqualValue(uint256 avaxAmount, address token) public payable returns (uint256 amount) {
        IJoePair pair = getAndCreatePair(token);

		(uint256 reserveInput, uint256 reserveOutput, ) = pair.getReserves();

		if (reserveInput == 0 && reserveOutput == 0) {
			// If there is no liquidity, provide liquidity with same value between AVAX and Flip
            // TODO: Revise whether ratio should be 1:1 initially
			return avaxAmount;
		}

		// TODO: Find more elegant way to sort pair in correct direction, automatically.
		if (pair.token0() == token) {
			return JoeLibrary.quote(avaxAmount, reserveOutput, reserveInput);
		}

		return JoeLibrary.quote(avaxAmount, reserveInput, reserveOutput);
	}

	/// Provide liquidity
	function provideLiquidity(uint256 flipAmount, uint256 avaxAmount)
        internal
	    returns (
            uint256 amountFlips,
            uint256 amountAvax,
            uint256 liq
	    )
    {
        flipsToken.approve(address(joeRouter), flipAmount);
        WAVAXToken.approve(address(joeRouter), avaxAmount);

		return joeRouter.addLiquidity(
			address(flipsToken), // tokenA address (flips)
			address(WAVAXToken), // tokenB address (wavax)
			flipAmount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
			avaxAmount, // tokenB amount desired
			flipAmount, // tokenA amount min (flips)
			avaxAmount, // tokenB amount min (wavax)
			address(this),
			block.timestamp.add(1000)
		);
	}

	/// Convert token to WAVAX
	function convertToWAVAX(uint amount, address token)
        internal
        returns (
            uint256[] memory amounts
        )
    {
        IJoePair pair = getPair(address(token));

		require(address(pair) != address(0), 'Cannot convert token to WAVAX. It has no existing pair.');

	    IERC20(token).approve(address(joeRouter), amount);

		address[] memory path = new address[](2);
		path[0] = token;
		path[1] = address(WAVAXToken);

		return joeRouter.swapExactTokensForTokens(
			amount,
			0,
			path,
			address(this),
			block.timestamp.add(1000)
		);
	}
}
