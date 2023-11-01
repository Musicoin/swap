require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */

module.exports = {
  defaultNetwork: 'skale',
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      evmVersion: 'paris',
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: process.env.WEB3_RPC,
        blockNumber: 18391053, // you can put a block number in order to test at a specific time which also uses less resources on your computer
      },
    },
    skale: {
      url: process.env.SKALE_ENDPOINT,
      accounts: [process.env.PRIVATE_KEY],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      skale: process.env.ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'skale',
        chainId: parseInt(process.env.CHAIN_ID),
        urls: {
          apiURL: process.env.API_URL,
          browserURL: process.env.BLOCKEXPLORER_URL,
        },
      },
    ],
  },
};
