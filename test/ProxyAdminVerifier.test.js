const { ethers } = require('hardhat')
const { setupMetaAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { encodeFunctionCall } = brinkUtils 
const {
  randomAddress,
  chaiSolidity
} = brinkUtils.test
const { expect } = chaiSolidity()

describe('ProxyAdminVerifier', function() {
  beforeEach(async function () {

    const { defaultAccount, metaAccountOwner } = await getSigners()
    this.defaultAccount = defaultAccount
    this.metaAccountOwner = metaAccountOwner
    this.random = await randomAddress()

    const MockAccount = await ethers.getContractFactory('MockAccount')
    this.upgradeToAccount = await MockAccount.deploy(this.random.address, this.random.address)

    const ProxyAdminVerifier = await ethers.getContractFactory('ProxyAdminVerifier')
    this.proxyAdminVerifier = await ProxyAdminVerifier.deploy()

    this.metaAccount = (await setupMetaAccount()).metaAccount
    this.metaAccountAsProxyAdmin = await ethers.getContractAt('ProxyAdminVerifier', this.metaAccount.address)
  })

  describe('upgradeTo()', function () {
    beforeEach(async function () {
      this.promise = this.metaAccount.connect(this.metaAccountOwner).delegateCall(
        this.proxyAdminVerifier.address,
        encodeFunctionCall('upgradeTo', ['address'], [this.upgradeToAccount.address])
      )
    })
    it('should upgrade the implementation address', async function () {
      await this.promise
      expect(await this.metaAccount.implementation()).to.equal(this.upgradeToAccount.address)
    })
    it('should emit an Upgraded event', async function () {
      await expect(this.promise)
        .to.emit(this.metaAccountAsProxyAdmin, 'Upgraded').withArgs(this.upgradeToAccount.address)
    })
  })

  describe('setOwner()', function () {
    beforeEach(async function () {
      this.promise = this.metaAccount.connect(this.metaAccountOwner).delegateCall(
        this.proxyAdminVerifier.address,
        encodeFunctionCall('setProxyOwner', ['address'], [this.random.address])
      )
    })
    it('should set the proxy owner address', async function () {
      await this.promise
      expect(await this.metaAccount.proxyOwner()).to.equal(this.random.address)
    })
    it('should emit an Upgraded event', async function () {
      await expect(this.promise)
        .to.emit(this.metaAccountAsProxyAdmin, 'ProxyOwnerChanged').withArgs(this.random.address)
    })
  })

})