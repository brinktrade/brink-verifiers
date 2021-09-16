// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.7.6;

import "../Libraries/ReplayBits.sol";

contract ReplayBitsTest {
  function bitUsed(uint256 bitmapIndex, uint256 bit) external view returns (bool) {
    return ReplayBits.bitUsed(bitmapIndex, bit);
  }

  function loadBitmap (uint256 bitmapIndex) external view returns (uint256) {
    return ReplayBits.loadBitmap(bitmapIndex);
  }

  function useBit(uint256 bitmapIndex, uint256 bit) external {
    ReplayBits.useBit(bitmapIndex, bit);
  }
}
