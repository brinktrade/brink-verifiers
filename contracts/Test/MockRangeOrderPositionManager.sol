// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TestFullMath.sol";

// not explicitly implementing IRangeOrderPositionManager interface because of namespace collisions

contract MockRangeOrderPositionManager {

  uint128 private immutable _mockLiquidityTotal;

  mapping(bytes32 => mapping(uint256 => mapping(address => uint128))) private _liquidityBalances;

  constructor (uint128 mockLiquidityTotal) {
    _mockLiquidityTotal = mockLiquidityTotal;
  }

  function positionIndexes (bytes32 positionHash)
    external view
    returns (uint256 positionIndex)
  { return 0; }
  
  function liquidityBalances (bytes32 positionHash, uint256 positionIndex, address owner)
    external view
    returns (uint128 liquidityBalance)
  {
    liquidityBalance = _liquidityBalances[positionHash][positionIndex][owner];
  }

  struct IncreaseLiquidityParams {
    address owner;
    uint256 inputAmount;
    address tokenIn;
    address tokenOut;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
  }

  function increaseLiquidity(IncreaseLiquidityParams calldata params)
    external
  {
    IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.inputAmount);
    bytes32 positionHash = keccak256(abi.encode(
      params.tokenIn, params.tokenOut, params.fee, params.tickLower, params.tickUpper
    ));
    _liquidityBalances[positionHash][0][params.owner] += _mockLiquidityTotal;
  }

  struct IncreaseLiquidityMultiParams {
    address[] owners;
    uint256[] inputAmounts;
    uint256 totalInputAmount;
    address tokenIn;
    address tokenOut;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
  }

  function increaseLiquidityMulti(IncreaseLiquidityMultiParams calldata params)
    external
  {
    require(params.owners.length == params.inputAmounts.length, 'ORDERS_LENGTH_MISMATCH');

    IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.totalInputAmount);

    bytes32 positionHash = keccak256(abi.encode(
      params.tokenIn, params.tokenOut, params.fee, params.tickLower, params.tickUpper
    ));

    // store individual owner liquidity
    uint256 accumInputAmount;
    for(uint8 i = 0; i < params.inputAmounts.length; i++) {
      uint256 ownerInputAmount = params.inputAmounts[i];
      accumInputAmount += ownerInputAmount;
      uint128 ownerLiquidity = uint128(TestFullMath.mulDiv(
        ownerInputAmount,
        _mockLiquidityTotal,
        params.totalInputAmount
      ));
      _liquidityBalances[positionHash][0][params.owners[i]] += ownerLiquidity;
    }
    require(accumInputAmount == params.totalInputAmount, 'BAD_INPUT_AMOUNT');
  }

  // function resolveOrders(ResolveOrdersParams calldata params)
  //   external override
  // {

  // }

  // function withdrawOrder (WithdrawParams calldata params)
  //   external override
  // {

  // }
}
