const { network, ethers } = require("hardhat")
const { assert, expect } = require("chai")
const { getNamedAccounts, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", () => {
          let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              const deployer = (await getNamedAccounts).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContractAt("Raffle", deployer)
              VRFCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("It initializes the raffle correctly", async () => {
                  //ideally we make our tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterRaffle", function () {
              it("it reverts when you do not pay enough ETH", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayers(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              //   if (s_raffleState != RaffleState.OPEN) {
              //     revert Raffle__NotOpen();
              // }
              it("it doesnt allow entrance when raffle is calculating", async () => {
                  await raffle.entranceRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // we pretend to be a Chainlink keeper
                  await raffle.performUpKeep([])
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })

          describe("checkupkeep", () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("it returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpKeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.chckUpKeep([])
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded)
              })
          })
          describe("performUpKeep", () => {
              it("it can only run if checkupkeep is true", async () => {
                  await raffle.entranceRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_min", [])
                  const tx = await raffle.performUpKeep([])
                  assert(tx)
              })
              it("reverts when checkupkeep is false", async () => {
                  await expect(raffle.performUpKeep([])).to.be.revertedWith(
                      "Raffle_UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state, emits and events, calls the vrf coordinator", async () => {
                  await raffle.entranceRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_min", [])
                  const txResponse = await raffle.performUpKeep([])
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  assert.equal(requestId.toNumber() > 0)
                  const raffleState = await raffle.getRaffleState()
                  assert(raffleState.toString() == "1")
              })

              describe("fulfillRandomWords", () => {
                  beforeEach(async () => {
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                  })
                  it("can only be called after performupkeep", async () => {
                      await expect(VRFCoordinatorV2Mock.fulfillRadomWords(0, raffle.address))
                  })
                  it("can only be called after performupkeep", async () => {
                      await expect(VRFCoordinatorV2Mock.fulfillRadomWords(1, raffle.address))
                  })
                  it("picks a winner, resets the lottery, and sends money", async () => {
                      const addtionalEntrants = 3
                      const startingAccountIndex = 1 // since deployer = 0
                      const accounts = await ethers.getSigners()
                      for (
                          let i = startingAccountIndex;
                          i < startingAccountIndex + addtionalEntrace;
                          i++
                      ) {
                          const accountsConnectedRaffle = raffle.connect(accounts[i])
                          await accountsConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                      }
                      const startingTimeStamp = await raffle.getLastRTimeStamp()

                      //performUpKeep (mock being chainlink keepers)
                      //fulfillRandomWords (mock being the chainlink VRF)
                      await new Promise(async (resolve, reject) => {
                          raffle.once("winnerPicked", async () => {
                              console.log("Found the event!")
                              try {
                                  console.log(recentWinner)
                                  console.log(accounts[2].address)
                                  console.log(accounts[0].address)
                                  console.log(accounts[1].address)
                                  console.log(accounts[3].address)
                                  const recentWinner = await raffle.getRecentWinner()
                                  const raffleState = await raffle.getRaffleState()
                                  const endingTimeStamp = await raffle.getLatestTimeStamp()
                                  const numberOfPlayers = await raffle.getNumberOfPlayers()
                                  const winnerEndingBalance = await accounts[1].getBalance()
                                  assert.equal(numberOfPlayers.toString(), "0")
                                  assert.equal(raffleState.toString(), "0")
                                  assert(endingTimeStamp > startingTimeStamp)
                                  assert.equal(
                                      winnerEndingBalance.toString(),
                                      winnerStartingBalance.add(
                                          raffleEntranceFee
                                              .mul(addtionalEntrants)
                                              .add(raffleEntranceFee)
                                              .toString()
                                      )
                                  )
                              } catch (error) {
                                  reject(e)
                              }
                              resolve()
                          })
                          //setting up the listener
                          //below, we will fire the events listener will pick it up, and resolve
                          const tx = await raffle.performUpKeep([])
                          const txReceipt = await tx.wait(1)
                          const winnerStartingBalance = await accounts[1].getBalance()
                          await VRFCoordinatorV2Mock.fulfillRadomWords(txReceipt.events[1]).args
                              .requestId,
                              raffle.address
                      })
                  })
              })
          })
      })
