//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;

import './InteractsWithDEX.sol';
import './ERC20.sol';

import './interfaces/IERC20.sol';
import './interfaces/IFLIP.sol';
import './libraries/MathLib.sol';
import './libraries/SafeMath.sol';
import './libraries/Strings.sol';

import 'hardhat/console.sol';

contract Flippening is InteractsWithDEX {
	using strings for *;
	using SafeMath for *;

	struct Flip {
		address payable creator;
		address payable guesser;
		address token; // Which token is used for the flip
		bytes32 secret; // sha256 hash
		uint amount; // Amount put up by creator
		string guess; // Guess, not encrypted
		uint expiry; // When the default winner in selected. Duration in minutes.
		uint createdAt; // When the flip was created.
		bool settled;
	}

	uint public MAX_TOKEN_SUPPLY = 420000000;

    uint public rewardMultiplier = 900000000000000000;

    uint public rewardMultiplierReducer = 1000000000000000;

    uint public currentTokenSupply = 0;

	uint private defaultExpiry;

	uint private graceTime;

	Flip[] public flips;


	event Created(
		uint indexed index,
		address indexed creator,
		address indexed token,
		uint amount
	);

	event Guess(uint indexed index, address indexed guesser, string indexed filterGuess, string guess);

	event Settled(uint indexed index, address indexed settler, bool indexed creatorWon);

	event Cancelled(uint indexed index);


	/**
	 * @dev Throws if flip expiration has passed.
	 */
	modifier notExpired(uint id) {
		require(!isExpired(id), 'Expiration has passed');
		_;
	}

	/**
	 * @dev Throws if guess is not either 'true' or 'false'.
	 */
	modifier validGuess(string memory guessString) {
		strings.slice memory guessSlice = guessString.toSlice();
		int256 guessTrue = guessSlice.compare('true'.toSlice());
		int256 guessFalse = guessSlice.compare('false'.toSlice());
		require(guessTrue == 0 || guessFalse == 0, 'Not true or false.');
		_;
	}

	/**
	 * @dev Throws if guess is not either 'true' or 'false'.
	 */
	modifier noGuess(uint id) {
		require(flips[id].guesser == payable(address(0)), 'Flip already has guess');
		_;
	}

	/**
	 * @dev Throws if flip does not have a guess..
	 */
	modifier hasGuess(uint id) {
		require(flips[id].guesser != payable(address(0)), 'Flip needs guess');
		_;
	}

	/**
	 * @dev Throws if provided secret is wrong.
	 */
	modifier correctSecret(uint id, string memory clearSecretString) {
		bytes32 clearSecretBytes = sha256(abi.encodePacked(clearSecretString));
		require(clearSecretBytes == flips[id].secret, 'Secret is wrong');
		_;
	}

	/**
	 * @dev Throws if expiration and gracetime has not passed.
	 */
	modifier gracePassed(uint id) {
		// Check that expired && graceTime passed.
		require(isPastGrace(id), 'Expiration + gracetime has not passed');
		_;
	}

	/**
	 * @dev Throws if flip has already been setled.
	 */
	modifier notSettled(uint id) {
		// Check that expired && graceTime passed.
		require(flips[id].settled == false, 'Flip already settled');
		_;
	}

	constructor(
		address _owner,
		uint _defaultExpiry,
		uint _graceTime,
		address _WAVAXAddress,
		address _joeRouterAddress
	) InteractsWithDEX(_owner, _WAVAXAddress, _joeRouterAddress) {
		defaultExpiry = _defaultExpiry;
		graceTime = _graceTime;
	}

	/// Create a flip by putting up a secret and an amount to be flipped.
	function create(
		bytes32 secret,
		address tokenAddress,
		uint amount
	) public payable {
		flips.push(Flip({
			creator: payable(msg.sender),
			guesser: payable(address(0)),
			token: tokenAddress,
			secret: secret,
			amount: amount,
			guess: '',
			createdAt: block.timestamp,
			expiry: defaultExpiry,
			settled: false
		}));

		IERC20 token = IERC20(tokenAddress);

		token.transferFrom(msg.sender, address(this), amount);

		emit Created(flips.length - 1, msg.sender, tokenAddress, amount);
	}

	/// Provide a guess against a flip. Should be either true or false.
	function guess(
		uint id,
		string memory guessString
	) public payable noGuess(id) notExpired(id) validGuess(guessString) {
		flips[id].guesser = payable(msg.sender);
		flips[id].guess = guessString;

		IERC20 token = IERC20(flips[id].token);

		token.transferFrom(msg.sender, address(this), flips[id].amount);

		emit Guess(id, msg.sender, guessString, guessString);
	}

	/// Extract the secret in string format from the provided clearText secret.
	function getSecret(string memory secret) private pure returns (string memory) {
		strings.slice memory s = secret.toSlice();
		strings.slice memory delim = ' '.toSlice();
		string[] memory parts = new string[](strings.count(s, delim) + 1);
		for (uint i = 0; i < parts.length; i++) {
			parts[i] = strings.toString(strings.split(s, delim));
		}

		require(parts.length > 0, 'Secret value could not be extracted from clearSecret');

		// Assuming here that there is only one space.
		return parts[1];
	}

	/// Cancel a flip.
	function cancel(
		uint id,
		string memory clearSecretString,
		address tokenAddress
	) public payable noGuess(id) correctSecret(id, clearSecretString) {
		IERC20 token = IERC20(tokenAddress);

		token.transfer(flips[id].creator, flips[id].amount);

		emit Cancelled(id);
	}

	/// Settle a flip that has a guess.
	function settle(
		uint id,
		string memory clearSecretString
	) public payable notSettled(id) hasGuess(id) correctSecret(id, clearSecretString) {
		strings.slice memory clearSecretValue = getSecret(clearSecretString).toSlice();

		IERC20 token = IERC20(flips[id].token);

		bool creatorWon = true;
		address fundsReceiver = flips[id].creator;

		if (validSecret(clearSecretValue) || clearSecretValue.compare(flips[id].guess.toSlice()) == 0) {
			creatorWon = false;
			fundsReceiver = flips[id].guesser;
		}

		token.transfer(fundsReceiver, winAmount(id));

		flips[id].settled = true;

		uint256 feeAmount = processFees(id);

		emit Settled(id, msg.sender, creatorWon);

		flipsToken.transfer(fundsReceiver, feeAmount);
	}

	/// Settle a flip that has expired. Anyone can do this.
	function expire(uint id) public payable gracePassed(id) notSettled(id) {
		IERC20 token = IERC20(flips[id].token);

		bool creatorWon = false;
		address fundsReceiver = flips[id].guesser;

		if (bytes(flips[id].guess).length == 0) {
			creatorWon = true;
			fundsReceiver = flips[id].creator;
		}

		token.transfer(fundsReceiver, flips[id].amount);

		flips[id].settled = true;

		emit Settled(id, msg.sender, creatorWon);
	}

	/// Calculate reward amount for guesser.
	function protocolFee(uint id) internal view returns (uint) {
		return flips[id].amount.mul(2).div(100).mul(2); // 2% of twice the flip amount
	}

	/// Calculate amount collected by winner.
	function winAmount(uint id) internal view returns (uint) {
		uint rewardAmount = protocolFee(id);

		return flips[id].amount.mul(2).sub(rewardAmount);
	}

	/// Is given flip expired?
	function isExpired(uint id) internal view returns (bool) {
		return flips[id].createdAt.add(flips[id].expiry.mul(60)) <= block.timestamp;
	}

	/// Is given flip past the grace period?
	function isPastGrace(uint id) internal view returns (bool) {
		return flips[id].createdAt.add(flips[id].expiry.mul(60)).add(graceTime.mul(60)) < block.timestamp;
	}

	/// Is given flip within the grace period?
	function isInGrace(uint id) internal view returns (bool) {
		return isExpired(id) && !isPastGrace(id);
	}

	/// Is the provided secret a valid secret?
	function validSecret(strings.slice memory clearSecretValue) internal pure returns(bool) {
		int256 secretTrue = strings.compare(clearSecretValue, 'true'.toSlice());
		int256 secretFalse = strings.compare(clearSecretValue, 'false'.toSlice());
		return secretTrue != 0 && secretFalse != 0;
	}

	/// Determine amount of protocol token that should be minted for Flip generation.
	function rewardCurve(Flip memory flip) internal returns (uint) {
        uint mintedReward = flip.amount.div(10 ** 18).mul(rewardMultiplier);

        if (currentTokenSupply.add(mintedReward) > MAX_TOKEN_SUPPLY.mul(10 ** 17)) {
            return 0;
        }

        currentTokenSupply = currentTokenSupply.add(mintedReward);
        rewardMultiplier = rewardMultiplier.sub(rewardMultiplierReducer);

        return mintedReward;
	}

	/// Determine amount that should be paid to protocol and use it to provide liquidity.
	function processFees(uint index) internal returns (uint256) {
		Flip memory flip = flips[index];

		// Get amount of flips that should be minted this iteration
		uint256 tokenAmount = rewardCurve(flip);
        console.log('tokenAmount', tokenAmount);

		uint256 tokenAmountValue = wethQuote(tokenAmount, flip.token);
        console.log('tokenAmountValue', tokenAmountValue);

		// Get value of half the protocol tokens that will be minted
		uint256 feeVal = protocolFee(index);

		// Provide liquidity with half of the absorbed fee
		uint256 avaxAmount = convertToWAVAX(feeVal, flip.token)[1];
        console.log('avaxAmount', avaxAmount);

		// Express the value of the minted flips in the token used to flip
		uint256 flipFeeAmount = determineERC20WithEqualValue(avaxAmount, address(flipsToken), true);

        console.log('flipFeeAmount', flipFeeAmount);

		// Mint reward curve amount.
		flipsToken.mint(address(this), tokenAmount);

        // If the fee, when expressed in number of flips, is larger than the number of flips minted according to the reward.
        if (flipFeeAmount > tokenAmount) {
            // Provide liquidity with flipAmount equal to the number of tokens minted vs its value in WETH.
            // This means that some WETH is left on the table.
            // Situation occurs when flip amount is very large and leaves the flipper no FLIP rewards.
		    provideLiquidity(tokenAmount, tokenAmountValue);

            return 0;
        }

        // Occurs when the fee, when expressed in number of flips, is smaller or equal to the number of flips minted according to the reward.
        // Provide liquidity equal to the entire fee collected this round.
        provideLiquidity(flipFeeAmount, avaxAmount);

        // Return remaining protocol tokens to be returned to winner
		return tokenAmount.sub(feeVal);
	}
}
