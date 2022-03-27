const { deploySaltedContract } = require('@brinkninja/core/test/helpers')

async function deployCallExecutor () {
  const callExecutor = await deploySaltedContract('CallExecutor', [], [])
  return callExecutor
}

module.exports = deployCallExecutor
