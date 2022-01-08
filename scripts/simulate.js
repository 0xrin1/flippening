require('dotenv').config();

const { ethers, Contract, BigNumber, utils } = require('ethers');
const flippeningABI = require('../artifacts/contracts/Flippening.sol/Flippening.json');
const ERC20ABI = require('../artifacts/contracts/ERC20.sol/ERC20Basic.json');
const FlipABI = require('../artifacts/contracts/ERC20.sol/FLIP.json');
const WavaxABI = require('../artifacts/contracts/ERC20.sol/WAVAX.json');
const JoeRouterABI = require('../artifacts/@traderjoe-xyz/core/contracts/traderjoe/JoeRouter02.sol/JoeRouter02.json');
const JoeFactoryABI = require('../artifacts/@traderjoe-xyz/core/contracts/traderjoe/JoeFactory.sol/JoeFactory.json');
const { sha256, randomSecretWord } = require('../test/base/helpers');
const addresses = require('../config/addresses');

console.log('simulate contract usage', addresses);

let provider = new ethers.providers.WebSocketProvider(process.env.LOCAL_RPC_URL, {
    chainId: 31337
});

const signer = provider.getSigner();

let flippening;
let erc20;
let wavax;
let flip;
let joeRouter;
let joeFactory;

(async () => {
    const rpcAddress = await signer.getAddress();
    console.log(rpcAddress);

    let flippeningUnsigned = new Contract(addresses.flippening.local, flippeningABI.abi, provider);
    flippening = flippeningUnsigned.connect(signer);

    let erc20Unsigned = new Contract(addresses.tokens.ERC20.local, ERC20ABI.abi, provider);
    erc20 = erc20Unsigned.connect(signer);

    let wavaxUnsigned = new Contract(addresses.tokens.WAVAX.local, WavaxABI.abi, provider);
    wavax = wavaxUnsigned.connect(signer);

    let flipUnsigned = new Contract(addresses.tokens.FLIP.local, FlipABI.abi, provider);
    flip = flipUnsigned.connect(signer);

    let joeRouterUnsigned = new Contract(addresses.joeRouter.local, JoeRouterABI.abi, provider);
    joeRouter = joeRouterUnsigned.connect(signer);

    let joeFactoryUnsigned = new Contract(addresses.joeFactory.local, JoeFactoryABI.abi, provider);
    joeFactory = joeFactoryUnsigned.connect(signer);

    // check if there is liquidity
    let erc20WavaxPair = await getWavaxPair(erc20.address);

    if (parseInt(erc20WavaxPair) === 0) {
        await wavax.approve(flippening.address, ethers.utils.parseEther('1000'));
        await wavax.transfer(flippening.address, ethers.utils.parseEther('1000'));

        console.log('providing liquidity for the first time');

        await provideLiquidity(flippening, erc20, wavax, flip);
    }

    erc20WavaxPair = await getWavaxPair(erc20.address);
    console.log('erc20 wavax pair', erc20WavaxPair);

    // check if there is liquidity
    let flipWavaxPair = await getWavaxPair(flip.address);
    if (parseInt(flipWavaxPair) === 0) {
        await createWavaxPair(flip.address);
        flipWavaxPair = await getWavaxPair(flip.address);
    }
    console.log('flipWavaxPair', flipWavaxPair);

    for (const i in [...Array(1000)]) {
        await erc20.approve(flippening.address, utils.parseEther('2'));

        const secret = randomSecretWord();
        const secretWord = `${secret} true`;

        console.log('creating flip');
        await flippening.create(
            await sha256(secretWord),
            erc20.address,
            utils.parseEther('1'),
        );

        // check how many flips there are
        const createdEventFilter = flippening.filters.Created();
        let createdEvents = await flippening.queryFilter(createdEventFilter);
        const latestFlipIndex = createdEvents.length - 1;

        console.log('guessing');
        await flippening.guess(latestFlipIndex, 'false');
        console.log('settling');
        await flippening.settle(latestFlipIndex, secretWord);

        console.log('blockNumber', await provider.getBlockNumber());
    }

    provider.destroy();
})();

async function createWavaxPair(address) {
	return await joeFactory.createPair(address, wavax.address);
}

async function getWavaxPair(address) {
    if (parseInt(address) > parseInt(wavax.address)) {
        return joeFactory.getPair(wavax.address, address);
    }

    return joeFactory.getPair(address, wavax.address);
}

async function provideLiquidity() {
    // Provide liquidity to the protocol token
    // const flipAmount = ethers.utils.parseEther('1000');
    // const wavaxFlipAmount = ethers.utils.parseEther('1000');

    // flip.approve(joeRouter.address, flipAmount); // use same amonut of flips as avax tokens
    // wavax.approve(joeRouter.address, wavaxFlipAmount);

    // await joeRouter.addLiquidity(
    //     flip.address, // tokenA address (flips)
    //     wavax.address, // tokenB address (wavax)
    //     flipAmount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
    //     wavaxFlipAmount, // tokenB amount desired
    //     flipAmount, // tokenA amount min (flips)
    //     wavaxFlipAmount, // tokenB amount min (wavax)
    //     // owner, // to
    //     flippening.address,
    //     99999999999999, // some large number that is not going to hit the limit TODO: use actual block number in test
    // );

    // Provide liquidity to the erc20 token that we'll be using
    const erc20Amount = ethers.utils.parseEther('100000');
    const wavaxERC20Amount = ethers.utils.parseEther('50');

    erc20.approve(joeRouter.address, erc20Amount); // use same amonut of flips as avax tokens
    wavax.approve(joeRouter.address, wavaxERC20Amount);

    try {
        await joeRouter.addLiquidity(
            erc20.address, // tokenA address (flips)
            wavax.address, // tokenB address (wavax)
            erc20Amount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
            wavaxERC20Amount, // tokenB amount desired
            erc20Amount, // tokenA amount min (flips)
            wavaxERC20Amount, // tokenB amount min (wavax)
            // owner, // to
            flippening.address,
            99999999999999, // some large number that is not going to hit the limit TODO: use actual block number in test
        );
    } catch(e) {
        console.error('AddLiquidity failed', e);
    }

    console.log('liquidity added');
}
