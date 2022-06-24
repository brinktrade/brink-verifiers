const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount, getSigners } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall } = brinkUtils
const { BN18 } = brinkUtils.constants
const { execMetaTx } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')

const NFT_TRANSFER_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'token', type: 'address' },
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'tokenId', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' }
]

describe('NftTransferVerifier', function() {
  beforeEach(async function () {
    const NftTransferVerifier = await ethers.getContractFactory('NftTransferVerifier')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const { proxyAccount, proxyOwner } = await setupProxyAccount()
    this.cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    this.nftTransferVerifier = await NftTransferVerifier.deploy()
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    
    const [ defaultAccount, transferRecipient, , , , , , proxyOwner_6 ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.proxyOwner_6 = proxyOwner_6
    this.transferRecipient = transferRecipient

    const chainId = await defaultAccount.getChainId()

    this.signedDelegateCall = ({ signedData, account, owner }) => execMetaTx({
      contract: account || this.proxyAccount,
      method: 'metaDelegateCall',
      signer: owner || this.proxyOwner,
      chainId,
      params: [
        this.nftTransferVerifier.address,
        signedData
      ],
      unsignedData: '0x'
    })

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('nftTransfer()', function () {
    beforeEach(async function () {
      this.cryptoSkunksID = 123
      await this.cryptoSkunks.mint(this.proxyAccount.address, this.cryptoSkunksID)
      this.successCall = encodeFunctionCall(
        'nftTransfer',
        NFT_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.cryptoSkunks.address, this.proxyAccount.address, this.transferRecipient.address, this.cryptoSkunksID, this.expiryBlock]
      )

      this.expiredCall = encodeFunctionCall(
        'nftTransfer',
        NFT_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.cryptoSkunks.address, this.proxyAccount.address, this.transferRecipient.address, this.cryptoSkunksID, this.expiredBlock]
      )

      this.doesNotOwnCall = encodeFunctionCall(
        'nftTransfer',
        NFT_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.cryptoSkunks.address, this.proxyAccount.address, this.transferRecipient.address, this.cryptoSkunksID + 1, this.expiryBlock]
      )
    })

    it('valid signed call should transfer the token', async function () {
      await this.signedDelegateCall({ signedData: this.successCall })
      expect(await this.cryptoSkunks.balanceOf(this.proxyAccount.address)).to.equal(0)
      expect(await this.cryptoSkunks.balanceOf(this.transferRecipient.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunksID)).to.equal(this.transferRecipient.address)
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.signedDelegateCall({ signedData: this.expiredCall })).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.signedDelegateCall({ signedData: this.successCall })
      await expect(this.signedDelegateCall({ signedData: this.successCall })).to.be.revertedWith('BitUsed()')
    })

    it('when account does not own the token, should revert with TRANSFER_FROM_FAILED', async function () {
      await expect(this.signedDelegateCall({ signedData: this.doesNotOwnCall })).to.be.revertedWith('TRANSFER_FROM_FAILED')
    })

    it('gas cost', async function () {
      const { proxyAccount } = await setupProxyAccount(this.proxyOwner_6)
      await this.cryptoSkunks.mint(proxyAccount.address, 2345)
      const callData = encodeFunctionCall(
        'nftTransfer',
        NFT_TRANSFER_PARAM_TYPES.map(t => t.type),
        [BN(0), BN(1), this.cryptoSkunks.address, proxyAccount.address, this.transferRecipient.address, 2345, this.expiryBlock]
      )
      const { tx } = await this.signedDelegateCall({
        signedData: callData, account: proxyAccount, owner: this.proxyOwner_6
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})
