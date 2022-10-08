const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { BN18 } = brinkUtils.constants
const { execMetaTx } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')
const { MAX_UINT256 } = require('@brinkninja/utils/src/constants')

const LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
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
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

describe('LimitApprovalSwapVerifier', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const CallExecutor = await ethers.getContractFactory('CallExecutor')
    const LimitApprovalSwapVerifier = await ethers.getContractFactory('LimitApprovalSwapVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    await CallExecutor.deploy()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.limitSwapVerifier = await LimitApprovalSwapVerifier.deploy()
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    
    const [ defaultAccount, , , , , , , , proxyOwner_7, proxyOwner_8 ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.tokenA = tokenA
    this.tokenB = tokenB
    this.proxyOwner_7 = proxyOwner_7
    this.proxyOwner_8 = proxyOwner_8

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
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenB.address,
        this.tokenASwapAmount.toString(),
        this.tokenBSwapAmount.toString()
      ]

      this.successCall = proxyOwner => splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), proxyOwner.address ]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            // fail when trying to transfer less than the signed call requires
            [ this.tokenB.address, this.tokenBSwapAmount.sub(BN(1)).toString(), this.proxyOwner.address ]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner.address]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner.address]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {

      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(await this.tokenB.balanceOf(this.proxyOwner.address)).to.equal(this.tokenBSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.tokenB.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when not enough token is received, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughTokenCall)).to.be.revertedWith(`NotEnoughReceived(${this.tokenBSwapAmount.sub(BN(1)).toString()})`)
    })

    it('when account does not have enough tokenIn, should revert with "ERC20: transfer amount exceeds balance"', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_7)
      await this.tokenA.mint(this.proxyOwner_7.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner_7).approve(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(this.proxyOwner_7), account: proxyAccount, owner: this.proxyOwner_7
      })
      await snapshotGas(new Promise(r => r(tx)))
    })

  })

  describe('tokenToEth', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.ethSwapAmount = BN(4).mul(BN18)

      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
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

      this.successCall = proxyOwner => splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), proxyOwner.address ]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.sub(1).toString(), this.proxyOwner.address ]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.proxyOwner.address ]
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
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when given a valid tokenToEth call, should execute the swap', async function () {
      const initalBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      await this.metaDelegateCall(this.successCall(this.proxyOwner)) 
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(BN(await ethers.provider.getBalance(this.proxyOwner.address))).to.equal(initalBalance.add(this.ethSwapAmount))
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
    })

    it('when amount of ETH received is not enough, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughReceivedCall))
        .to.be.revertedWith(`NotEnoughReceived(${this.ethSwapAmount.sub(1).toString()})`)
    })

    it('when account does not have enough token, should revert with "ERC20: transfer amount exceeds balance"', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_8)
      await this.tokenA.mint(this.proxyOwner_8.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner_8).approve(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(this.proxyOwner_8), account: proxyAccount, owner: this.proxyOwner_8
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
