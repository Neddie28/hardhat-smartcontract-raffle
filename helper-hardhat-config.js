const { ethers } = require("hardhat")

const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2: "0x3089c112584731C50B3B5C48103f947a2408fc59",
        entranceFee: ethers.utils.parseEther("0.01"),
        subscriptionId: "7796",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subscriptionId: "0",
        callbackGasLimit: "500000", // 500, 000 gas
        interval: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        interval: "30",
    },
}

const developmentChains = ["hardhat", "localhost"]

module.export = {
    networkConfig,
    developmentChains,
}
