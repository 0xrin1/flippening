// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');
require('dotenv').config()

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    let owner = process.env.LOCAL_OWNER;
    // let owner = process.env.TEST_OWNER;

    // If local, deploy WAVAXAddress, joeRouter and joeFactory

    // Required in development to simulate flip scenarios.
    const ERC20 = await ethers.getContractFactory('ERC20Basic');
    let erc20 = await ERC20.deploy();
    await erc20.deployed();

    const WAVAX = await ethers.getContractFactory('WAVAX');
    let wavax = await WAVAX.deploy();
    await wavax.deployed();

    const JoeFactory = await ethers.getContractFactory('JoeFactory');
    let joeFactory = await JoeFactory.deploy(owner);
    await joeFactory.deployed();

    const pairCodeHash = await joeFactory.pairCodeHash();
    console.log('pairCodeHash', pairCodeHash); // needed to override npm package hardcoded value

    const JoeRouter = await ethers.getContractFactory('JoeRouter02');
    let joeRouter = await JoeRouter.deploy(joeFactory.address, wavax.address);
    await joeRouter.deployed();

    // We get the contract to deploy
    const Flippening = await hre.ethers.getContractFactory('Flippening');
    const flippening = await Flippening.deploy(
        process.env.LOCAL_OWNER,
        60,
        60,
        wavax.address,
        joeRouter.address,
        joeFactory.address,
    );
    await flippening.deployed();

    // Deploy the flippening contract
    const FLIP = await hre.ethers.getContractFactory('FLIP');
    const flip = await FLIP.deploy(flippening.address);
    await flip.deployed();

    await flippening.setFlipsAddress(flip.address);

    console.log('ERC20 deployed to:', erc20.address);
    console.log('WAVAX deployed to:', wavax.address);
    console.log('JoeFactory deployed to:', joeFactory.address);
    console.log('JoeRouter deployed to:', joeRouter.address);
    console.log('Flippening deployed to:', flippening.address);
    console.log('FLIP deployed to:', flip.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
