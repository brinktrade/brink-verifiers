const fs = require('fs')
const constants = require('./constants')

const contracts = [
  ['./artifacts/contracts/External/CallExecutor.sol/CallExecutor.json', constants.CALL_EXECUTOR],
  ['./artifacts/contracts/Verifiers/CancelVerifier.sol/CancelVerifier.json', constants.CANCEL_VERIFIER],
  ['./artifacts/contracts/Verifiers/LimitSwapVerifier.sol/LimitSwapVerifier.json', constants.LIMIT_SWAP_VERIFIER],
  ['./artifacts/contracts/Verifiers/TransferVerifier.sol/TransferVerifier.json', constants.TRANSFER_VERIFIER],
  ['./artifacts/contracts/Verifiers/NftTransferVerifier.sol/NftTransferVerifier.json', constants.NFT_TRANSFER_VERIFIER]
]

function generateInterface () {
  let contractsJSON = {}
  for (let i in contracts) {
    const [path, address] = contracts[i]
    const { contractName, abi, bytecode, deployedBytecode } = require(path)
    contractsJSON[contractName] = { address, abi, bytecode, deployedBytecode }
  }
  console.log('Writing index.js file...')
  fs.writeFileSync('./index.js', `module.exports = ${JSON.stringify(contractsJSON, null, 2)}\n`)
  console.log('done')
  console.log()
}

generateInterface()
