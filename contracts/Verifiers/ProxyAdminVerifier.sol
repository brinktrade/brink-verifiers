// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@brinkninja/core/contracts/Proxy/ProxyGettable.sol";
import "@brinkninja/core/contracts/Proxy/ProxySettable.sol";

/**
 * @dev Contains functions for admin control of Proxy accounts.
 *
 * This "Verifier" contract is deployed once. It can be called on a Proxy account
 * with a signed `executeDelegateCall` message (see AccountLogic.sol in brink-core). 
 * All functions are public, which is safe because this
 * contract is called directly, it has no way to access storage on Proxy (user account)
 * instances.
 */
contract ProxyAdminVerifier is ProxyGettable, ProxySettable {
  /**
   * @dev Emitted when the implementation address changes
   */
  event Upgraded(address indexed impl);

  /**
   * @dev Emitted when an owner address is added
   */
  event OwnerAdded(address owner);

  /**
   * @dev Emitted when an owner address is removed
   */
  event OwnerRemoved(address owner);

  /**
   * @dev Changes the implementation address
   *
   * Emits an `Upgraded` event with the new implementation address
   *
   * Requirements:
   *
   * - implementation address cannot be 0
   */
  function upgradeTo(address impl) public {
    require(impl != address(0), "ProxyAdminVerifier: upgradeTo with zero address implementation");
    _setImplementation(impl);
    emit Upgraded(impl);
  }

  /**
   * @dev Adds a proxy owner address
   *
   * Emits an `OwnerAdded` event with the new proxy owner address
   *
   * Requirements:
   *
   * - `owner` cannot be an existing proxy owner
   * - `owner` address cannot be 0
   */
  function addProxyOwner(address owner) public {
    require(!_isProxyOwner(owner), "ProxyAdminVerifier: addOwner with existing owner");
    require(owner != address(0), "ProxyAdminVerifier: addOwner with zero address");
    _addProxyOwner(owner);
    emit OwnerAdded(owner);
  }

  /**
   * @dev Removes a proxy owner address
   *
   * Emits an `OwnerRemoved` event with the removed proxy owner address
   *
   * Requirements:
   *
   * - `owner` must be an existing proxy owner
   */
  function removeProxyOwner(address owner) public {
    require(_isProxyOwner(owner), "ProxyAdminVerifier: removeOwner with owner that does not exist");
    _removeProxyOwner(owner);
    emit OwnerRemoved(owner);
  }
}
