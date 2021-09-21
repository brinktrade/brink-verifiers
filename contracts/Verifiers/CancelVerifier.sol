// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import "../Libraries/Bit.sol";

/// @title Verifier for cancel of messages signed with a bitmapIndex and bit
/// @notice Uses the Bit library to use the bit, which invalidates messages signed with the same bit
contract CancelVerifier {
  event Cancelled (uint256 bitmapIndex, uint256 bit);

  /// @dev Cancels existing messages signed with bitmapIndex and bit
  /// @param bitmapIndex The bitmap index to use
  /// @param bit The bit to use
  function cancel(uint256 bitmapIndex, uint256 bit) external {
    Bit.useBit(bitmapIndex, bit);
    emit Cancelled(bitmapIndex, bit);
  }
}
