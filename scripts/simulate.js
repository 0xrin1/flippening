require('dotenv').config();

const { ethers, Contract, BigNumber, utils } = require('ethers');
const flippeningABI = require('../artifacts/contracts/Flippening.sol/Flippening.json');
const ERC20ABI = require('../artifacts/contracts/ERC20.sol/ERC20Basic.json');
const FlipABI = require('../artifacts/contracts/ERC20.sol/ERC20Basic.json');
const WavaxABI = require('../artifacts/contracts/ERC20.sol/ERC20Basic.json');
const JoeRouterABI = require('../artifacts/@traderjoe-xyz/core/contracts/traderjoe/JoeRouter02.sol/JoeRouter02.json');
const JoeFactoryABI = require('../artifacts/@traderjoe-xyz/core/contracts/traderjoe/JoeFactory.sol/JoeFactory.json');
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

    await wavax.transfer(flippening.address, ethers.utils.parseEther('1000'));

    console.log('after avax transfer');

    await provideLiquidity(flippening, erc20, wavax, flip);

    console.log('liquidity provided');
})();

async function provideLiquidity() {
    // Provide liquidity so that Flip pair is created
    await flippening.provideLiquidity(ethers.utils.parseEther('1000'));

    // Provide liquidity to the erc20 token that we'll be using
    const erc20Amount = ethers.utils.parseEther('100000');
    const wavaxAmount = ethers.utils.parseEther('50');

    erc20.approve(joeRouter.address, erc20Amount); // use same amonut of flips as avax tokens
    wavax.approve(joeRouter.address, wavaxAmount);

    const response = await joeRouter.addLiquidity(
        erc20.address, // tokenA address (flips)
        wavax.address, // tokenB address (wavax)
        erc20Amount, // flip token <- just use same value as avax amount since the contract can mint unlimited supply
        wavaxAmount, // tokenB amount desired
        erc20Amount, // tokenA amount min (flips)
        wavaxAmount, // tokenB amount min (wavax)
        // owner, // to
        flippening.address,
        99999999999999, // some large number that is not going to hit the limit TODO: use actual block number in test
    );
}
