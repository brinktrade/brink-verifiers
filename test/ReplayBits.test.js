const { ethers } = require('hardhat')
const {
  chaiSolidity,
  bnToBinaryString,
  BN
} = require('@brinkninja/test-helpers')
const { expect } = chaiSolidity()

describe.only('ReplayBits', function () {
  beforeEach(async function () {
    const ReplayBitsTest = await ethers.getContractFactory('ReplayBitsTest')
    this.replayBits = await ReplayBitsTest.deploy()
  })

  describe('useBit()', function () {
    it('valid calls on slot0 should set bits', async function () {
      await this.replayBits.useBit(BN(0), BN(4)) // slot 0, index 2 : 2**2 = 4
      await this.replayBits.useBit(BN(0), BN(1)) // slot 0, index 0 : 2**0 = 1
      const bitmap = await this.replayBits.loadBitmap(0)
      expect(bnToBinaryString(bitmap)).to.equal('101')
    })

    it('valid calls on slot1 should set bits', async function () {
      await this.replayBits.useBit(BN(1), BN(4)) // slot 1, index 2 : 2**2 = 4
      await this.replayBits.useBit(BN(1), BN(1)) // slot 1, index 0 : 2**0 = 1
      const bitmap = await this.replayBits.loadBitmap(1)
      expect(bnToBinaryString(bitmap)).to.equal('101')
    })

    it('when bit is zero, should revert with INVALID_BIT', async function() {
      await expect(this.replayBits.useBit(BN(0), BN(0))).to.be.revertedWith('INVALID_BIT')
    })

    it('when bit is not a single bit, should revert with INVALID_BIT', async function () {
      await expect(this.replayBits.useBit(BN(0), BN(3))).to.be.revertedWith('INVALID_BIT')
    })

    it('when bit is used, should revert with BIT_USED', async function () {
      await this.replayBits.useBit(BN(1), BN(4)) // slot 1, index 2 : 2**2 = 4
      await expect(this.replayBits.useBit(BN(1), BN(4))).to.be.revertedWith('BIT_USED')
    })
  })

  describe('bitUsed()', function () {
    it('valid call to used bit on slot0 should return true', async function () {
      await this.replayBits.useBit(BN(0), BN(4))
      await this.replayBits.useBit(BN(0), BN(1))
      expect(await this.replayBits.bitUsed(BN(0), BN(4))).to.equal(true)
      expect(await this.replayBits.bitUsed(BN(0), BN(1))).to.equal(true)
    })

    it('valid call to unused bit on slot0 should return false', async function () {
      expect(await this.replayBits.bitUsed(BN(0), BN(4))).to.equal(false)
      expect(await this.replayBits.bitUsed(BN(0), BN(1))).to.equal(false)
    })

    it('valid call to used bit on slot1 should return true', async function () {
      await this.replayBits.useBit(BN(1), BN(4))
      await this.replayBits.useBit(BN(1), BN(1))
      expect(await this.replayBits.bitUsed(BN(1), BN(4))).to.equal(true)
      expect(await this.replayBits.bitUsed(BN(1), BN(1))).to.equal(true)
    })

    it('valid call to unused bit on slot1 should return false', async function () {
      expect(await this.replayBits.bitUsed(BN(1), BN(4))).to.equal(false)
      expect(await this.replayBits.bitUsed(BN(1), BN(1))).to.equal(false)
    })

    it('when bit is zero, should revert with INVALID_BIT', async function() {
      await expect(this.replayBits.bitUsed(BN(0), BN(0))).to.be.revertedWith('INVALID_BIT')
    })

    it('when bit is not a single bit, should revert with INVALID_BIT', async function () {
      await expect(this.replayBits.bitUsed(BN(0), BN(3))).to.be.revertedWith('INVALID_BIT')
    })
  })
})
