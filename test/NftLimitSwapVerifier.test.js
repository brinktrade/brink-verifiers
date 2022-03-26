const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { BN18 } = brinkUtils.constants
const { execMetaTx } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')

const NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'nftOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'nftOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'nftIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'nftInID', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const NFT_LIMIT_SWAP_NFT_TO_NFT_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'nftIn', type: 'address' },
  { name: 'nftOut', type: 'address' },
  { name: 'nftInID', type: 'uint256' },
  { name: 'nftOutID', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

describe.only('NftLimitSwapVerifier', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const CallExecutor = await ethers.getContractFactory('CallExecutor')
    const NftLimitSwapVerifier = await ethers.getContractFactory('NftLimitSwapVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    const bamfs = await TestERC721.deploy('bamfs', 'BAMFS')
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    const callExecutor = await CallExecutor.deploy()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.nftLimitSwapVerifier = await NftLimitSwapVerifier.deploy(callExecutor.address)
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    
    const [ defaultAccount, , proxyOwner_1, proxyOwner_2, proxyOwner_3 ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.proxyOwner_1 = proxyOwner_1
    this.proxyOwner_2 = proxyOwner_2
    this.proxyOwner_3 = proxyOwner_3
    this.tokenA = tokenA
    this.cryptoSkunks = cryptoSkunks
    this.bamfs = bamfs

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
          this.nftLimitSwapVerifier.address,
          signedData
        ],
        unsignedData
      })
    }

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('tokenToNft()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.cryptoSkunkID = 123
      await this.tokenA.mint(this.proxyAccount.address, this.tokenASwapAmount)
      await this.cryptoSkunks.mint(this.testFulfillSwap.address, this.cryptoSkunkID)

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.cryptoSkunks.address,
        this.tokenASwapAmount.toString(),
        1
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'tokenToNft',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughTokenCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            // fail when trying to transfer less than the signed call requires
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.cryptoSkunks.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.cryptoSkunkID,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.testFulfillSwap.address)
    })

    it.only('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(BN(0))
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyAccount.address)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })
  })
})