const { ethers } = require('hardhat')
const { expect } = require('chai')
const { BN, bnToBinaryString } = require('@brinkninja/utils')
const snapshotGas = require('./helpers/snapshotGas')

describe('Bit', function () {
  beforeEach(async function () {
    const BitTest = await ethers.getContractFactory('BitTest')
    this.bit = await BitTest.deploy()
  })

  describe('useBit()', function () {
    it('valid calls on slot0 should set bits', async function () {
      await this.bit.useBit(BN(0), BN(4)) // slot 0, index 2 : 2**2 = 4
      await this.bit.useBit(BN(0), BN(1)) // slot 0, index 0 : 2**0 = 1
      const bitmap = await this.bit.loadBitmap(0)
      expect(bnToBinaryString(bitmap)).to.equal('101')
    })

    it('valid calls on slot1 should set bits', async function () {
      await this.bit.useBit(BN(1), BN(4)) // slot 1, index 2 : 2**2 = 4
      await this.bit.useBit(BN(1), BN(1)) // slot 1, index 0 : 2**0 = 1
      const bitmap = await this.bit.loadBitmap(1)
      expect(bnToBinaryString(bitmap)).to.equal('101')
    })

    it('when bit is zero, should revert with InvalidBit()', async function() {
      await expect(this.bit.useBit(BN(0), BN(0))).to.be.revertedWith('InvalidBit()')
    })

    it('when bit is not a single bit, should revert with InvalidBit()', async function () {
      await expect(this.bit.useBit(BN(0), BN(3))).to.be.revertedWith('InvalidBit()')
    })

    it('when bit is used, should revert with BitUsed()', async function () {
      await this.bit.useBit(BN(1), BN(4)) // slot 1, index 2 : 2**2 = 4
      await expect(this.bit.useBit(BN(1), BN(4))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      await snapshotGas(this.bit.useBit(BN(1), BN(4)))
    })
  })
})
