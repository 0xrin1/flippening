//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.12;

import './ERC20.sol';
import './Strings.sol';
import './Helper.sol';

import 'hardhat/console.sol';

import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeFactory.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/JoeFactory.sol';

import '@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeRouter02.sol';
import '@traderjoe-xyz/core/contracts/traderjoe/JoeRouter02.sol';

contract Flippening {
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

    uint private defaultExpiry;

    uint private graceTime;

    address private owner;

    IERC20 private flipsToken;

    IJoeRouter02 private joeRouter;

    Flip[] public flips;


    event Created(
        uint indexed index,
        address indexed creator,
        address indexed token,
        uint amount
    );

    event Guess(uint indexed index, address indexed guesser, string indexed filterGuess, string guess);

    event Settled(uint indexed index, address indexed settler, bool indexed creatorWon);

    event Reward(uint indexed index, uint indexed amount);

    event Cancelled(uint indexed index);


    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, 'Ownable: caller is not the owner');
        _;
    }

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
        address _flipsAddress,
        address _joeRouterAddress
    ) public {
        owner = _owner;
        defaultExpiry = _defaultExpiry;
        graceTime = _graceTime;
        flipsToken = IERC20(_flipsAddress);
        joeRouter = IJoeRouter02(_joeRouterAddress);
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

        emit Settled(id, msg.sender, creatorWon);

        reward(id, token);
    }

    /// Settle a flip that has expired. Anyone can do this.
    function expire(uint id) public payable gracePassed(id) notSettled(id) {
        IERC20 token = IERC20(flips[id].token);

        // uint multipliedAmount = SafeMath.mul(withdrawableAmount(id), 2);

        bool creatorWon = false;
        address fundsReceiver = flips[id].guesser;

        if (bytes(flips[id].guess).length == 0) {
            creatorWon = true;
            fundsReceiver = flips[id].creator;
        }

        token.transfer(fundsReceiver, flips[id].amount);

        flips[id].settled = true;

        emit Settled(id, msg.sender, creatorWon);

        reward(id, token);
    }

    /// Send reward to guesser and emit Reward event.
    function reward(uint id, IERC20 token) private {
        // 1% reward
        uint rewardAmount = guessReward(id);

        token.transfer(flips[id].guesser, rewardAmount);

        emit Reward(id, rewardAmount);
    }

    /// Calculate reward amount for guesser.
    function guessReward(uint id) private view returns (uint) {
        return flips[id].amount.div(100).mul(1);
    }

    /// Calculate amount collected by winner.
    function winAmount(uint id) private view returns (uint) {
        uint rewardAmount = guessReward(id);

        return flips[id].amount.mul(2).sub(rewardAmount);
    }

    /// Is given flip expired?
    function isExpired(uint id) private view returns (bool) {
        return flips[id].createdAt.add(flips[id].expiry.mul(60)) <= block.timestamp;
    }

    /// Is given flip past the grace period?
    function isPastGrace(uint id) private view returns (bool) {
        return flips[id].createdAt.add(flips[id].expiry.mul(60)).add(graceTime.mul(60)) < block.timestamp;
    }

    /// Is given flip within the grace period?
    function isInGrace(uint id) private view returns (bool) {
        return isExpired(id) && !isPastGrace(id);
    }

    /// Is the provided secret a valid secret?
    function validSecret(strings.slice memory clearSecretValue) private pure returns(bool) {
        int256 secretTrue = strings.compare(clearSecretValue, 'true'.toSlice());
        int256 secretFalse = strings.compare(clearSecretValue, 'false'.toSlice());
        return secretTrue != 0 && secretFalse != 0;
    }

    /// Provide liquidity
    function provideLiquidity() public payable {
        console.log('providing liquidity console.log');

        // Check that over certain amount of funds set aside for LP

        // testnet factory: 0x86f83be9770894d8e46301b12E88e14AdC6cdb5F
        // address dexFactoryAddress = payable(address('0x86f83be9770894d8e46301b12E88e14AdC6cdb5F'));

        console.log('instantiate IJoeFactory');

        // tokenA = flip
        // local address: 0xBAcbF448E8D6E2A783CBf495C308b52E55e7589E
        // address tokenA = 0xBAcbF448E8D6E2A783CBf495C308b52E55e7589E;
        // tokenB = base chain token, avax initially...
        // weth on rinkeby
        // weth rinkeby 0xc778417E063141139Fce010982780140Aa0cD5Ab <- can be used locally because forked
        address tokenB = 0xc778417E063141139Fce010982780140Aa0cD5Ab;

        // console.log('get ready to get the pair');

        // address pair = joeFactory.getPair(address(flipsToken), tokenB);

        // console.log('after pair');
        // console.log(pair);

        // if (pair == address(0)) {
        //     pair = joeFactory.createPair(address(flipsToken), tokenB);
        // }

        // console.log('pair after creation', pair);

        // If more than minimum amount, add to uniswap LP pair.
        // Anything that isn't base token, should be traded to base token.
        // Use base token for LP.

        // Router addLiquidity function already creates pair if it doesnt exist
        // Pairs usually created against wrapped avax.
    }
}
