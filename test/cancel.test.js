const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('cancel', function () {
    let owner;
    let erc20;
    let flippening;

    beforeEach(async () => {
        [ owner ] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory('ERC20Basic');
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(owner.address, 60, 60);
        await flippening.deployed();
    });

    it('Creator funds returned if cancelled with no guess', async () => {
        await erc20.approve(
            flippening.address,
            ethers.utils.parseEther('3'),
        );

        const balance = await erc20.balanceOf(owner.address);

        const secret = `${randomSecretWord()} true`;

        await flippening.create(
            await sha256(secret),
            erc20.address,
            ethers.utils.parseEther('1'),
        );

        const changedBalance = await erc20.balanceOf(owner.address);

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
