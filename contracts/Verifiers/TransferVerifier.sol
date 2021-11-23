// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.10;
pragma abicoder v1;

import "../Libraries/Bit.sol";
import "../Libraries/TransferHelper.sol";

/// @title Verifier for ETH and ERC20 transfers
/// @notice These functions should be executed by metaDelegateCall() on Brink account proxy contracts
contract TransferVerifier {
  /// @dev Revert when transfer is expired
  error Expired();

  /// @dev Executes an ETH transfer with replay protection and expiry
  /// @notice This should be executed by metaDelegateCall() with the following signed params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot
  /// @param bit The value of the replay bit
  /// @param recipient The recipient of the transfer
  /// @param amount Amount of token to transfer
  /// @param expiryBlock The block when the transfer expires
  function ethTransfer(
    uint256 bitmapIndex, uint256 bit, address recipient, uint256 amount, uint256 expiryBlock
  )
    external
  {
    if (expiryBlock <= block.number) {
      revert Expired();
    }
    Bit.useBit(bitmapIndex, bit);
    TransferHelper.safeTransferETH(recipient, amount);
  }

  /// @dev Executes an ERC20 token transfer with replay protection and expiry
  /// @notice This should be executed by metaDelegateCall() with the following signed params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot
  /// @param bit The value of the replay bit
  /// @param token The token to transfer
  /// @param recipient The recipient of the transfer
  /// @param amount Amount of token to transfer
  /// @param expiryBlock The block when the transfer expires
  function tokenTransfer(
    uint256 bitmapIndex, uint256 bit, address token, address recipient, uint256 amount, uint256 expiryBlock
  )
    external
  {
    if (expiryBlock <= block.number) {
      revert Expired();
    }
    Bit.useBit(bitmapIndex, bit);
    TransferHelper.safeTransfer(token, recipient, amount);
  }
}
