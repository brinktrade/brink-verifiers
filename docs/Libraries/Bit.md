## `Bit`

Handles storage and loads for replay protection bits


Solution adapted from https://github.com/PISAresearch/metamask-comp/blob/77fa8295c168ee0b6bf801cbedab797d6f8cfd5d/src/contracts/BitFlipMetaTransaction/README.md
This is a gas optimized technique that stores up to 256 replay protection bits per bytes32 slot


### `useBit(uint256 bitmapIndex, uint256 bit)` (internal)



Adds a bit to the uint256 bitmap at bitmapIndex
Value of bit cannot be zero and must represent a single bit


### `validBit(uint256 bit) → bool isValid` (internal)



Check that a bit is valid


### `bitmapPtr(uint256 bitmapIndex) → bytes32` (internal)



Get a bitmap storage pointer


### `loadUint(bytes32 ptr) → uint256 val` (internal)



Returns the uint256 value at storage location ptr





