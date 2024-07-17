require("@nomicfoundation/hardhat-toolbox")
//require("@nomiclabs/hardhat-waffle")
//require("@nomiclabs/hardhat-etherscan")
//require("hardhat-deploy")
//require("solidity-coverage")
//require("hardhat-gas-reporter")
//require("hardhat-contract-sizer")
require("dotenv").config()
//require("@chainlink/contracts")

/*@type import('hardhat/configpaths: {
  "@chainlink/contracts": require.resolve("@chainlink/contracts"),
},').HardhatUserConfig */

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKET_API_KEY = process.env.COINMARKET_KEY

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        sepolia: {
            chainId: 11155111,
            blockConfirmations: 6,
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
        },
    },
    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
    },
    solidity: "0.8.19",
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        timeout: 300000, // 300 seconds max
    },
}
