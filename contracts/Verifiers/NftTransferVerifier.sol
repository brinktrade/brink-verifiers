// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.10;
pragma abicoder v1;

import "../Libraries/Bit.sol";
import "../Libraries/TransferHelper.sol";

/// @title Verifier for ERC721 transfers
/// @notice These functions should be executed by metaDelegateCall() on Brink account proxy contracts
contract NftTransferVerifier {
  /// @dev Revert when transfer is expired
  error Expired();

  /// @dev Executes an ERC721 token transfer with replay protection and expiry
  /// @notice This should be executed by metaDelegateCall() with the following signed params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot
  /// @param bit The value of the replay bit
  /// @param token The token to transfer
  /// @param from The sender of the transfer
  /// @param to The recipient of the transfer
  /// @param tokenId ID of the NFT to transfer
  /// @param expiryBlock The block when the transfer expires
  function nftTransfer(
    uint256 bitmapIndex, uint256 bit, address token, address from, address to, uint256 tokenId, uint256 expiryBlock
  )
    external
  {
    if (expiryBlock <= block.number) {
      revert Expired();
    }
    Bit.useBit(bitmapIndex, bit);
    TransferHelper.safeTransferFrom(token, from, to, tokenId);
  }
}
