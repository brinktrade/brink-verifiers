// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/// @author Brink
/// @title Cancel Verifier for direct transactions
contract CancelVerifier {

  event Cancelled (uint256 bitmapIndex, uint256 bit);

  /// Cancel, which will flip the bit so that it cannot be used
  /// @param bitmapIndex the bitmap index
  /// @param bit the bit to flip 
  function cancel(uint256 bitmapIndex, uint256 bit) public {
    require(bit > 0, "CancelVerifier: bit cannot be zero");

    // n & (n-1) == 0, i.e. is it a power of two?
    // example: 4 = 100, 3 = 011. 4 & 3 = 000.
    require(bit & bit-1 == 0, "CancelVerifier: bit must be a single bit");

    // load the bitmap at `bitmapIndex` and verify that `bit` is not "flipped"
    uint256 bitmap;
    bytes32 replayProtectionPtr = _getReplayProtectionPtr(bitmapIndex);
    assembly {
      bitmap := sload(replayProtectionPtr)
    }

    require(bitmap & bit == 0, "CancelVerifier: bit is used");

    // add the flipped bit to the stored bitmap
    uint256 newBitmap = bitmap | bit;
    assembly {
      sstore(replayProtectionPtr, newBitmap)
    }

    emit Cancelled(bitmapIndex, bit);
  }

  /**
   * @dev Returns a storage pointer to the given `bitmapIndex`
   */
  function _getReplayProtectionPtr (uint256 bitmapIndex) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("replayProtectionBitmaps", bitmapIndex));
  }

}