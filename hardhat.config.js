require('@nomiclabs/hardhat-waffle');
require('hardhat-watcher');
require('dotenv').config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: '0.8.4',
    watcher: {
        compilation: {
            tasks: ['compile'],
        }
    },
    networks: {
        testnet_bsc: {
            url: process.env.BSC_TEST_RPC_URL,
            accounts: [
                process.env.TEST_PRIV_KEY,
            ],
            harfork: 'london',
        },
        testnet_arb: {
            url: process.env.ARB_TEST_RPC_URL,
            accounts: [
                process.env.TEST_PRIV_KEY,
            ],
            harfork: 'london',
        },
        testnet_ava: {
            url: process.env.AVA_TEST_RPC_URL,
            accounts: [
                process.env.TEST_PRIV_KEY,
            ],
            harfork: 'london',
        },
        local: {
            url: process.env.LOCAL_RPC_URL,
            accounts: [
                process.env.LOCAL_PRIV_KEY,
            ],
            hardfork: 'london',
        },
    },
};
