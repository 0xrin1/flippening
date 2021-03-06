// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import '../interfaces/IERC20.sol';
import '../interfaces/IFLIP.sol';
import '../interfaces/IsFLIP.sol';
import '../libraries/SafeMath.sol';
import '../ERC4626.sol';

import '@traderjoe-xyz/core/contracts/traderjoe/libraries/JoeLibrary.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoePair.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeFactory.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeRouter02.sol';
// import '@rari-capital/solmate/src/mixins/ERC4626.sol';

abstract contract InteractsWithDEX {
	using SafeMath for *;

    IERC20 WAVAXToken;

    IFLIP flipsToken;
    IsFLIP sFlipsToken;

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

	// Set the address of the FLIP token and sFLIP vault.
	function setFlipsAddress(address _flipsAddress, address _sFlipsAddress) public onlyOwner {
		flipsToken = IFLIP(_flipsAddress);
		sFlipsToken = IsFLIP(_sFlipsAddress);
	}

	// Determine liquidity pair for flips and wavax tokens and create if null address returned.
	function getLiquidityPair() internal returns (IJoePair pair) {
		address pairAddress = joeFactory.getPair(address(flipsToken), address(WAVAXToken));

		if (pairAddress == address(0)) {
			pairAddress = joeFactory.createPair(address(flipsToken), address(WAVAXToken));
		}

		return IJoePair(pairAddress);
	}

	// Determine staked liquidity pair for flips and wavax tokens and create if null address returned.
	function getStakedLiquidityPair() internal returns (IJoePair pair) {
		address pairAddress = joeFactory.getPair(address(sFlipsToken), address(WAVAXToken));

		if (pairAddress == address(0)) {
			pairAddress = joeFactory.createPair(address(sFlipsToken), address(WAVAXToken));
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

		if (address(sFlipsToken) == token) {
		    return getStakedLiquidityPair();
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
	function provideLiquidity(uint256 sFlipAmount, uint256 avaxAmount)
        internal
	    returns (
            uint256 amountFlips,
            uint256 amountAvax,
            uint256 liq
	    )
    {
        sFlipsToken.approve(address(joeRouter), sFlipAmount);
        WAVAXToken.approve(address(joeRouter), avaxAmount);

		return joeRouter.addLiquidity(
			address(sFlipsToken), // tokenA address (flips)
			address(WAVAXToken), // tokenB address (wavax)
			sFlipAmount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
			avaxAmount, // tokenB amount desired
			sFlipAmount, // tokenA amount min (flips)
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
