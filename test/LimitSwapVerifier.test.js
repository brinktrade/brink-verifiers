const { ethers } = require('hardhat')
const { setupMetaAccount, getSigners } = require('@brinkninja/core/test/helpers')
const { 
  BN, 
  BN18,
  encodeFunctionCall,
  splitCallData,
  testMetaTxEndpoint,
  chaiSolidity
} = require('@brinkninja/test-helpers')
const { expect } = chaiSolidity()

const EXECUTE_PARTIAL_SIGNED_DELEGATE_CALL_PARAM_TYPES = [
    { name: 'to', type: 'address' },
    { name: 'data', type: 'bytes' }
]

const LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES = [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'tokenInAmount', type: 'uint256' },
    { name: 'tokenOutAmount', type: 'uint256' },
    { name: 'expiryBlock', type: 'uint256' },
    { name: 'to', type: 'address' },
    { name: 'data', type: 'bytes' },
  ]

function getSignerFn (signerName) {
  return async function () {
    const signer = (await getSigners())[signerName]
    return signer
  }
}

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
    this.tokenA = tokenA
    this.tokenB = tokenB

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

      const numSignedParams = 5

      this.successCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenB.address,
              this.tokenBSwapAmount.toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.failCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenB.address,
              // fail when trying to transfer more Token B than the TestFulfillSwap contract has
              this.tokenBSwapAmount.mul(BN(2)).toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.notEnoughTokenCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenB.address,
              // fail when trying to transfer less than the signed call requires
              this.tokenBSwapAmount.sub(BN(1)).toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.expiredBlockCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        LIMIT_SWAP_TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenB.address,
              this.tokenBSwapAmount.toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)
    })

    testMetaTxEndpoint.call(this, {
      contract: 'metaAccount',
      method: 'executePartialSignedDelegateCall',
      paramTypes: EXECUTE_PARTIAL_SIGNED_DELEGATE_CALL_PARAM_TYPES,
      conditions: [
        {
          describe: 'when given a valid tokenToToken and call',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.successCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.successCall.unsignedData] },
          testFn: function () {
            it('should execute successfully', async function () {
              expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(BN(0))
              expect(await this.tokenB.balanceOf(this.metaAccount.address)).to.equal(this.tokenBSwapAmount)
              expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
              expect(await this.tokenB.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
            })
          }
        },
        {
          describe: 'when the unsigned call fails',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.failCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.failCall.unsignedData] },
          expectRevert: 'ERC20: transfer amount exceeds balance'
        },
        {
          describe: 'when the unsigned call transfer is insufficient',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.notEnoughTokenCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.notEnoughTokenCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: tokenToToken() tokenOut received is less than allowed'
        },
        {
          describe: 'when expiryBlock has been mined',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.expiredBlockCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.expiredBlockCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: tokenToToken() expiryBlock exceeded'
        }
      ]
    })
  })

  describe('ethToToken()', function () {
    beforeEach(async function () {
      this.ethSwapAmount = BN(2).mul(BN18)
      this.tokenASwapAmount = BN(4).mul(BN18)

      // 2 calls needed for the used bit revert test, so send enough eth for both
      this.metaAccountInitialEthBalance = this.ethSwapAmount.mul(BN(2))

      const ethStoreAccount = await getSigner('ethStoreAccount')
      await ethStoreAccount.sendTransaction({
        to: this.metaAccount.address,
        value: this.metaAccountInitialEthBalance
      })
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)

      const numSignedParams = 4

      this.successCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.ethSwapAmount.toString(),
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenA.address,
              this.tokenASwapAmount.toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.notEnoughBalanceCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.metaAccountInitialEthBalance.add(1).toString(),
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenA.address,
              this.tokenASwapAmount.toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.notEnoughReceivedCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.ethSwapAmount.toString(),
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenA.address,
              // fail when trying to transfer less than the signed call requires
              this.tokenASwapAmount.sub(BN(1)).toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)

      this.expiredBlockCall = splitCallData(encodeFunctionCall(
        'ethToToken',
        LIMIT_SWAP_ETH_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.ethSwapAmount.toString(),
          this.tokenASwapAmount.toString(),
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [
              this.tokenA.address,
              this.tokenASwapAmount.toString(),
              this.metaAccount.address
            ]
          )
        ]
      ).slice(2), numSignedParams)
    })

    testMetaTxEndpoint.call(this, {
      contract: 'metaAccount',
      method: 'executePartialSignedDelegateCall',
      paramTypes: EXECUTE_PARTIAL_SIGNED_DELEGATE_CALL_PARAM_TYPES,
      conditions: [
        {
          describe: 'when given a valid ethToToken call',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.successCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.successCall.unsignedData] },
          testFn: function () {
            it('should execute successfully', async function () {
              expect(BN(await ethers.provider.getBalance(this.metaAccount.address))).to.equal(this.metaAccountInitialEthBalance.sub(this.ethSwapAmount))
              expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(this.tokenASwapAmount)
              expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(this.ethSwapAmount)
              expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
            })
          }
        },
        {
          describe: 'when account does not have enough ETH',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.notEnoughBalanceCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.notEnoughBalanceCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: ethToToken() not enough ether'
        },
        {
          describe: 'when the unsigned call transfer into account is insufficient',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.notEnoughReceivedCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.notEnoughReceivedCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: ethToToken() token received is less than allowed'
        },
        {
          describe: 'when the expiryBlock has been mined',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.expiredBlockCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.expiredBlockCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: ethToToken() expiryBlock exceeded'
        }
      ]
    })
  })

  describe('tokenToEth', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.ethSwapAmount = BN(4).mul(BN18)
      await this.tokenA.mint(this.metaAccount.address, this.tokenASwapAmount)

      const ethStoreAccount = await getSigner('ethStoreAccount')
      await ethStoreAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.ethSwapAmount
      })

      const numSignedParams = 4

      this.successCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenASwapAmount.toString(),
          this.ethSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ).slice(2), numSignedParams)

      this.notEnoughBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenASwapAmount.add(1).toString(),
          this.ethSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ).slice(2), numSignedParams)

      this.notEnoughReceivedCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenASwapAmount.toString(),
          this.ethSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.sub(1).toString(), this.metaAccount.address ]
          )
        ]
      ).slice(2), numSignedParams)

      this.expiredBlockCall = splitCallData(encodeFunctionCall(
        'tokenToEth',
        LIMIT_SWAP_TOKEN_TO_ETH_PARAM_TYPES.map(t => t.type),
        [
          this.tokenA.address,
          this.tokenASwapAmount.toString(),
          this.ethSwapAmount.toString(),
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.ethSwapAmount.toString(), this.metaAccount.address ]
          )
        ]
      ).slice(2), numSignedParams)
    })

    testMetaTxEndpoint.call(this, {
      contract: 'metaAccount',
      method: 'executePartialSignedDelegateCall',
      paramTypes: EXECUTE_PARTIAL_SIGNED_DELEGATE_CALL_PARAM_TYPES,
      conditions: [
        {
          describe: 'when given a valid tokenToEth() signature and call',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.successCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.successCall.unsignedData] },
          testFn: function () {
            it('should execute successfully', async function () {
              expect(await this.tokenA.balanceOf(this.metaAccount.address)).to.equal(BN(0))
              expect(BN(await ethers.provider.getBalance(this.metaAccount.address))).to.equal(this.ethSwapAmount)
              expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
              expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
            })
          }
        },
        {
          describe: 'when account does not have enough token balance',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.notEnoughBalanceCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.notEnoughBalanceCall.unsignedData] },
          expectRevert: 'ERC20: transfer amount exceeds balance'
        },
        {
          describe: 'when amount of ETH received is not enough',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.notEnoughReceivedCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.notEnoughReceivedCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: tokenToEth() ether received is less than allowed'
        },
        {
          describe: 'when the expiryBlock has been mined',
          getSigner: getSignerFn('metaAccountOwner'),
          paramsFn: function () { return [
            this.limitSwapVerifier.address,
            this.expiredBlockCall.signedData
          ] },
          unsignedParamsFn: function () { return [this.expiredBlockCall.unsignedData] },
          expectRevert: 'LimitSwapVerifier: tokenToEth() expiryBlock exceeded'
        }
      ]
    })
  })
})
