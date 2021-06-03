// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@brinkninja/core/contracts/Proxy/ProxyGettable.sol";
import "@brinkninja/core/contracts/Called/CallExecutable.sol";

/**
 * @dev Contains functions for ERC20 limit swaps.
 *
 * This "Verifier" contract is deployed once. It can be called on a Proxy account
 * with a signed `executeDelegateCall` message (see AccountLogic.sol in brink-core). 
 * All functions are public, which is safe because this
 * contract is called directly, it has no way to access storage on Proxy (user account)
 * instances.
 */
contract LimitSwapVerifier is ProxyGettable {
  using SafeMath for uint256;

  /**
   * @dev Executes an ERC20 to ERC20 swap.
   *
   * Requirements:
   *
   * - `expiryBlock` must be greater than current block
   * - Amount of `tokenOut` received must be greater or equal to `tokenOutAmount`
   *
   * IMPORTANT: This function should be called from `executeDelegateCall`
   * (see AccountLogic.sol in brink-core). The first 5 parameters, `tokenIn`, `tokenOut`,
   * `tokenInAmount`, `tokenOutAmount`, and `expiryBlock`, should be included in the
   * signed message. The last 2 parameters, `to` and `data` are meant to be "unsigned".
   * This allows secure permissionless execution of the signed swap.
   */
  function tokenToToken(
    IERC20 tokenIn, IERC20 tokenOut, uint256 tokenInAmount, uint256 tokenOutAmount, uint256 expiryBlock,
    address to, bytes memory data
  )
    public
  {
    require(expiryBlock > block.number, "LimitSwapVerifier: tokenToToken() expiryBlock exceeded");

    // store initial tokenOutBalance
    uint256 tokenOutBalance = tokenOut.balanceOf(address(this));

    // send token to execution contract
    tokenIn.transfer(to, tokenInAmount);

    // execute call data on the CallExecutor contract
    CallExecutable(_implementation()).callExecutor().proxyCall(to, data);

    // calculate amount of tokenOut transferred to this contract
    uint256 tokenOutReceived = tokenOut.balanceOf(address(this)).sub(tokenOutBalance);

    // verify that enough tokenOut was received
    require(tokenOutReceived >= tokenOutAmount, "LimitSwapVerifier: tokenToToken() tokenOut received is less than allowed");
  }

  /// @dev TODO: natspec
  function ethToToken(
    IERC20 token, uint256 ethAmount, uint256 tokenAmount, uint256 expiryBlock,
    address to, bytes memory data
  )
    public
  {
    require(expiryBlock > block.number, "LimitSwapVerifier: ethToToken() expiryBlock exceeded");
    require(address(this).balance >= ethAmount, "LimitSwapVerifier: ethToToken() not enough ether");

    // store initial tokenBalance
    uint256 tokenBalance = token.balanceOf(address(this));

    // execute the unsigned call on the CallExecutor contract
    CallExecutable(implementation()).callExecutor().proxyPayableCall{value: ethAmount}(to, data);

    // calculate amount of token transferred to this contract
    uint256 tokenReceived = token.balanceOf(address(this)).sub(tokenBalance);

    // verify that enough token was received
    require(tokenReceived >= tokenAmount, "LimitSwapVerifier: ethToToken() token received is less than allowed");
  }

  /// @dev TODO: natspec
  function tokenToEth(
    IERC20 token, uint256 tokenAmount, uint256 ethAmount, uint256 expiryBlock,
    address to, bytes memory data
  )
    public
  {
    require(expiryBlock > block.number, "LimitSwapVerifier: tokenToEth() expiryBlock exceeded");

    // store initial ethBalance
    uint256 ethBalance = address(this).balance;

    // send token to execution contract
    token.transfer(to, tokenAmount);

    // execute the unsigned call on the CallExecutor contract
    CallExecutable(implementation()).callExecutor().proxyCall(to, data);

    // calculate amount of ether sent to this contract
    uint256 ethReceived = address(this).balance.sub(ethBalance);

    // verify that enough ether was received
    require(ethReceived >= ethAmount, "LimitSwapVerifier: tokenToEth() ether received is less than allowed");
  }
}
