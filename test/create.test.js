const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('create', function () {
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

        const WAVAX = await ethers.getContractFactory('WAVAX');
        wavax = await WAVAX.deploy();
        await wavax.deployed();

        const JoeFactory = await ethers.getContractFactory('JoeFactory');
        joeFactory = await JoeFactory.deploy(owner.address);
        await joeFactory.deployed();

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
    });

    it('Should emit a Created event when calling the create function', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('1'),
        );

        const secret = `${randomSecretWord()} true`;

        await expect(flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        )).to.emit(flippening, 'Created').withArgs(
            0,
            owner.address,
            erc20.address,
            ethers.utils.parseEther('1'),
        );
    });
});
