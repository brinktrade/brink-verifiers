// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "../Libraries/Bit.sol";

contract BitTest {

  function loadBitmap (uint256 bitmapIndex) external view returns (uint256) {
    bytes32 ptr = Bit.bitmapPtr(bitmapIndex);
    uint256 bitmap = Bit.loadUint(ptr);
    return bitmap;
  }

  function useBit(uint256 bitmapIndex, uint256 bit) external {
    Bit.useBit(bitmapIndex, bit);
  }
}
