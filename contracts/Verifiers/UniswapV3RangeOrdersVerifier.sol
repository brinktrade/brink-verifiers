// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import "@brinkninja/range-orders/contracts/interfaces/IRangeOrderPositionManager.sol";
import "@brinkninja/core/contracts/Proxy/ProxyGettable.sol";
import "../External/CallExecutor.sol";
import '../Libraries/TransferHelper.sol';

/**
 * @dev Contains verifier functions for relayed interactions with the RangeOrderPositionManager contract
 */
contract UniswapV3RangeOrdersVerifier {

  CallExecutor internal immutable CALL_EXECUTOR;

  constructor(CallExecutor callExecutor) {
    CALL_EXECUTOR = callExecutor;
  }

  function createRangeOrder(
    IRangeOrderPositionManager rangeOrderPositionManager, bytes32 positionHash, address tokenIn, uint256 tokenInAmount, uint128 liquidityOutAmount, uint256 expiryBlock, address transferTo, address executeTo, bytes memory data
  )
    public
  {
    require(expiryBlock > block.number, "UniswapV3RangeOrdersVerifier: createRangeOrder() expiryBlock exceeded");

    // store initial liquidityBalance
    uint256 positionIndex = rangeOrderPositionManager.positionIndexes(positionHash);
    uint128 liquidityBalance = rangeOrderPositionManager.liquidityBalances(positionHash, positionIndex, address(this));

    // send token to the transferTo address
    TransferHelper.safeTransfer(tokenIn, transferTo, tokenInAmount);

    // execute call data on the CallExecutor contract
    CALL_EXECUTOR.proxyCall(executeTo, data);

    // calculate amount of liquidity added for this contract
    uint128 liquidityOutReceived = rangeOrderPositionManager.liquidityBalances(positionHash, positionIndex, address(this)) - liquidityBalance;

    // verify that enough liquidity was received
    require(liquidityOutReceived >= liquidityOutAmount, "UniswapV3RangeOrdersVerifier: liquidity received is less than allowed");
  }

  function createRangeOrderETH(
    IRangeOrderPositionManager rangeOrderPositionManager, bytes32 positionHash, uint256 ethInAmount, uint128 liquidityOutAmount, uint256 expiryBlock, address transferTo, address executeTo, bytes memory data
  )
    public
  {
    require(expiryBlock > block.number, "UniswapV3RangeOrdersVerifier: createRangeOrder() expiryBlock exceeded");

    // store initial liquidityBalance
    uint256 positionIndex = rangeOrderPositionManager.positionIndexes(positionHash);
    uint128 liquidityBalance = rangeOrderPositionManager.liquidityBalances(positionHash, positionIndex, address(this));

    // send ETH to the transferTo address
    TransferHelper.safeTransferETH(transferTo, ethInAmount);

    // execute call data on the CallExecutor contract
    CALL_EXECUTOR.proxyCall(executeTo, data);

    // calculate amount of liquidity added for this contract
    uint128 liquidityOutReceived = rangeOrderPositionManager.liquidityBalances(positionHash, positionIndex, address(this)) - liquidityBalance;

    // verify that enough liquidity was received
    require(liquidityOutReceived >= liquidityOutAmount, "UniswapV3RangeOrdersVerifier: liquidity received is less than allowed");
  }

}
