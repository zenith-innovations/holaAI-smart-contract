use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Duplicate tokens are not allowed")]
    DuplicateTokenNotAllowed,

    #[msg("Failed to allocate shares")]
    FailedToAllocateShares,

    #[msg("Failed to deallocate shares")]
    FailedToDeallocateShares,

    #[msg("Insufficient shares")]
    InsufficientShares,

    #[msg("Insufficient funds to swap")]
    InsufficientFunds,

    #[msg("Invalid amount to swap")]
    InvalidAmount,

    #[msg("Invalid fee")]
    InvalidFee,

    #[msg("Failed to add liquidity")]
    FailedToAddLiquidity,

    #[msg("Failed to remove liquidity")]
    FailedToRemoveLiquidity,

    #[msg("Sold token is not enough to remove pool")]
    NotEnoughToRemove,

    #[msg("Not a pool creator")]
    NotCreator,

    #[msg("Overflow or underflow occured")]
    OverflowOrUnderflowOccurred,

    #[msg("Token amount is too big to sell")]
    TokenAmountToSellTooBig,

    #[msg("Exchange Token is not enough in vault")]
    NotEnoughExchangeTokenInVault,

    #[msg("Token is not enough in vault")]
    NotEnoughTokenInVault,

    #[msg("Amount is negative")]
    NegativeNumber,

    #[msg("Failed to initialize mint")]
    MintInitializationFailed,

    #[msg("Failed to mint tokens")]
    MintFailed,

    #[msg("Invalid decimal value")]
    InvalidDecimalValue,

    #[msg("Invalid input parameters")]
    InvalidInput,

    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Invalid owner")]
    InvalidOwner,

    #[msg("Invalid exchange token mint")]
    InvalidExchangeTokenMint,

    #[msg("Invalid initial token for pool")]
    InvalidInitialTokenForPool,

    #[msg("Min output amount not met")]
    MinOutputAmountNotMet,

    #[msg("Lockdown")]
    Lockdown,
}
