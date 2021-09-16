// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../External/CallExecutor.sol";
import "../Libraries/ReplayBits.sol";
import "../Libraries/TransferHelper.sol";

/// @title Verifier for ERC20 limit swaps
/// @notice These functions should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() on Brink account proxy contracts
contract LimitSwapVerifier {
  using SafeMath for uint256;

  CallExecutor internal immutable CALL_EXECUTOR;

  constructor(CallExecutor callExecutor) {
    CALL_EXECUTOR = callExecutor;
  }

  /// @dev Executes an ERC20 to ERC20 limit swap
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param tokenIn The input token provided for the swap [signed]
  /// @param tokenOut The output token required to be received from the swap [signed]
  /// @param tokenInAmount Amount of tokenIn provided [signed]
  /// @param tokenOutAmount Amount of tokenOut required to be received [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function tokenToToken(
    uint256 bitmapIndex, uint256 bit, IERC20 tokenIn, IERC20 tokenOut, uint256 tokenInAmount, uint256 tokenOutAmount,
    uint256 expiryBlock, address to, bytes memory data
  )
    external
  {
    require(expiryBlock > block.number, "EXPIRED");
  
    ReplayBits.useBit(bitmapIndex, bit);

    uint256 tokenOutBalance = tokenOut.balanceOf(address(this));

    TransferHelper.safeTransfer(address(tokenIn), to, tokenInAmount);
    CALL_EXECUTOR.proxyCall(to, data);

    require(tokenOut.balanceOf(address(this)).sub(tokenOutBalance) >= tokenOutAmount, "NOT_ENOUGH_RECEIVED");
  }

  /// @dev Executes an ETH to ERC20 limit swap
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param token The output token required to be received from the swap [signed]
  /// @param ethAmount Amount of ETH provided [signed]
  /// @param tokenAmount Amount of token required to be received [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function ethToToken(
    uint256 bitmapIndex, uint256 bit, IERC20 token, uint256 ethAmount, uint256 tokenAmount, uint256 expiryBlock,
    address to, bytes memory data
  )
    external
  {
    require(expiryBlock > block.number, "EXPIRED");

    ReplayBits.useBit(bitmapIndex, bit);

    uint256 tokenBalance = token.balanceOf(address(this));

    CALL_EXECUTOR.proxyPayableCall{value: ethAmount}(to, data);

    require(token.balanceOf(address(this)).sub(tokenBalance) >= tokenAmount, "NOT_ENOUGH_RECEIVED");
  }

  /// @dev Executes an ERC20 to ETH limit swap
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param token The input token provided for the swap [signed]
  /// @param tokenAmount Amount of tokenIn provided [signed]
  /// @param ethAmount Amount of ETH to receive [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function tokenToEth(
    uint256 bitmapIndex, uint256 bit, IERC20 token, uint256 tokenAmount, uint256 ethAmount, uint256 expiryBlock,
    address to, bytes memory data
  )
    external
  {
    require(expiryBlock > block.number, "EXPIRED");

    ReplayBits.useBit(bitmapIndex, bit);
    
    uint256 ethBalance = address(this).balance;

    TransferHelper.safeTransfer(address(token), to, tokenAmount);
    CALL_EXECUTOR.proxyCall(to, data);

    require(address(this).balance.sub(ethBalance) >= ethAmount, "NOT_ENOUGH_RECEIVED");
  }
}
