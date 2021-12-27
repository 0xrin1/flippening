const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('guess', function () {
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

    it('Should emit a Guess event when calling the guess function', async () => {
        let counter = 0;

        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('4'),
        );

        for (const choice of ['true', 'false']) {
            const secret = `${randomSecretWord()} ${choice}`;

            await flippening.create(
                await sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await expect(flippening.guess(counter, choice))
                .to.emit(flippening, 'Guess')
                .withArgs(counter, owner.address, choice, choice);

            counter += 1;
        }
    });

    it('Should revert transaction when expiration has passed', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('2'),
        );

        const choice = 'true';
        const secret = `${randomSecretWord()} ${choice}`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        await network.provider.send('evm_increaseTime', [3600 * 2 - 1]);

        await expect(flippening.guess(0, choice))
            .to.be.revertedWith('Expiration has passed');
    });

    it('Rejects duplicate guess attempt gracefully', async () => {
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

        await flippening.guess(0, 'true');

        await expect(flippening.guess(0, 'true'))
            .to.be.revertedWith('Flip already has guess');
    });
});
