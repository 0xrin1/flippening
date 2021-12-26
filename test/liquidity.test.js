const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('liquidity', function () {
    let owner;
    let erc20;
    let wavax;
    let joeFactory;
    let joeRouter;
    let flippening;

    beforeEach(async () => {
        [ owner ] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory('ERC20Basic');
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        const WAVAX = await ethers.getContractFactory('ERC20Basic');
        wavax = await WAVAX.deploy();
        await wavax.deployed();

        const JoeFactory = await ethers.getContractFactory('JoeFactory');
        joeFactory = await JoeFactory.deploy(owner.address);
        await joeFactory.deployed();

        const pairCodeHash = await joeFactory.pairCodeHash();
        console.log('pairCodeHash', pairCodeHash); // needed to override npm package hardcoded value

        const JoeRouter = await ethers.getContractFactory('JoeRouter02');
        joeRouter = await JoeRouter.deploy(joeFactory.address, wavax.address);
        await joeRouter.deployed();

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(
            owner.address,
            60,
            60,
            erc20.address,
            wavax.address,
            joeRouter.address,
            joeFactory.address,
        );
        await flippening.deployed();

        await erc20.transfer(flippening.address, ethers.utils.parseEther('1'));
        await wavax.transfer(flippening.address, ethers.utils.parseEther('1'));
    });

    it('provideLiquidity() function should create liquidity', async () => {
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));
    });

    it('convertToWAVAX() function should convert incoming tokens to WAVAX', async () => {
        // Provide liquidity so that pair is created
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));

        await flippening.convertToWAVAX(erc20.address, ethers.utils.parseEther('0.5'));
    });

    it.only('processFees() function should convert fee to WAVAX and provide liquidity', async () => {
        // Provide liquidity so that pair is created
        await flippening.provideLiquidity(ethers.utils.parseEther('0.5'));

        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('2'),
        );

        const secret = `${randomSecretWord()} true`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        await flippening.guess(0, 'false');

        await flippening.processFees(0);

        // Provide liquidity so that pair is created
        // await flippening.provideLiquidity(ethers.utils.parseEther('0.5'), ethers.utils.parseEther('0.5'));

        // await flippening.convertToWAVAX(erc20.address, ethers.utils.parseEther('0.5'));
    });
});
