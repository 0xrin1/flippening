const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');
const { BigNumber } = require('ethers');
const { smockit } = require('@eth-optimism/smock');

describe('settle', function () {
    let owner;
    let erc20;
    let wavax;
    let flip;
    let joeFactory;
    let joeRouter;
    let flippening;

    const provideERC20Liquidity = async () => {
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
    };

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

        const pairCodeHash = await joeFactory.pairCodeHash();
        console.log('pairCodeHash', pairCodeHash); // needed to override npm package hardcoded value

        const JoeRouter = await ethers.getContractFactory('JoeRouter02');
        joeRouter = await JoeRouter.deploy(joeFactory.address, wavax.address);
        await joeRouter.deployed();

	    // mockedJoeRouter = await smockit(joeRouter);

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(
            owner.address,
            60,
            60,
            wavax.address,
            joeRouter.address,
        );
        await flippening.deployed();

        const FLIP = await ethers.getContractFactory('FLIP');
        flip = await FLIP.deploy(flippening.address);
        await flip.deployed();

        await flippening.setFlipsAddress(flip.address);

        await provideERC20Liquidity();
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

    it('Settling Flip should increase token supply by current reward multiplier and Flip price', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('2'),
        );

        const salt = randomSecretWord();

        const secret = `${salt} true`;

        const flipAmount = 1;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther(`${flipAmount}`),
        );

        await flippening.guess(0, 'true');

        const rewardMultiplier = await flippening.rewardMultiplier();
        const protocolSupplyBefore = await flippening.currentTokenSupply();

        await flippening.settle(0, secret);

        const protocolSupplyAfter = await flippening.currentTokenSupply();

        expect(protocolSupplyAfter.sub(protocolSupplyBefore)).to.equal(BigNumber.from(`${flipAmount}`).mul(rewardMultiplier));

        expect(await flip.totalSupply()).to.equal(BigNumber.from(`${flipAmount}`).mul(rewardMultiplier));
    });
});
