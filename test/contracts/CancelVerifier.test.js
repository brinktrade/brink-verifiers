const { expect } = require("chai");
const { ethers } = require('hardhat')
const testHelpers = require('@brinkninja/test-helpers');

describe("CancelVerifier", function() {
  beforeEach(async function () {
    const [ defaultAccount ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
  })

  it("Cancel should flip the bit", async function() {
    const CancelVerifier = await ethers.getContractFactory("CancelVerifier");
    const cancelVerifier = await CancelVerifier.deploy()
    await expect(cancelVerifier.cancel(0, 1))
      .to.emit(cancelVerifier, 'Cancelled')
      .withArgs(0, 1);
  });

  it("First cancel should flip the bit, second cancel should revert with 'CancelVerifier: bit is used'", async function() {
    const CancelVerifier = await ethers.getContractFactory("CancelVerifier");
    const cancelVerifier = await CancelVerifier.deploy()
    await expect(cancelVerifier.cancel(0, 1))
      .to.emit(cancelVerifier, 'Cancelled')
      .withArgs(0, 1);
    await expect(cancelVerifier.cancel(0, 1))
      .to.be.revertedWith('CancelVerifier: bit is used')
  });

  it("Cannot call the account with a zero bit, should revert with 'CancelVerifier: bit cannot be zero'", async function() {
    const CancelVerifier = await ethers.getContractFactory("CancelVerifier");
    const cancelVerifier = await CancelVerifier.deploy()
    await expect(cancelVerifier.cancel(0, 0))
      .to.be.revertedWith('CancelVerifier: bit cannot be zero')
  })

  it("Cannot call the account with multiple bits, should revert with 'CancelVerifier: bit must be a single bit'", async function() {
    const CancelVerifier = await ethers.getContractFactory("CancelVerifier");
    const cancelVerifier = await CancelVerifier.deploy()
    await expect(cancelVerifier.cancel(0, 3))
      .to.be.revertedWith('CancelVerifier: bit must be a single bit')
  })
})