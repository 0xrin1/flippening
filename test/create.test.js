const { expect } = require('chai');
const crypto = require('crypto');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('create', function () {
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
