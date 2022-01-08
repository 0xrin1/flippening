const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('settle', function () {
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
            wavax.address,
            joeRouter.address,
            joeFactory.address,
        );
        await flippening.deployed();

        const FLIP = await ethers.getContractFactory('FLIP');
        flip = await FLIP.deploy(flippening.address);
        await flip.deployed();

        await flippening.setFlipsAddress(flip.address);
    });

    it('Should emit a settled event when guess and secret are the same', async () => {
        let counter = 0;

        for (const choice of [true, false]) {
            await erc20.approve(
                flippening.address,
                ethers.utils.parseEther('3'),
            );

            const secret = `${randomSecretWord()} ${choice}`;

            await flippening.create(
                sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await flippening.guess(counter, `${choice}`);

            await expect(flippening.settle(counter, secret))
                .to.emit(flippening, 'Settled')
                .withArgs(counter, owner.address, false);

            counter += 1;
        }
    });

    it('Should emit a settled event when guess and secret are not the same', async () => {
        let counter = 0;

        for (const choice of [true, false]) {
            await erc20.approve(
                flippening.address,
                ethers.utils.parseEther('3'),
            );

            const secret = `${randomSecretWord()} ${choice}`;

            await flippening.create(
                await sha256(secret),
                erc20.address,
                ethers.utils.parseEther('1'),
            );

            await flippening.guess(counter, `${! choice}`);

            await expect(flippening.settle(counter, secret))
                .to.emit(flippening, 'Settled')
                .withArgs(counter, owner.address, true);

            counter += 1;
        }
    });

    it('Creator loses if secret was not true or false', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('3'),
        );

        const secret = `${randomSecretWord()} something-else`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        await flippening.guess(0, 'true');

        await expect(flippening.settle(0, secret))
            .to.emit(flippening, 'Settled')
            .withArgs(0, owner.address, false);
    });

    // it('Should emit a Reward event indicating the reward paid out to the guesser', async () => {
    //     await erc20.approve(
    //         flippening.address,
    //         ethers.utils.parseEther('2'),
    //     );

    //     const secret = `${randomSecretWord()} true`;

    //     await flippening.create(
    //         await sha256(secret),
    //         erc20.address,
    //         ethers.utils.parseEther('1'),
    //     );

    //     await flippening.guess(0, 'false');

    //     await network.provider.send('evm_increaseTime', [3600]);

    //     await expect(flippening.settle(0, secret))
    //         .to.emit(flippening, 'Reward')
    //         .withArgs(0, ethers.utils.parseEther('0.01'));
    // });

    it('Creator loses when settling expired flip with guess. Should have claimed before expiry + grace.', async () => {
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

        await network.provider.send('evm_increaseTime', [3600 * 2]);

        await expect(flippening.settle(0, secret))
            .to.emit(flippening, 'Settled')
            .withArgs(0, owner.address, false);
    });

    it('Rejects settle attempt when flip has no guess', async () => {
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

        await expect(flippening.settle(0, secret))
            .to.be.revertedWith('Flip needs guess');
    });

    it('Rejects duplicate settle attempt gracefully', async () => {
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

        await flippening.settle(0, secret);

        await expect(flippening.settle(0, secret))
            .to.be.revertedWith('Flip already settled');
    });

    it('Should revert transaction if proof of ownership fails', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('2'),
        );

        const salt = randomSecretWord();

        const secret = `${salt} true`;
        const wrongSecret = `${salt} false`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        await flippening.guess(0, 'true');

        await expect(flippening.settle(0, wrongSecret))
            .to.be.revertedWith('Secret is wrong');
    });
});
