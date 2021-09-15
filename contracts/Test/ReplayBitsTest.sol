// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import "../Libraries/Bit.sol";

contract ReplayBitsTest {
  function bitUsed(uint256 bitmapIndex, uint256 bit) external view returns (bool) {
    return Bit.bitUsed(bitmapIndex, bit);
  }

  function loadBitmap (uint256 bitmapIndex) external view returns (uint256) {
    return Bit.loadBitmap(bitmapIndex);
  }

  function useBit(uint256 bitmapIndex, uint256 bit) external {
    Bit.useBit(bitmapIndex, bit);
  }
}
