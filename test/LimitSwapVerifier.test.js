const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupMetaAccount, getSigners } = require('@brinkninja/core/test/helpers')
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
    const LimitSwapVerifier = await ethers.getContractFactory('LimitSwapVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const { metaAccount } = await setupMetaAccount()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.limitSwapVerifier = await LimitSwapVerifier.deploy()
    this.metaAccount = metaAccount
    
    const { defaultAccount, metaAccountOwner } = await getSigners()
    this.defaultAccount = defaultAccount
    this.metaAccountOwner = metaAccountOwner
    this.tokenA = tokenA
    this.tokenB = tokenB

    this.partialSignedDelegateCall = ({ signedData, unsignedData }) => {
      return execMetaTx({
        ...{
          contract: this.metaAccount,
          method: 'metaPartialSignedDelegateCall',
          signer: this.metaAccountOwner
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
      await this.tokenA.mint(this.metaAccount.address, this.tokenASwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenB.address,
        this.tokenASwapAmount.toString(),
        this.tokenBSwapAmount.toString()
      ]

      this.successCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.metaAccount.address ]
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
            [ this.tokenB.address, this.tokenBSwapAmount.sub(BN(1)).toString(), this.metaAccount.address ]
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
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.metaAccount.address ]
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
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.partialSignedDelegateCall(this.successCall)
      expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(BN(0))
      expect(await this.tokenB.balanceOf(this.metaAccount.address)).to.equal(this.tokenBSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.tokenB.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when not enough token is received, should revert with NOT_ENOUGH_RECEIVED', async function () {
      await expect(this.partialSignedDelegateCall(this.notEnoughTokenCall)).to.be.revertedWith('NOT_ENOUGH_RECEIVED')
    })

    it('when account does not have enough tokenIn, should revert with TRANSFER_FAILED', async function () {
      await expect(this.partialSignedDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('TRANSFER_FAILED')
    })

    it('when swap is expired, should revert with EXPIRED', async function () {
      await expect(this.partialSignedDelegateCall(this.expiredCall)).to.be.revertedWith('EXPIRED')
    })

    it('when swap is replayed, should revert with BIT_USED', async function () {
      await this.partialSignedDelegateCall(this.successCall)
      await expect(this.partialSignedDelegateCall(this.successCall)).to.be.revertedWith('BIT_USED')
    })

    it('gas cost', async function () {
      const { tx } = await this.partialSignedDelegateCall(this.successCall)
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('ethToToken()', function () {
    beforeEach(async function () {
      this.ethSwapAmount = BN(2).mul(BN18)
      this.tokenASwapAmount = BN(4).mul(BN18)

      // 2 calls needed for the used bit revert test, so send enough eth for both
      this.metaAccountInitialEthBalance = this.ethSwapAmount.mul(BN(2))

      await this.defaultAccount.sendTransaction({
        to: this.metaAccount.address,
        value: this.metaAccountInitialEthBalance
      })
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.ethSwapAmount.toString(),
        this.tokenASwapAmount.toString(),
      ]

      this.successCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughBalanceCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.metaAccountInitialEthBalance.add(1).toString(),
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.metaAccount.address ]
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
            [ this.tokenA.address, this.tokenASwapAmount.sub(BN(1)).toString(), this.metaAccount.address ]
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
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when given a valid ethToToken call, should execute the swap', async function () {
      await this.partialSignedDelegateCall(this.successCall)
      expect(BN(await ethers.provider.getBalance(this.metaAccount.address)))
        .to.equal(this.metaAccountInitialEthBalance.sub(this.ethSwapAmount))
      expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(this.ethSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when account does not have enough ETH, should revert', async function () {
      await expect(this.partialSignedDelegateCall(this.notEnoughBalanceCall)).to.be.revertedWith('NOT_ENOUGH_ETH')
    })

    it('when not enough token is received, should revert with NOT_ENOUGH_RECEIVED', async function () {
      await expect(this.partialSignedDelegateCall(this.notEnoughReceivedCall))
        .to.be.revertedWith('NOT_ENOUGH_RECEIVED')
    })

    it('when swap is expired, should revert with EXPIRED', async function () {
      await expect(this.partialSignedDelegateCall(this.expiredCall)).to.be.revertedWith('EXPIRED')
    })

    it('when swap is replayed, should revert with BIT_USED', async function () {
      await this.partialSignedDelegateCall(this.successCall)
      await expect(this.partialSignedDelegateCall(this.successCall)).to.be.revertedWith('BIT_USED')
    })

    it('gas cost', async function () {
      const { tx } = await this.partialSignedDelegateCall(this.successCall)
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('tokenToEth', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.ethSwapAmount = BN(4).mul(BN18)

      await this.tokenA.mint(this.metaAccount.address, this.tokenASwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.ethSwapAmount
      })

      this.tokenToEthExecArgs = {
        contract: this.metaAccount,
        method: 'metaPartialSignedDelegateCall',
        signer: this.metaAccountOwner
      }

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenASwapAmount.toString(),
        this.ethSwapAmount.toString(),
      ]

      this.successCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
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
            [ this.ethSwapAmount.sub(1).toString(), this.metaAccount.address ]
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
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
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
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when given a valid tokenToEth call, should execute the swap', async function () {
      await this.partialSignedDelegateCall(this.successCall) 
      expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(BN(0))
      expect(BN(await ethers.provider.getBalance(this.metaAccount.address))).to.equal(this.ethSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
    })

    it('when amount of ETH received is not enough, should revert with NOT_ENOUGH_RECEIVED', async function () {
      await expect(this.partialSignedDelegateCall(this.notEnoughReceivedCall))
        .to.be.revertedWith('NOT_ENOUGH_RECEIVED')
    })

    it('when account does not have enough token, should revert with TRANSFER_FAILED', async function () {
      await expect(this.partialSignedDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('TRANSFER_FAILED')
    })

    it('when swap is expired, should revert with EXPIRED', async function () {
      await expect(this.partialSignedDelegateCall(this.expiredCall)).to.be.revertedWith('EXPIRED')
    })

    it('when swap is replayed, should revert with BIT_USED', async function () {
      await this.partialSignedDelegateCall(this.successCall)
      await expect(this.partialSignedDelegateCall(this.successCall)).to.be.revertedWith('BIT_USED')
    })

    it('gas cost', async function () {
      const { tx } = await this.partialSignedDelegateCall(this.successCall)
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
