const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall } = brinkUtils
const { BN18 } = brinkUtils.constants
const { execMetaTx } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')

const ETH_TRANSFER_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'amount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' }
]

const TOKEN_TRANSFER_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'token', type: 'address' },
  { name: 'recipient', type: 'address' },
  { name: 'amount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' }
]

describe('TransferVerifier', function() {
  beforeEach(async function () {
    const TransferVerifier = await ethers.getContractFactory('TransferVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    this.transferVerifier = await TransferVerifier.deploy()
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    
    const [ defaultAccount, transferRecipient, , , , proxyOwner_4, proxyOwner_5 ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.proxyOwner_4 = proxyOwner_4
    this.proxyOwner_5 = proxyOwner_5
    this.transferRecipient = transferRecipient
    this.tokenA = tokenA

    const chainId = await defaultAccount.getChainId()

    this.signedDelegateCall = ({ signedData, account, owner }) => execMetaTx({
      contract: account || this.proxyAccount,
      method: 'metaDelegateCall',
      signer: owner || this.proxyOwner,
      chainId,
      params: [
        this.transferVerifier.address,
        signedData
      ],
      unsignedData: '0x'
    })

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('tokenTransfer()', function () {
    beforeEach(async function () {
      this.amount = BN(100).mul(BN18)
      await this.tokenA.mint(this.proxyAccount.address, this.amount)
      this.successCall = encodeFunctionCall(
        'tokenTransfer',
        TOKEN_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.tokenA.address, this.transferRecipient.address, this.amount, this.expiryBlock]
      )

      this.expiredCall = encodeFunctionCall(
        'tokenTransfer',
        TOKEN_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.tokenA.address, this.transferRecipient.address, this.amount, this.expiredBlock]
      )

      this.notEnoughCall = encodeFunctionCall(
        'tokenTransfer',
        TOKEN_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.tokenA.address, this.transferRecipient.address, this.amount.mul(2), this.expiryBlock]
      )
    })
    it('valid signed call should transfer the token', async function () {
      await this.signedDelegateCall({ signedData: this.successCall })
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.tokenA.balanceOf(this.transferRecipient.address)).to.equal(this.amount)
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.signedDelegateCall({ signedData: this.expiredCall })).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.signedDelegateCall({ signedData: this.successCall })
      await expect(this.signedDelegateCall({ signedData: this.successCall })).to.be.revertedWith('BitUsed()')
    })

    it('when account does not have enough token, should revert with TRANSFER_FAILED', async function () {
      await expect(this.signedDelegateCall({ signedData: this.notEnoughCall })).to.be.revertedWith('TRANSFER_FAILED')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_4)
      await this.tokenA.mint(proxyAccount.address, this.amount)
      const { tx } = await this.signedDelegateCall({
        signedData: this.successCall, account: proxyAccount, owner: this.proxyOwner_4
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('ethTransfer()', function () {
    beforeEach(async function () {
      this.amount = BN(100).mul(BN18)
      await this.defaultAccount.sendTransaction({
        to: this.proxyAccount.address,
        value: this.amount
      })
      this.successCall = encodeFunctionCall(
        'ethTransfer',
        ETH_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.transferRecipient.address, this.amount, this.expiryBlock]
      )

      this.expiredCall = encodeFunctionCall(
        'ethTransfer',
        ETH_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.transferRecipient.address, this.amount, this.expiredBlock]
      )

      this.notEnoughCall = encodeFunctionCall(
        'ethTransfer',
        ETH_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.transferRecipient.address, this.amount.mul(2), this.expiryBlock]
      )
    })

    it('valid signed call should transfer the ETH', async function () {
      const iBalance = await ethers.provider.getBalance(this.transferRecipient.address)
      await this.signedDelegateCall({ signedData: this.successCall })
      expect(await ethers.provider.getBalance(this.proxyAccount.address)).to.equal(0)
      const fBalance = await ethers.provider.getBalance(this.transferRecipient.address)
      expect(fBalance.sub(iBalance)).to.equal(this.amount)
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.signedDelegateCall({ signedData: this.expiredCall })).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.signedDelegateCall({ signedData: this.successCall })
      await expect(this.signedDelegateCall({ signedData: this.successCall })).to.be.revertedWith('BitUsed()')
    })

    it('when account does not have enough token, should revert with ETH_TRANSFER_FAILED', async function () {
      await expect(this.signedDelegateCall({ signedData: this.notEnoughCall })).to.be.revertedWith('ETH_TRANSFER_FAILED')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_5)
      await this.defaultAccount.sendTransaction({
        to: proxyAccount.address,
        value: this.amount
      })
      const { tx } = await this.signedDelegateCall({
        signedData: this.successCall,
        account: proxyAccount,
        owner: this.proxyOwner_5
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
