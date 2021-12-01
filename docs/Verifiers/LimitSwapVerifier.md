## `LimitSwapVerifier`

These functions should be executed by metaPartialSignedDelegateCall() on Brink account proxy contracts




### `constructor(contract ICallExecutor callExecutor)` (public)





### `tokenToToken(uint256 bitmapIndex, uint256 bit, contract IERC20 tokenIn, contract IERC20 tokenOut, uint256 tokenInAmount, uint256 tokenOutAmount, uint256 expiryBlock, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Executes an ERC20 to ERC20 limit swap


### `ethToToken(uint256 bitmapIndex, uint256 bit, contract IERC20 token, uint256 ethAmount, uint256 tokenAmount, uint256 expiryBlock, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Executes an ETH to ERC20 limit swap


### `tokenToEth(uint256 bitmapIndex, uint256 bit, contract IERC20 token, uint256 tokenAmount, uint256 ethAmount, uint256 expiryBlock, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Executes an ERC20 to ETH limit swap





