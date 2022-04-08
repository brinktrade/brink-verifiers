// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.10;
pragma abicoder v1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../Interfaces/ICallExecutor.sol";
import "../Libraries/Bit.sol";
import "../Libraries/NativeOrERC20.sol";

/// @title Verifier for ERC721 limit swaps
/// @notice These functions should be executed by metaPartialSignedDelegateCall() on Brink account proxy contracts
contract NftLimitSwapVerifier {
  using NativeOrERC20 for address;

  ICallExecutor constant CALL_EXECUTOR = ICallExecutor(0xDE61dfE5fbF3F4Df70B16D0618f69B96A2754bf8);

  /// @dev Verifies swap from fungible token (ERC20 or Native) to ERC721
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param tokenIn The input token provided for the swap. Can be ERC20 or Native [signed]
  /// @param nftOut The ERC721 output token required to be received from the swap [signed]
  /// @param tokenInAmount Amount of tokenIn provided [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function tokenToNft(
    uint256 bitmapIndex, uint256 bit, address tokenIn, IERC721 nftOut, uint256 tokenInAmount, uint256 expiryBlock, address to,
    bytes calldata data
  )
    external
  {
    require(expiryBlock > block.number, 'Expired');
  
    Bit.useBit(bitmapIndex, bit);

    uint256 nftOutBalance = nftOut.balanceOf(address(this));

    if (tokenIn.isEth()) {
      CALL_EXECUTOR.proxyCall{value: tokenInAmount}(to, data);
    } else {
      IERC20(tokenIn).transfer(to, tokenInAmount);
      CALL_EXECUTOR.proxyCall(to, data);
    }

    uint256 nftOutAmountReceived = nftOut.balanceOf(address(this)) - nftOutBalance;
    require(nftOutAmountReceived >= 1, 'NotEnoughReceived');
  }

  /// @dev Verifies swap from a single ERC721 ID to fungible token (ERC20 or Native)
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param nftIn The ERC721 input token provided for the swap [signed]
  /// @param tokenOut The output token required to be received from the swap. Can be ERC20 or Native [signed]
  /// @param nftInID The ID of the nftIn token provided [signed]
  /// @param tokenOutAmount Amount of tokenOut required to be received [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function nftToToken(
    uint256 bitmapIndex, uint256 bit, IERC721 nftIn, address tokenOut, uint256 nftInID, uint256 tokenOutAmount, uint256 expiryBlock,
    address to, bytes calldata data
  )
    external
  {
    require(expiryBlock > block.number, 'Expired');
  
    Bit.useBit(bitmapIndex, bit);

    uint256 tokenOutBalance = tokenOut.balanceOf(address(this));

    nftIn.transferFrom(address(this), to, nftInID);
    CALL_EXECUTOR.proxyCall(to, data);

    uint256 tokenOutAmountReceived = tokenOut.balanceOf(address(this)) - tokenOutBalance;
    require(tokenOutAmountReceived >= tokenOutAmount, 'NotEnoughReceived');
  }

  /// @dev Verifies swap from one ERC721 to another ERC721
  /// @notice This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params
  /// @param bitmapIndex The index of the replay bit's bytes32 slot [signed]
  /// @param bit The value of the replay bit [signed]
  /// @param nftIn The ERC721 input token provided for the swap [signed]
  /// @param nftOut The ERC721 output token required to be received from the swap [signed]
  /// @param nftInID The ID of the nftIn token provided [signed]
  /// @param expiryBlock The block when the swap expires [signed]
  /// @param to Address of the contract that will fulfill the swap [unsigned]
  /// @param data Data to execute on the `to` contract to fulfill the swap [unsigned]
  function nftToNft(
    uint256 bitmapIndex, uint256 bit, IERC721 nftIn, IERC721 nftOut, uint256 nftInID, uint256 expiryBlock, address to, bytes calldata data
  )
    external
  {
    require(expiryBlock > block.number, 'Expired');
  
    Bit.useBit(bitmapIndex, bit);

    uint256 nftOutBalance = nftOut.balanceOf(address(this));

    nftIn.transferFrom(address(this), to, nftInID);
    CALL_EXECUTOR.proxyCall(to, data);

    uint256 nftOutAmountReceived = nftOut.balanceOf(address(this)) - nftOutBalance;
    require(nftOutAmountReceived >= 1, 'NotEnoughReceived');
  }
}
