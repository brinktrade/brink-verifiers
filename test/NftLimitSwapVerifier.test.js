const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { BN18, ZERO_ADDRESS } = brinkUtils.constants
const { execMetaTx, randomAddress } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')

const NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'nftOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
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
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

describe('NftLimitSwapVerifier', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const NftLimitSwapVerifier = await ethers.getContractFactory('NftLimitSwapVerifier')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    const bamfs = await TestERC721.deploy('bamfs', 'BAMFS')
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.nftLimitSwapVerifier = await NftLimitSwapVerifier.deploy()
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
      await this.defaultAccount.sendTransaction({
        to: this.proxyAccount.address,
        value: this.tokenASwapAmount
      })

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(2),
        this.tokenA.address,
        this.cryptoSkunks.address,
        this.tokenASwapAmount.toString()
      ]

      const ethInSwapParams = [
        BN(0), BN(2),
        ZERO_ADDRESS,
        this.cryptoSkunks.address,
        this.tokenASwapAmount.toString()
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

      this.ethInSuccessCall = proxyAccount => splitCallData(encodeFunctionCall(
        'tokenToNft',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...ethInSwapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.nftNotReceivedCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.tokenA.address,
          this.cryptoSkunks.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.insufficientEthBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        NFT_LIMIT_SWAP_TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          ZERO_ADDRESS,
          this.cryptoSkunks.address,
          this.tokenASwapAmount.mul(2).toString(),
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
        'tokenToNft',
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
      expect(await ethers.provider.getBalance(this.proxyAccount.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.testFulfillSwap.address)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(BN(0))
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyAccount.address)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when input token is ETH and call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.ethInSuccessCall(this.proxyAccount))
      expect(await ethers.provider.getBalance(this.proxyAccount.address)).to.equal(BN(0))
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyAccount.address)
      expect(await ethers.provider.getBalance(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when required NFT is not received by the account', async function () {
      await expect(this.metaDelegateCall(this.nftNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient ERC20 balance', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when account has insufficient ETH balance', async function () {
      await expect(this.metaDelegateCall(this.insufficientEthBalanceCall)).to.be.reverted
    })

    it('when swap is expired', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
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

  describe('nftToToken()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.cryptoSkunkID = 123
      await this.cryptoSkunks.mint(this.proxyAccount.address, this.cryptoSkunkID)
      await this.cryptoSkunks.mint((await randomAddress()).address, this.cryptoSkunkID + 1)
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.tokenASwapAmount
      })

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(2),
        this.cryptoSkunks.address,
        this.tokenA.address,
        this.cryptoSkunkID,
        this.tokenASwapAmount.toString()
      ]

      const ethOutSwapParams = [
        BN(0), BN(2),
        this.cryptoSkunks.address,
        ZERO_ADDRESS,
        this.cryptoSkunkID,
        this.tokenASwapAmount.toString()
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
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

      this.ethOutSuccessCall = proxyAccount => splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.tokenASwapAmount.toString(), proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.tokenNotReceivedCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.ethNotReceivedCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.cryptoSkunks.address,
          this.tokenA.address,
          this.cryptoSkunkID + 1,
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

      this.expiredCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_LIMIT_SWAP_NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
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

      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await ethers.provider.getBalance(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyAccount.address)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(await this.tokenA.balanceOf(this.proxyAccount.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.testFulfillSwap.address)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(1))
    })

    it('when output token is ETH and call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.ethOutSuccessCall(this.proxyAccount))
      expect(await ethers.provider.getBalance(this.proxyAccount.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.testFulfillSwap.address)
      expect(await ethers.provider.getBalance(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(1))
    })

    it('when required token is not received by the account', async function () {
      await expect(this.metaDelegateCall(this.tokenNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when required ETH is not received by the account', async function () {
      await expect(this.metaDelegateCall(this.ethNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient NFT balance', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC721: transfer caller is not owner nor approved')
    })

    it('when swap is expired', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      await expect(this.metaDelegateCall(this.successCall(this.proxyAccount))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_2)
      await this.cryptoSkunks.transferAny(this.proxyAccount.address, proxyAccount.address, this.cryptoSkunkID)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyAccount), account: proxyAccount, owner: this.proxyOwner_2
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('nftToNft()', function () {
    beforeEach(async function () {
      this.cryptoSkunkID = 123
      this.bamfID = 456
      await this.cryptoSkunks.mint(this.proxyAccount.address, this.cryptoSkunkID)
      await this.cryptoSkunks.mint((await randomAddress()).address, this.cryptoSkunkID + 1)
      await this.bamfs.mint(this.testFulfillSwap.address, this.bamfID)

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(2),
        this.cryptoSkunks.address,
        this.bamfs.address,
        this.cryptoSkunkID
      ]

      this.successCall = proxyAccount => splitCallData(encodeFunctionCall(
        'nftToNft',
        NFT_LIMIT_SWAP_NFT_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.bamfs.address, this.bamfID, proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.nftNotReceivedCall = splitCallData(encodeFunctionCall(
        'nftToNft',
        NFT_LIMIT_SWAP_NFT_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'nftToNft',
        NFT_LIMIT_SWAP_NFT_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.cryptoSkunks.address,
          this.bamfs.address,
          this.cryptoSkunkID + 1,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.bamfs.address, this.bamfID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'nftToNft',
        NFT_LIMIT_SWAP_NFT_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.bamfs.address, this.bamfID, this.proxyAccount.address ]
          )
        ]
      ), numSignedParams)

      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyAccount.address)
      expect(await this.bamfs.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.bamfs.balanceOf(this.testFulfillSwap.address)).to.equal(1)
      expect(await this.bamfs.ownerOf(this.bamfID)).to.equal(this.testFulfillSwap.address)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.testFulfillSwap.address)
      expect(await this.bamfs.balanceOf(this.proxyAccount.address)).to.equal(1)
      expect(await this.bamfs.ownerOf(this.bamfID)).to.equal(this.proxyAccount.address)
    })

    it('when required nft amount is not received by the account', async function () {
      await expect(this.metaDelegateCall(this.nftNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient NFT balance', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC721: transfer caller is not owner nor approved')
    })

    it('when swap is expired', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyAccount))
      await expect(this.metaDelegateCall(this.successCall(this.proxyAccount))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_3)
      await this.cryptoSkunks.transferAny(this.proxyAccount.address, proxyAccount.address, this.cryptoSkunkID)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyAccount), account: proxyAccount, owner: this.proxyOwner_3
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
