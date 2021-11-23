const { expect } = require('chai')
const { ethers } = require('hardhat')
const brinkUtils = require('@brinkninja/utils')
const { soliditySha3, padLeft } = require('web3-utils')
const { BN, encodeFunctionCall } = brinkUtils
const snapshotGas = require('./helpers/snapshotGas')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')

describe('CancelVerifier', function() {
  beforeEach(async function () {
    const { defaultAccount } = await getSigners()
    this.defaultAccount = defaultAccount

    const CancelVerifier = await ethers.getContractFactory('CancelVerifier')
    this.cancelVerifier = await CancelVerifier.deploy()

    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    this.proxyOwner = proxyOwner

    this.proxyAccount = await proxyAccount.connect(this.proxyOwner)
    this.proxyAccountWithCancelVerifier = await CancelVerifier.attach(proxyAccount.address)
  })

  it('should flip the bit the correct pointer storage location', async function() {
    await this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )
    const bmpPtr = BN(soliditySha3('bmp')).add(BN(0))
    const storedBit = await ethers.provider.getStorageAt(this.proxyAccount.address, bmpPtr)
    expect(storedBit.toString()).to.equal(`0x${padLeft('1', 64)}`)
  })

  it('should emit a Cancel event', async function() {
    await expect(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.emit(this.proxyAccountWithCancelVerifier, 'Cancel').withArgs(0, 1)
  })

  it('cancel existing bit should revert with \'BIT_USED\'', async function() {
    await expect(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.emit(this.proxyAccountWithCancelVerifier, 'Cancel').withArgs(0, 1)
    await expect(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.be.revertedWith('BIT_USED')
  })

  it('cancel with zero bit should revert with \'INVALID_BIT\'', async function() {
    await expect(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 0])
    )).to.be.revertedWith('INVALID_BIT')
  })

  it('cancel with multiple bits should revert with \'INVALID_BIT\'', async function() {
    await expect(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 3])
    )).to.be.revertedWith('INVALID_BIT')
  })

  it('gas cost', async function() {
    await snapshotGas(this.proxyAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    ))
  })
})