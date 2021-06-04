const { expect } = require("chai");
const { ethers } = require('hardhat')
const { constants, getSigners } = require('@openzeppelin/test-helpers')
const { ZERO_ADDRESS } = constants

describe("ProxyAdminVerifier", function() {
  beforeEach(async function () {
    const [ defaultAccount, someOtherAccount ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.someOtherAccount = someOtherAccount
  })

  it("upgradeTo() upgrades implementation", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.upgradeTo(this.someOtherAccount.address))
      .to.emit(proxyAdminVerifier, 'Upgraded')
      .withArgs(this.someOtherAccount.address);
  }); 

  it("upgradeTo() with zero address reverts with: 'ProxyAdminVerifier: upgradeTo with zero address implementation'", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.upgradeTo(ZERO_ADDRESS))
      .to.be.revertedWith('ProxyAdminVerifier: upgradeTo with zero address implementation')
  }); 

  it("addProxyOwner() adds a proxy owner address", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.addProxyOwner(this.someOtherAccount.address))
      .to.emit(proxyAdminVerifier, 'OwnerAdded')
      .withArgs(this.someOtherAccount.address);
  }); 

  it("addProxyOwner() tries to add same address twice, reverts with: 'ProxyAdminVerifier: addOwner with existing owner'", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.addProxyOwner(this.someOtherAccount.address))
      .to.emit(proxyAdminVerifier, 'OwnerAdded')
      .withArgs(this.someOtherAccount.address);
    await expect(proxyAdminVerifier.addProxyOwner(this.someOtherAccount.address))
      .to.be.revertedWith('ProxyAdminVerifier: addOwner with existing owner')
  });

  it("addProxyOwner() tries to add zero address, reverts with: 'ProxyAdminVerifier: addOwner with zero address'", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.addProxyOwner(ZERO_ADDRESS))
      .to.be.revertedWith('ProxyAdminVerifier: addOwner with zero address')
  });

  it("removeProxyOwner() removes a proxy owner", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.addProxyOwner(this.someOtherAccount.address))
      .to.emit(proxyAdminVerifier, 'OwnerAdded')
      .withArgs(this.someOtherAccount.address);
    await expect(proxyAdminVerifier.removeProxyOwner(this.someOtherAccount.address))
      .to.emit(proxyAdminVerifier, 'OwnerRemoved')
      .withArgs(this.someOtherAccount.address);
  });

  it("removeProxyOwner() tries to remove address that isn't an owner, reverts with: 'ProxyAdminVerifier: removeOwner with owner that does not exist'", async function() {
    const ProxyAdminVerifier = await ethers.getContractFactory("ProxyAdminVerifier");
    const proxyAdminVerifier = await ProxyAdminVerifier.deploy()
    await expect(proxyAdminVerifier.removeProxyOwner(this.someOtherAccount.address))
      .to.be.revertedWith('ProxyAdminVerifier: removeOwner with owner that does not exist')
  });

})