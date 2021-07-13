// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import "@brinkninja/core/contracts/Proxy/ProxyGettable.sol";
import "@brinkninja/core/contracts/Proxy/ProxySettable.sol";

/// @dev Contains functions for admin control of Proxy accounts
contract ProxyAdminVerifier is ProxyGettable, ProxySettable {

  /// @dev Changes the implementation address
  /// @param impl The implementation address
  function upgradeTo(address impl) public {
    // TODO: add a check that implementation is a valid Account contract
    _setImplementation(impl);
  }

  /// @dev sets the proxy owner address
  /// @param owner The proxy owner address
  function setProxyOwner(address owner) public {
    // TODO: add signature check for new owner
    _setProxyOwner(owner);
  }
}
