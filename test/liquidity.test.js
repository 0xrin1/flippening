const { expect } = require('chai');
const { sha256, randomSecretWord } = require('./base/helpers');

describe('liquidity', function () {
    let owner;
    let erc20;
    let joeFactory;
    let flippening;

    beforeEach(async () => {
        [ owner ] = await ethers.getSigners();

        const ERC20 = await ethers.getContractFactory('ERC20Basic');
        erc20 = await ERC20.deploy();
        await erc20.deployed();

        const JoeFactory = await ethers.getContractFactory('JoeFactory');
        joeFactory = await JoeFactory.deploy(owner.address);
        await joeFactory.deployed();

        const Flippening = await ethers.getContractFactory('Flippening');
        flippening = await Flippening.deploy(owner.address, 60, 60, erc20.address, joeFactory.address);
        await flippening.deployed();
    });

    it.only('Create liqudity function should create liquidity', async () => {
        flippening.provideLiquidity();
    });
});
