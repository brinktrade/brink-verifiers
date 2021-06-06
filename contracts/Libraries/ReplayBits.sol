// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

/// @title Bit replay protection library
/// @notice Handles storage and loads for replay protection bits
/// @dev Solution adapted from https://github.com/PISAresearch/metamask-comp/blob/77fa8295c168ee0b6bf801cbedab797d6f8cfd5d/src/contracts/BitFlipMetaTransaction/README.md
/// @dev This is a gas optimized technique that stores up to 256 replay protection bits per bytes32 slot
library ReplayBits {
  /// @dev Returns a boolean indicating if the given bit is "flipped"
  /// @dev Value of bit cannot be zero and must represent a single bit
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @param bit The value of the bit within the uint256 bitmap
  /// @return used Whether the bitmapIndex and bit has been used
  function bitUsed(uint256 bitmapIndex, uint256 bit) internal view returns (bool used) {
    require(validBit(bit), "INVALID_BIT");
    used = loadUint(bitmapPtr(bitmapIndex)) & bit != 0;
  }

  /// @dev Returns a uint256 bitmap
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @return bitmap The uint256 bitmap at bitmapIndex
  function loadBitmap (uint256 bitmapIndex) internal view returns (uint256 bitmap) {
    bitmap = loadUint(bitmapPtr(bitmapIndex));
  }

  /// @dev Adds a bit to the uint256 bitmap at bitmapIndex
  /// @dev Value of bit cannot be zero and must represent a single bit
  /// @param bitmapIndex The index of the uint256 bitmap
  /// @param bit The value of the bit within the uint256 bitmap
  function useBit(uint256 bitmapIndex, uint256 bit) internal {
    require(validBit(bit), "INVALID_BIT");
    bytes32 ptr = bitmapPtr(bitmapIndex);
    uint256 updatedBitmap = loadUint(ptr) | bit;
    assembly { sstore(ptr, updatedBitmap) }
  }

  /// @dev Check that a bit is valid
  /// @return True if bit is greater than zero and represents a single bit
  function validBit(uint256 bit) internal pure returns (bool) {
    return bit > 0 && bit & bit-1 == 0;
  }

  /// @dev Get a bitmap storage pointer
  /// @return The bytes32 pointer to the storage location of the uint256 bitmap at bitmapIndex
  function bitmapPtr (uint256 bitmapIndex) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("bmp", bitmapIndex));
  }

  /// @dev Returns the uint256 value at storage location ptr
  /// @param ptr The storage location pointer
  /// @return val The uint256 value at storage location ptr
  function loadUint(bytes32 ptr) internal view returns (uint256 val) {
    assembly { val := sload(ptr) }
  }
}
