const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('cancel', function () {
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

    it('Creator funds returned if cancelled with no guess', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('3'),
        );

        console.log('erc20 approved');

        const balance = await erc20.balanceOf(owner.address);

        console.log('balance', balance);

        const secret = `${randomSecretWord()} true`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        console.log('flip created');

        const changedBalance = await erc20.balanceOf(owner.address);

        console.log('changedBalance', changedBalance);

        expect(changedBalance.toString()).to.equal(balance.sub(ethers.utils.parseEther('1')).toString());

        await flippening.cancel(0, secret, erc20.address);

        const endBalance = await erc20.balanceOf(owner.address);

        expect(endBalance.toString()).to.equal(balance.toString());
    });

    it('Cancelled event emmitted when cancelled with no guess', async () => {
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

        await expect(flippening.cancel(0, secret, erc20.address))
            .to.emit(flippening, 'Cancelled')
            .withArgs(0);
    });
});
