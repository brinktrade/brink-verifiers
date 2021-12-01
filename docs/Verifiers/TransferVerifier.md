## `TransferVerifier`

These functions should be executed by metaDelegateCall() on Brink account proxy contracts




### `ethTransfer(uint256 bitmapIndex, uint256 bit, address recipient, uint256 amount, uint256 expiryBlock)` (external)

This should be executed by metaDelegateCall() with the following signed params


Executes an ETH transfer with replay protection and expiry


### `tokenTransfer(uint256 bitmapIndex, uint256 bit, address token, address recipient, uint256 amount, uint256 expiryBlock)` (external)

This should be executed by metaDelegateCall() with the following signed params


Executes an ERC20 token transfer with replay protection and expiry





