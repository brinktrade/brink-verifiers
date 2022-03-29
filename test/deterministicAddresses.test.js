const { ethers } = require('hardhat')
const snapshot = require('snap-shot-it')
const { expect } = require('chai')
const deploySaltedBytecode = require('@brinkninja/core/test/helpers/deploySaltedBytecode')
const {
  CALL_EXECUTOR,
  LIMIT_SWAP_VERIFIER,
  NFT_LIMIT_SWAP_VERIFIER,
  CANCEL_VERIFIER,
  TRANSFER_VERIFIER,
} = require('../constants')


describe('CallExecutor.sol', function () {
  it('deterministic address check', async function () {
    const CallExecutor = await ethers.getContractFactory('CallExecutor')
    const address = await deploySaltedBytecode(CallExecutor.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and CALL_EXECUTOR constant are different').to.equal(CALL_EXECUTOR)
  })
})

describe('LimitSwapVerifier.sol', function () {
  it('deterministic address check', async function () {
    const LimitSwapVerifier = await ethers.getContractFactory('LimitSwapVerifier')
    const address = await deploySaltedBytecode(LimitSwapVerifier.bytecode, ['address'], [CALL_EXECUTOR])
    snapshot(address)
    expect(address, 'Deployed account address and LIMIT_SWAP_VERIFIER constant are different').to.equal(LIMIT_SWAP_VERIFIER)
  })
})

describe('NftLimitSwapVerifier.sol', function () {
  it('deterministic address check', async function () {
    const NftLimitSwapVerifier = await ethers.getContractFactory('NftLimitSwapVerifier')
    const address = await deploySaltedBytecode(NftLimitSwapVerifier.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and NFT_LIMIT_SWAP_VERIFIER constant are different').to.equal(NFT_LIMIT_SWAP_VERIFIER)
  })
})

describe('CancelVerifier.sol', function () {
  it('deterministic address check', async function () {
    const CancelVerifier = await ethers.getContractFactory('CancelVerifier')
    const address = await deploySaltedBytecode(CancelVerifier.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and CANCEL_VERIFIER constant are different').to.equal(CANCEL_VERIFIER)
  })
})

describe('TransferVerifier.sol', function () {
  it('deterministic address check', async function () {
    const TransferVerifier = await ethers.getContractFactory('TransferVerifier')
    const address = await deploySaltedBytecode(TransferVerifier.bytecode, [], [])
    snapshot(address)
    expect(address, 'Deployed account address and TRANSFER_VERIFIER constant are different').to.equal(TRANSFER_VERIFIER)
  })
})
