// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/// @title Bit replay protection library
/// @notice Handles storage and loads for replay protection bits
/// @dev Solution adapted from https://github.com/PISAresearch/metamask-comp/blob/77fa8295c168ee0b6bf801cbedab797d6f8cfd5d/src/contracts/BitFlipMetaTransaction/README.md
library ReplayBits {
  /// @dev Returns a boolean indicating if the given bit is "flipped"
  /// @dev Value of bit cannot be zero and must represent a single bit
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @param bit The value of the bit within the uint256 bitmap
  /// @return used Whether the bitmapIndex and bit has been used
  function bitUsed(uint256 bitmapIndex, uint256 bit) internal view returns (bool used) {
    require(validBit(bit), "INVALID_BIT");
    used = loadBitmap(bitmapIndex) & bit != 0;
  }

  /// @dev Adds a bit to the uint256 bitmap at bitmapIndex
  /// @dev Value of bit cannot be zero and must represent a single bit
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @param bit The value of the bit within the uint256 bitmap
  function useBit(uint256 bitmapIndex, uint256 bit) internal {
    require(validBit(bit), "INVALID_BIT");
    uint256 updatedBitmap = loadBitmap(bitmapIndex) | bit;
    assembly {
      sstore(replayProtectionPtr, updatedBitmap)
    }
  }

  /// @dev Returns the bitmap at bitmapIndex
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @return bitmap The uint256 bitmap
  function loadBitmap(uint256 bitmapIndex) internal view returns (uint256 bitmap) {
    bytes32 ptr = keccak256(abi.encodePacked("bmp", bitmapIndex));
    assembly {
      bitmap := sload(ptr)
    }
  }

  /// @dev Check that a bit is valid
  /// @return True if bit is greater than zero and represents a single bit
  function validBit(uint256 bit) internal pure returns (bool) {
    return bit > 0 && bit & bit-1 == 0;
  }
}
