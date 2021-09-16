// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "../Libraries/ReplayBits.sol";

contract ReplayBitsTest {
  function loadBitmap (uint256 bitmapIndex) external view returns (uint256) {
    bytes32 ptr = ReplayBits.bitmapPtr(bitmapIndex);
    uint256 bitmap = ReplayBits.loadUint(ptr);
    return bitmap;
  }

  function useBit(uint256 bitmapIndex, uint256 bit) external {
    ReplayBits.useBit(bitmapIndex, bit);
  }
}
