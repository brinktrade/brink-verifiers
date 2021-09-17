const { expect } = require('chai')
const { ethers } = require('hardhat')
const brinkUtils = require('@brinkninja/utils')
const { soliditySha3, padLeft } = require('web3-utils')
const { encodeFunctionCall } = brinkUtils
const snapshotGas = require('./helpers/snapshotGas')
const { setupMetaAccount, getSigners } = require('@brinkninja/core/test/helpers')

describe('CancelVerifier', function() {
  beforeEach(async function () {
    const { defaultAccount, metaAccountOwner } = await getSigners()
    this.defaultAccount = defaultAccount
    this.metaAccountOwner = metaAccountOwner

    const CancelVerifier = await ethers.getContractFactory('CancelVerifier')
    this.cancelVerifier = await CancelVerifier.deploy()

    const { metaAccount } = await setupMetaAccount()

    this.metaAccount = await metaAccount.connect(this.metaAccountOwner)
    this.metaAccountWithCancelVerifier = await CancelVerifier.attach(metaAccount.address)
  })

  it('should flip the bit the correct pointer storage location', async function() {
    await this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )
    const bmpPtr = soliditySha3(
      { t: 'string', v: 'bmp' },
      { t: 'uint256', v: 0 }
    )
    const storedBit = await this.metaAccount.storageLoad(bmpPtr)
    expect(storedBit.toString()).to.equal(`0x${padLeft('1', 64)}`)
  })

  it('should emit a Cancelled event', async function() {
    await expect(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.emit(this.metaAccountWithCancelVerifier, 'Cancel').withArgs(0, 1)
  })

  it('cancel existing bit should revert with \'BIT_USED\'', async function() {
    await expect(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.emit(this.metaAccountWithCancelVerifier, 'Cancel').withArgs(0, 1)
    await expect(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    )).to.be.revertedWith('BIT_USED')
  })

  it('cancel with zero bit should revert with \'INVALID_BIT\'', async function() {
    await expect(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 0])
    )).to.be.revertedWith('INVALID_BIT')
  })

  it('cancel with multiple bits should revert with \'INVALID_BIT\'', async function() {
    await expect(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 3])
    )).to.be.revertedWith('INVALID_BIT')
  })

  it('gas cost', async function() {
    await snapshotGas(this.metaAccount.delegateCall(
      this.cancelVerifier.address,
      encodeFunctionCall('cancel', ['uint256', 'uint256'], [0, 1])
    ))
  })
})