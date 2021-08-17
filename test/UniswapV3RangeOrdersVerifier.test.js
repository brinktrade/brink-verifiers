const { expect } = require('chai')
const { ethers } = require('hardhat')
const { soliditySha3 } = require('web3-utils')
const { setupMetaAccount } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN } = brinkUtils
const { BN17, BN18 } = brinkUtils.constants
const { nextAvailableBit, signMetaTx, deployTestTokens } = brinkUtils.testHelpers(ethers)

const weth9Contract = require('./weth9/weth9Contract')

const abiCoder = ethers.utils.defaultAbiCoder

const MOCK_TOTAL_LIQUIDITY = BN(1000)

// this is the signed data length for the UniswapV3RangeOrdersVerifier.createRangeOrder() call
// signed data is the prefix + fnSig + signedParams
const numSignedParams = 6
const numSignedParams_ethCall = 5
const bytes32SlotLen = 64
const fnSigLen = 8
const SIGNED_DATA_LENGTH = fnSigLen + (numSignedParams * bytes32SlotLen)
const SIGNED_DATA_LENGTH_ETH_CALL = fnSigLen + (numSignedParams_ethCall * bytes32SlotLen)

async function getSigners () {
  const [ ethStoreAccount, adapterOwner, owner1, owner2, owner3, owner4, owner5, owner6, owner7, owner8, owner9, owner10 ] = await ethers.getSigners()
  return { ethStoreAccount, adapterOwner, owner1, owner2, owner3, owner4, owner5, owner6, owner7, owner8, owner9, owner10 }
}

async function getSigner (signerName) {
  const fn = getSignerFn(signerName)
  const signer = await fn()
  return signer
}

function getSignerFn (signerName) {
  return async function () {
    const signer = (await getSigners())[signerName]
    return signer
  }
}

const deployWeth = async () => {
  const WETH9 = await weth9Contract()
  const weth = await WETH9.deploy()
  return weth
}

// TODO: remove UniV3RangeOrdersAdapter
describe.skip('UniswapV3RangeOrdersVerifier', function () {
  beforeEach(async function () {
    this.weth = await deployWeth()
    this.createRangeOrderAccountCallData = createRangeOrderAccountCallData.bind(this)

    const UniswapV3RangeOrdersVerifier = await ethers.getContractFactory('UniswapV3RangeOrdersVerifier')
    const UniV3RangeOrdersAdapter = await ethers.getContractFactory('UniV3RangeOrdersAdapter')
    const MockAccount = await ethers.getContractFactory('MockAccount')
    const MockRangeOrderPositionManager = await ethers.getContractFactory('MockRangeOrderPositionManager')

    this.ethStoreAccount = await getSigner('ethStoreAccount')
    this.adapterOwner = await getSigner('adapterOwner')
    this.owner1 = await getSigner('owner1')
    this.owner2 = await getSigner('owner2')
    this.owner3 = await getSigner('owner3')
    this.owner4 = await getSigner('owner4')
    this.owner5 = await getSigner('owner5')
    this.owner6 = await getSigner('owner6')
    this.owner7 = await getSigner('owner7')
    this.owner8 = await getSigner('owner8')
    this.owner9 = await getSigner('owner9')
    this.owner10 = await getSigner('owner10')

    const { tokenA, tokenB } = await deployTestTokens()
    const { metaAccount: account1 } = await setupMetaAccount(this.owner1)
    const { metaAccount: account2 } = await setupMetaAccount(this.owner2)
    const { metaAccount: account3 } = await setupMetaAccount(this.owner3)
    const { metaAccount: account4 } = await setupMetaAccount(this.owner4)
    const { metaAccount: account5 } = await setupMetaAccount(this.owner5)
    const { metaAccount: account6 } = await setupMetaAccount(this.owner6)
    const { metaAccount: account7 } = await setupMetaAccount(this.owner7)
    const { metaAccount: account8 } = await setupMetaAccount(this.owner8)
    const { metaAccount: account9 } = await setupMetaAccount(this.owner9)
    const { metaAccount: account10 } = await setupMetaAccount(this.owner10)

    this.account1 = await MockAccount.attach(account1.address)
    this.account2 = await MockAccount.attach(account2.address)
    this.account3 = await MockAccount.attach(account3.address)
    this.account4 = await MockAccount.attach(account4.address)
    this.account5 = await MockAccount.attach(account5.address)
    this.account6 = await MockAccount.attach(account6.address)
    this.account7 = await MockAccount.attach(account7.address)
    this.account8 = await MockAccount.attach(account8.address)
    this.account9 = await MockAccount.attach(account9.address)
    this.account10 = await MockAccount.attach(account10.address)

    // assume next available is the same for all accounts...
    const { bitmapIndex, bit } = await nextAvailableBit(this.account1)
    this.nextBitmapIndex = bitmapIndex
    this.nextBit = bit

    this.rangeOrderPositionManager = await MockRangeOrderPositionManager.deploy(MOCK_TOTAL_LIQUIDITY)
    this.rangeOrdersAdapter = await UniV3RangeOrdersAdapter.deploy(
      this.rangeOrderPositionManager.address, this.weth.address, this.adapterOwner.address
    )
    this.rangeOrdersVerifier = await UniswapV3RangeOrdersVerifier.deploy()

    this.tokenIn = tokenA
    this.tokenOut = tokenB
    this.feePool = 3000
    this.tickLower = -60
    this.tickUpper = 60

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('createOrders executePartialSignedDelegateCall', function () {
    describe('when creating 1 rangeOrder', function () {
      beforeEach(async function () {
        this.positionHash = computePositionHash(
          this.tokenIn.address, this.tokenOut.address, this.feePool, this.tickLower, this.tickUpper
        )
        this.tokenInAmount = BN(75).mul(BN18)
        this.tokenInAmountAfterReward = BN(70).mul(BN18)
        await this.tokenIn.mint(this.account1.address, this.tokenInAmount)

        const adapterCallData = this.rangeOrdersAdapter.interface.encodeFunctionData(
          'sendRangeOrder',
          [[
            this.account1.address, // owner
            this.tokenInAmountAfterReward, // inputAmount
            this.tokenIn.address,
            this.tokenOut.address,
            this.feePool,
            this.tickLower,
            this.tickUpper
          ]]
        )

        const delegatedCallData = this.rangeOrdersVerifier.interface.encodeFunctionData(
          'createRangeOrder',
          [
            this.rangeOrderPositionManager.address,
            this.positionHash,
            this.tokenIn.address,
            this.tokenInAmount,
            MOCK_TOTAL_LIQUIDITY,
            this.expiryBlock,
            this.rangeOrdersAdapter.address, // transferTo
            this.rangeOrdersAdapter.address, // executeTo ... same because there's 1 in the batch
            adapterCallData
          ]
        ).slice(2)

        const signedData = `0x${delegatedCallData.slice(0, SIGNED_DATA_LENGTH)}`

        // unsigned data is the rest
        const unsignedData = `0x${delegatedCallData.slice(SIGNED_DATA_LENGTH)}`

        // get the callData to the account, which will be sent directly in the tx
        const accountCallData = await partialSignedDelegatedCallData({
          account: this.account1,
          signer: this.owner1,
          bitmapIndex: this.nextBitmapIndex,
          bit: this.nextBit,
          params: [
            this.rangeOrdersVerifier.address,
            signedData
          ],
          unsignedParams: [unsignedData]
        })

        const tx = await this.owner1.sendTransaction({
          to: this.account1.address,
          data: accountCallData
        })
        
        await logTxGas(tx, 'createOrders() x1')
      })

      it('should set liquidity balance for the account', async function () {
        const liqBal = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account1.address)
        expect(liqBal.toString()).to.equal(MOCK_TOTAL_LIQUIDITY.toString())
      })

      it('should leave reward excess of tokenIn in the adapter', async function () {
        const tknBal = await this.tokenIn.balanceOf(this.rangeOrdersAdapter.address)
        expect(tknBal.toString()).to.equal(BN(5).mul(BN18).toString())
      })

      it('should transfer tokenIn to the UniswapV3RangeOrders contract', async function () {
        const tknBal = await this.tokenIn.balanceOf(this.rangeOrderPositionManager.address)
        expect(tknBal.toString()).to.equal(BN(70).mul(BN18).toString())
      })
    })
  })

  describe('createOrdersETH executePartialSignedDelegateCall', function () {
    beforeEach(async function () {
      this.tokenIn = this.weth
      this.positionHash = computePositionHash(
        this.tokenIn.address, this.tokenOut.address, this.feePool, this.tickLower, this.tickUpper
      )
      this.ethInAmount = BN(75).mul(BN17) // 7.5
      this.ethInAmountAfterReward = BN(70).mul(BN17) // 7.0
      await this.ethStoreAccount.sendTransaction({
        to: this.account1.address,
        value: this.ethInAmount
      })

      const adapterCallData = this.rangeOrdersAdapter.interface.encodeFunctionData(
        'sendRangeOrderBatchETH',
        [[
          [this.account1.address], // owners
          [this.ethInAmountAfterReward], // inputAmounts
          this.ethInAmountAfterReward, // total input
          this.tokenIn.address,
          this.tokenOut.address,
          this.feePool,
          this.tickLower,
          this.tickUpper
        ]]
      )

      const delegatedCallData = this.rangeOrdersVerifier.interface.encodeFunctionData(
        'createRangeOrderETH',
        [
          this.rangeOrderPositionManager.address,
          this.positionHash,
          this.ethInAmount,
          MOCK_TOTAL_LIQUIDITY,
          this.expiryBlock,
          this.rangeOrdersAdapter.address, // transferTo
          this.rangeOrdersAdapter.address, // executeTo ... same because there's 1 in the batch
          adapterCallData
        ]
      ).slice(2)

      const signedData = `0x${delegatedCallData.slice(0, SIGNED_DATA_LENGTH_ETH_CALL)}`

      // unsigned data is the rest
      const unsignedData = `0x${delegatedCallData.slice(SIGNED_DATA_LENGTH_ETH_CALL)}`

      // get the callData to the account, which will be sent directly in the tx
      const accountCallData = await partialSignedDelegatedCallData({
        account: this.account1,
        signer: this.owner1,
        bitmapIndex: this.nextBitmapIndex,
        bit: this.nextBit,
        params: [
          this.rangeOrdersVerifier.address,
          signedData
        ],
        unsignedParams: [unsignedData]
      })

      const tx = await this.owner1.sendTransaction({
        to: this.account1.address,
        data: accountCallData
      })
      
      // await logTxGas(tx, 'createOrders() x1')
    })

    it('should set liquidity balance for the account', async function () {
      const liqBal = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account1.address)
      expect(liqBal.toString()).to.equal(MOCK_TOTAL_LIQUIDITY.toString())
    })

    it('should leave reward excess of ETH in the adapter', async function () {
      const ethBal = await ethers.provider.getBalance(this.rangeOrdersAdapter.address)
      expect(ethBal.toString()).to.equal(BN(5).mul(BN17).toString())
    })

    it('should transfer WETH to the RangeOrderPositionManager contract', async function () {
      const wethBal = await this.weth.balanceOf(this.rangeOrderPositionManager.address)
      expect(wethBal.toString()).to.equal(BN(70).mul(BN17).toString())
    })
  })

  // TODO: this chained batching is working, but one flaw with this approach is that
  // the incremental cost goes up exponentially with each chained call, since each call added
  // to the batch chain contains all of the data of all of the previous calls. There's definitely
  // a better way to do this. probably need some proxy contract that can parse out call data.
  // could construct the call as 10 individual account calls with a call to the proxy contract after
  // each. the proxy contract call would just have a pointer to the location of data for the next
  // account call
  describe('when batch has multiple orders', function () {
    beforeEach(async function () {
      this.positionHash = computePositionHash(
        this.tokenIn.address, this.tokenOut.address, this.feePool, this.tickLower, this.tickUpper
      )

      this.tokenInAmount_account1 = BN(100).mul(BN18)
      this.tokenInAmount_account2 = BN(100).mul(BN18)
      this.tokenInAmount_account3 = BN(100).mul(BN18)
      this.tokenInAmount_account4 = BN(100).mul(BN18)
      this.tokenInAmount_account5 = BN(100).mul(BN18)
      this.tokenInAmount_account6 = BN(100).mul(BN18)
      this.tokenInAmount_account7 = BN(100).mul(BN18)
      this.tokenInAmount_account8 = BN(100).mul(BN18)
      this.tokenInAmount_account9 = BN(100).mul(BN18)
      this.tokenInAmount_account10 = BN(100).mul(BN18)
      this.tokenInAmountTotal = BN(1000).mul(BN18)
      await this.tokenIn.mint(this.account1.address, this.tokenInAmount_account1)
      await this.tokenIn.mint(this.account2.address, this.tokenInAmount_account2)
      await this.tokenIn.mint(this.account3.address, this.tokenInAmount_account3)
      await this.tokenIn.mint(this.account4.address, this.tokenInAmount_account4)
      await this.tokenIn.mint(this.account5.address, this.tokenInAmount_account5)
      await this.tokenIn.mint(this.account6.address, this.tokenInAmount_account6)
      await this.tokenIn.mint(this.account7.address, this.tokenInAmount_account7)
      await this.tokenIn.mint(this.account8.address, this.tokenInAmount_account8)
      await this.tokenIn.mint(this.account9.address, this.tokenInAmount_account9)
      await this.tokenIn.mint(this.account10.address, this.tokenInAmount_account10)

      this.liquidityOutAmount_account1 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account2 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account3 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account4 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account5 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account6 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account7 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account8 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account9 = MOCK_TOTAL_LIQUIDITY/10
      this.liquidityOutAmount_account10 = MOCK_TOTAL_LIQUIDITY/10

      const adapterCallData = this.rangeOrdersAdapter.interface.encodeFunctionData(
        'sendRangeOrderBatch',
        [[
          [this.account1.address, this.account2.address, this.account3.address, this.account4.address, this.account5.address, this.account6.address, this.account7.address, this.account8.address, this.account9.address, this.account10.address], // owners
          [this.tokenInAmount_account1, this.tokenInAmount_account2, this.tokenInAmount_account3, this.tokenInAmount_account4, this.tokenInAmount_account5, this.tokenInAmount_account6, this.tokenInAmount_account7, this.tokenInAmount_account8, this.tokenInAmount_account9, this.tokenInAmount_account10], // inputAmounts
          this.tokenInAmountTotal, // total input
          this.tokenIn.address,
          this.tokenOut.address,
          this.feePool,
          this.tickLower,
          this.tickUpper
        ]]
      )

      // create a chained call for batched execution. Each account's unsigned calldata contains
      // the next account call. built backwards from account10 to account1

      const account10_callData = await this.createRangeOrderAccountCallData({
        account: this.account10,
        owner: this.owner10,
        tokenInAmount: this.tokenInAmount_account10,
        liquidityOutAmount: this.liquidityOutAmount_account10,
        executeTo: this.rangeOrdersAdapter.address,
        executeData: adapterCallData
      })
      const account9_callData = await this.createRangeOrderAccountCallData({
        account: this.account9,
        owner: this.owner9,
        tokenInAmount: this.tokenInAmount_account9,
        liquidityOutAmount: this.liquidityOutAmount_account9,
        executeTo: this.account10.address,
        executeData: account10_callData
      })
      const account8_callData = await this.createRangeOrderAccountCallData({
        account: this.account8,
        owner: this.owner8,
        tokenInAmount: this.tokenInAmount_account8,
        liquidityOutAmount: this.liquidityOutAmount_account8,
        executeTo: this.account9.address,
        executeData: account9_callData
      })
      const account7_callData = await this.createRangeOrderAccountCallData({
        account: this.account7,
        owner: this.owner7,
        tokenInAmount: this.tokenInAmount_account7,
        liquidityOutAmount: this.liquidityOutAmount_account7,
        executeTo: this.account8.address,
        executeData: account8_callData
      })
      const account6_callData = await this.createRangeOrderAccountCallData({
        account: this.account6,
        owner: this.owner6,
        tokenInAmount: this.tokenInAmount_account6,
        liquidityOutAmount: this.liquidityOutAmount_account6,
        executeTo: this.account7.address,
        executeData: account7_callData
      })
      const account5_callData = await this.createRangeOrderAccountCallData({
        account: this.account5,
        owner: this.owner5,
        tokenInAmount: this.tokenInAmount_account5,
        liquidityOutAmount: this.liquidityOutAmount_account5,
        executeTo: this.account6.address,
        executeData: account6_callData
      })
      const account4_callData = await this.createRangeOrderAccountCallData({
        account: this.account4,
        owner: this.owner4,
        tokenInAmount: this.tokenInAmount_account4,
        liquidityOutAmount: this.liquidityOutAmount_account4,
        executeTo: this.account5.address,
        executeData: account5_callData
      })
      const account3_callData = await this.createRangeOrderAccountCallData({
        account: this.account3,
        owner: this.owner3,
        tokenInAmount: this.tokenInAmount_account3,
        liquidityOutAmount: this.liquidityOutAmount_account3,
        executeTo: this.account4.address,
        executeData: account4_callData
      })
      const account2_callData = await this.createRangeOrderAccountCallData({
        account: this.account2,
        owner: this.owner2,
        tokenInAmount: this.tokenInAmount_account2,
        liquidityOutAmount: this.liquidityOutAmount_account2,
        executeTo: this.account3.address,
        executeData: account3_callData
      })
      const account1_callData = await this.createRangeOrderAccountCallData({
        account: this.account1,
        owner: this.owner1,
        tokenInAmount: this.tokenInAmount_account1,
        liquidityOutAmount: this.liquidityOutAmount_account1,
        executeTo: this.account2.address,
        executeData: account2_callData
      })

      const tx = await this.owner1.sendTransaction({
        to: this.account1.address,
        data: account1_callData
      })
      
      // await logTxGas(tx, 'createOrders() x10')
    })

    it('should set liquidity balance for each account', async function () {
      const expectedLiqBal = (MOCK_TOTAL_LIQUIDITY/10).toString()
      const liqBal1 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account1.address)
      const liqBal2 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account2.address)
      const liqBal3 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account3.address)
      const liqBal4 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account4.address)
      const liqBal5 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account5.address)
      const liqBal6 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account6.address)
      const liqBal7 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account7.address)
      const liqBal8 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account8.address)
      const liqBal9 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account9.address)
      const liqBal10 = await this.rangeOrderPositionManager.liquidityBalances(this.positionHash, 0, this.account10.address)
      expect(liqBal1.toString()).to.equal(expectedLiqBal)
      expect(liqBal2.toString()).to.equal(expectedLiqBal)
      expect(liqBal3.toString()).to.equal(expectedLiqBal)
      expect(liqBal4.toString()).to.equal(expectedLiqBal)
      expect(liqBal5.toString()).to.equal(expectedLiqBal)
      expect(liqBal6.toString()).to.equal(expectedLiqBal)
      expect(liqBal7.toString()).to.equal(expectedLiqBal)
      expect(liqBal8.toString()).to.equal(expectedLiqBal)
      expect(liqBal9.toString()).to.equal(expectedLiqBal)
      expect(liqBal10.toString()).to.equal(expectedLiqBal)
    })

    it('should transfer tokenIn to the UniswapV3RangeOrders contract', async function () {
      const tknBal = await this.tokenIn.balanceOf(this.rangeOrderPositionManager.address)
      expect(tknBal.toString()).to.equal(BN(1000).mul(BN18).toString())
    })
  })
})

// get calldata for executePartialSignedDelegateCall() to UniswapV3RangeOrdersVerifier.createRangeOrder()
// Since it's a test fn, it signs the signed part of the call, and constructs the unsigned part as well,
// then the returned callData can be used in a meta tx sent to the account contract owned by the signer
async function createRangeOrderAccountCallData({
  account,
  owner,
  tokenInAmount,
  liquidityOutAmount,
  executeTo,
  executeData
}) {
  const positionHash = computePositionHash(
    this.tokenIn.address, this.tokenOut.address, this.feePool, this.tickLower, this.tickUpper
  )
  const delegatedCallData = this.rangeOrdersVerifier.interface.encodeFunctionData(
    'createRangeOrder',
    [
      this.rangeOrderPositionManager.address,
      positionHash,
      this.tokenIn.address,
      tokenInAmount,
      liquidityOutAmount,
      this.expiryBlock,
      this.rangeOrdersAdapter.address, // transferTo
      executeTo,
      executeData
    ]
  ).slice(2)
  const signedData = `0x${delegatedCallData.slice(0, SIGNED_DATA_LENGTH)}`
  const unsignedData = `0x${delegatedCallData.slice(SIGNED_DATA_LENGTH)}`
  const callData = await partialSignedDelegatedCallData({
    account,
    signer: owner,
    bitmapIndex: this.nextBitmapIndex,
    bit: this.nextBit,
    params: [
      this.rangeOrdersVerifier.address,
      signedData
    ],
    unsignedParams: [unsignedData]
  })
  return callData
}

async function partialSignedDelegatedCallData ({
  account,
  bitmapIndex,
  bit,
  signer,
  params,
  unsignedParams
}) {
  const signedData = await signMetaTx({
    contract: account,
    method: 'executePartialSignedDelegateCall',
    bitmapIndex,
    bit,
    signer,
    paramTypes: [
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' }
    ],
    params
  })
  const callData = account.interface.encodeFunctionData(
    'executePartialSignedDelegateCall',
    [
      signedData.bitmapIndex,
      signedData.bit,
      ...signedData.params,
      signedData.signature,
      ...unsignedParams
    ]
  )
  return callData
}

function computePositionHash (tokenInAddress, tokenOutAddress, feePool, tickLower, tickUpper) {
  return soliditySha3(abiCoder.encode(
    ['address', 'address', 'uint24', 'int24', 'int24'],
    [tokenInAddress, tokenOutAddress, feePool, tickLower, tickUpper]
  ))
}

async function logTxGas (tx, msg) {
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
  console.log(`${msg}: gasUsed: `, receipt.gasUsed.toString())
}
