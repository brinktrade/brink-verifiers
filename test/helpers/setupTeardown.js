const deployCallExecutor = require('./deployCallExecutor')

before(async function () {
  await deployCallExecutor()
})
