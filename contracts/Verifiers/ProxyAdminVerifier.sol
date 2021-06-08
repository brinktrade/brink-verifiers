// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@brinkninja/core/contracts/Proxy/ProxyGettable.sol";
import "@brinkninja/core/contracts/Proxy/ProxySettable.sol";

/// @dev Contains functions for admin control of Proxy accounts
contract ProxyAdminVerifier is ProxyGettable, ProxySettable {
  /**
   * @dev Emitted when the implementation address changes
   */
  event Upgraded(address indexed impl);

  /**
   * @dev Emitted when an owner address changed
   */
  event OwnerChanged(address owner);

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
    // add a check that implementation is a valid Account contract
    _setImplementation(impl);
    emit Upgraded(impl);
  }

  /// @dev sets the proxy owner address
  function setOwner(address owner) public {
    // TODO: add signature check for new owner
    _setProxyOwner(owner);
    emit OwnerChanged(owner);
  }
}
