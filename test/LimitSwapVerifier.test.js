const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { BN18 } = brinkUtils.constants
const { execMetaTx } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')

const LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'token', type: 'address' },
  { name: 'ethAmount', type: 'uint256' },
  { name: 'tokenAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'token', type: 'address' },
  { name: 'tokenAmount', type: 'uint256' },
  { name: 'ethAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

describe('LimitSwapVerifier', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const CallExecutor = await ethers.getContractFactory('CallExecutor')
    const LimitSwapVerifier = await ethers.getContractFactory('LimitSwapVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    const callExecutor = await CallExecutor.deploy()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.limitSwapVerifier = await LimitSwapVerifier.deploy(callExecutor.address)
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    
    const [ defaultAccount, , proxyOwner_1, proxyOwner_2, proxyOwner_3 ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.proxyOwner_1 = proxyOwner_1
    this.proxyOwner_2 = proxyOwner_2
    this.proxyOwner_3 = proxyOwner_3
    this.tokenA = tokenA
    this.tokenB = tokenB

    const chainId = await defaultAccount.getChainId()

    this.metaDelegateCall = ({ signedData, unsignedData, account, owner }) => {
      return execMetaTx({
        ...{
          contract: account || this.proxyAccount,
          method: 'metaDelegateCall',
          signer: owner || this.proxyOwner,
          chainId
        },
        params: [
          this.limitSwapVerifier.address,
          signedData
        ],
        unsignedData
      })
    }

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('tokenToToken()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.tokenBSwapAmount = BN(4).mul(BN18)
      await this.tokenA.mint(this.proxyAccount.address, this.tokenASwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenB.address,
        this.tokenASwapAmount.toString(),
        this.tokenBSwapAmount.toString()
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughTokenCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            // fail when trying to transfer less than the signed call requires
            [ this.tokenB.address, this.tokenBSwapAmount.sub(BN(1)).toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(BN(0))
      expect(await this.tokenB.balanceOf(this.proxyAccount.address)).to.equal(this.tokenBSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.tokenB.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when not enough token is received, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughTokenCall)).to.be.revertedWith(`NotEnoughReceived(${this.tokenBSwapAmount.sub(BN(1)).toString()})`)
    })

    it('when account does not have enough tokenIn, should revert with TRANSFER_FAILED', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('TRANSFER_FAILED')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      await expect(this.metaDelegateCall(this.successCall(this.proxyAccount))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_1)
      await this.tokenA.mint(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyAccount), account: proxyAccount, owner: this.proxyOwner_1
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('ethToToken()', function () {
    beforeEach(async function () {
      this.ethSwapAmount = BN(2).mul(BN18)
      this.tokenASwapAmount = BN(4).mul(BN18)

      // 2 calls needed for the used bit revert test, so send enough eth for both
      this.proxyAccountInitialEthBalance = this.ethSwapAmount.mul(BN(2))

      await this.defaultAccount.sendTransaction({
        to: this.proxyAccount.address,
        value: this.proxyAccountInitialEthBalance
      })
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.ethSwapAmount.toString(),
        this.tokenASwapAmount.toString(),
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughBalanceCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.proxyAccountInitialEthBalance.add(1).toString(),
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughReceivedCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            // fail when trying to transfer less than the signed call requires
            [ this.tokenA.address, this.tokenASwapAmount.sub(BN(1)).toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when given a valid ethToToken call, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(BN(await ethers.provider.getBalance(this.proxyAccount.address)))
        .to.equal(this.proxyAccountInitialEthBalance.sub(this.ethSwapAmount))
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(this.ethSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when account does not have enough ETH, should revert', async function () {
      await expect(this.metaDelegateCall(this.notEnoughBalanceCall)).to.be.reverted
    })

    it('when not enough token is received, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughReceivedCall))
        .to.be.revertedWith(`NotEnoughReceived(${this.tokenASwapAmount.sub(BN(1)).toString()})`)
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      await expect(this.metaDelegateCall(this.successCall(this.proxyAccount))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_2)
      await this.defaultAccount.sendTransaction({
        to: proxyAccount.address,
        value: this.proxyAccountInitialEthBalance
      })
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyAccount), account: proxyAccount, owner: this.proxyOwner_2
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('tokenToEth', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.ethSwapAmount = BN(4).mul(BN18)

      await this.tokenA.mint(this.proxyAccount.address, this.tokenASwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.ethSwapAmount
      })

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenASwapAmount.toString(),
        this.ethSwapAmount.toString(),
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughReceivedCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.sub(1).toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.ethSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when given a valid tokenToEth call, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount)) 
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(BN(0))
      expect(BN(await ethers.provider.getBalance(this.proxyAccount.address))).to.equal(this.ethSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
    })

    it('when amount of ETH received is not enough, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughReceivedCall))
        .to.be.revertedWith(`NotEnoughReceived(${this.ethSwapAmount.sub(1).toString()})`)
    })

    it('when account does not have enough token, should revert with TRANSFER_FAILED', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('TRANSFER_FAILED')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      await expect(this.metaDelegateCall(this.successCall(this.proxyAccount))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_3)
      await this.tokenA.mint(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyAccount), account: proxyAccount, owner: this.proxyOwner_3
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
