use crate::consts::{INITIAL_TOKEN_FOR_POOL, PROPORTION};
use crate::errors::CustomError;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[account]
pub struct CurveConfiguration {
    pub fees: f64,
    pub admin: Pubkey,
}

impl CurveConfiguration {
    pub const SEED: &'static str = "CurveConfiguration";

    // Discriminator (8) + f64 (8)
    pub const ACCOUNT_SIZE: usize = 8 + 32 + 8;

    pub fn new(fees: f64, admin: Pubkey) -> Self {
        Self { fees , admin}
    }
}

#[account]
pub struct LiquidityProvider {
    pub shares: u64, // The number of shares this provider holds in the liquidity pool ( didnt add to contract now )
}

impl LiquidityProvider {
    pub const SEED_PREFIX: &'static str = "LiqudityProvider"; // Prefix for generating PDAs

    // Discriminator (8) + f64 (8)
    pub const ACCOUNT_SIZE: usize = 8 + 8;
}

#[account]
pub struct LiquidityPool {
    pub creator: Pubkey,
    pub token: Pubkey,          // Regular token mint
    pub exchange_token: Pubkey, // Exchange token mint (replacing SOL)
    pub total_supply: u64,
    pub reserve_token: u64,    // Reserve amount of regular token
    pub reserve_exchange: u64, // Reserve amount of exchange token (replacing reserve_exchange)
    pub bump: u8,
    pub is_listed_raydium: bool,
    pub raydium_pool: Option<Pubkey>,
}

#[event]
pub struct TradeEvent {
    pub pool: Pubkey,
    pub token_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub reserve_token_before: u64,
    pub reserve_token_after: u64,
    pub reserve_exchange_before: u64,
    pub reserve_exchange_after: u64,
    pub is_buy: bool,
}

#[event]
pub struct RaydiumPoolCreated {
    pub bonding_pool: Pubkey,
    pub raydium_pool: Pubkey,
    pub token_mint: Pubkey,
    pub exchange_token_mint: Pubkey,
    pub creator: Pubkey,
}

impl LiquidityPool {
    pub const POOL_SEED_PREFIX: &'static str = "liquidity_pool";

    // Discriminator (8) + Pubkey (32) + Pubkey (32) + totalsupply (8)
    // + reserve one (8) + reserve two (8) + Bump (1)
    pub const ACCOUNT_SIZE: usize = 8 + // discriminator
        32 + // creator: Pubkey
        32 + // token: Pubkey
        32 + // exchange_token: Pubkey  
        8 +  // total_supply: u64
        8 +  // reserve_token: u64
        8 +  // reserve_exchange: u64
        1; // bump: u8

    // Constructor to initialize a LiquidityPool with two tokens and a bump for the PDA
    pub fn new(creator: Pubkey, token: Pubkey, exchange_token: Pubkey, bump: u8) -> Self {
        Self {
            creator,
            token,
            exchange_token,
            total_supply: 0_u64,
            reserve_token: 0_u64,
            reserve_exchange: 0_u64,
            bump,
            is_listed_raydium: false,
            raydium_pool: None,
        }
    }
}

pub trait LiquidityPoolAccount<'info> {
    // Updates the token reserves in the liquidity pool
    fn update_reserves(&mut self, reserve_token: u64, reserve_exchange: u64) -> Result<()>;

    // Allows adding liquidity by depositing an amount of two tokens and getting back pool shares
    fn add_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,         // token_mint
            &mut Account<'info, TokenAccount>, // pool_token_account
            &mut Account<'info, TokenAccount>, // user_token_account
            &mut Account<'info, Mint>,         // exchange_token_mint
            &mut Account<'info, TokenAccount>, // pool_exchange_token_account
            &mut Account<'info, TokenAccount>, // user_exchange_token_account
        ),
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;

    // Allows removing liquidity by burning pool shares and receiving back a proportionate amount of tokens
    fn remove_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;

    fn buy(
        &mut self,
        // bonding_configuration_account: &Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;

    fn sell(
        &mut self,
        // bonding_configuration_account: &Account<'info, CurveConfiguration>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        amount: u64,
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;

    fn transfer_token_from_pool(
        &self,
        from: &Account<'info, TokenAccount>,
        to: &Account<'info, TokenAccount>,
        amount: u64,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;

    fn transfer_token_to_pool(
        &self,
        from: &Account<'info, TokenAccount>,
        to: &Account<'info, TokenAccount>,
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;
}

impl<'info> LiquidityPoolAccount<'info> for Account<'info, LiquidityPool> {
    fn update_reserves(&mut self, reserve_token: u64, reserve_exchange: u64) -> Result<()> {
        self.reserve_token = reserve_token;
        self.reserve_exchange = reserve_exchange;
        Ok(())
    }

    fn add_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,         // token_mint
            &mut Account<'info, TokenAccount>, // pool_token_account
            &mut Account<'info, TokenAccount>, // user_token_account
            &mut Account<'info, Mint>,         // exchange_token_mint
            &mut Account<'info, TokenAccount>, // pool_exchange_token_account
            &mut Account<'info, TokenAccount>, // user_exchange_token_account
        ),
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        // Transfer regular token to pool
        self.transfer_token_to_pool(
            token_accounts.2,        // user_token_account
            token_accounts.1,        // pool_token_account
            token_accounts.0.supply, // amount of regular token
            authority,
            token_program,
        )?;

        // Transfer exchange token to pool
        self.transfer_token_to_pool(
            token_accounts.5,       // user_exchange_token_account
            token_accounts.4,       // pool_exchange_token_account
            INITIAL_TOKEN_FOR_POOL, // amount of exchange token
            authority,
            token_program,
        )?;

        // Update pool state
        self.total_supply = 1_000_000_000 * u64::pow(10, token_accounts.0.decimals as u32);
        self.update_reserves(token_accounts.0.supply, token_accounts.3.supply)?;

        Ok(())
    }

    fn remove_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        authority: &Signer<'info>,
        _bump: u8,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {

        if authority.key() != self.creator {
            return err!(CustomError::InvalidAuthority);
        }

        // Transfer all regular tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.1, // pool_token_account
            token_accounts.2, // user_token_account
            token_accounts.1.amount,
            token_program,
        )?;

        // Transfer all exchange tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.4, // pool_exchange_token_account
            token_accounts.5, // user_exchange_token_account
            token_accounts.4.amount,
            token_program,
        )?;

        // Update pool state
        self.update_reserves(0, 0)?;
        self.total_supply = 0;

        Ok(())
    }

    fn buy(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,         // Project token mint
            &mut Account<'info, TokenAccount>, // Project token pool account
            &mut Account<'info, TokenAccount>, // User's project token account
            &mut Account<'info, Mint>,         // Project token mint
            &mut Account<'info, TokenAccount>, // Exchange token pool account
            &mut Account<'info, TokenAccount>, // User's exchange token account
        ),
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        if amount == 0 {}

        msg!("Trying to buy from the pool");

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;
        msg!("bought_amount {}", bought_amount);

        let root_val = (PROPORTION as f64 * amount as f64 / 1_000_000_000.0
            + bought_amount * bought_amount)
            .sqrt();
        let amount_out_f64 = (root_val - bought_amount as f64) * 1_000_000.0 * 1_000_000_000.0;
        let amount_out = amount_out_f64.round() as u64;

        if amount_out > self.reserve_token {
            return err!(CustomError::NotEnoughTokenInVault);
        }

        // Transfer exchange tokens from user to pool
        self.transfer_token_to_pool(
            token_accounts.5,
            token_accounts.4,
            amount,
            authority,
            token_program,
        )?;

        // Transfer project tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.1,
            token_accounts.2,
            amount_out,
            token_program,
        )?;

        self.reserve_exchange += amount; // This becomes exchange token reserve
        self.reserve_token -= amount_out;

        msg!("reserve_token {}", self.reserve_token);
        msg!("reserve_exchange {}", self.reserve_exchange);

        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: amount,
            amount_out,
            reserve_exchange_before: self.reserve_exchange,
            reserve_exchange_after: self.reserve_exchange + amount,
            reserve_token_before: self.reserve_token,
            reserve_token_after: self.reserve_token - amount_out,
            is_buy: true,
        });
        Ok(())
    }

    fn sell(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,         // Project token mint
            &mut Account<'info, TokenAccount>, // Project token pool account
            &mut Account<'info, TokenAccount>, // User's project token account
            &mut Account<'info, Mint>,         // Project token mint
            &mut Account<'info, TokenAccount>, // Exchange token pool account
            &mut Account<'info, TokenAccount>, // User's exchange token account
        ),
        amount: u64,
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        if amount == 0 {
            return err!(CustomError::InvalidAmount);
        }

        if self.reserve_token < amount {
            return err!(CustomError::TokenAmountToSellTooBig);
        }

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;
        let result_amount = (self.total_supply as f64 - self.reserve_token as f64 - amount as f64)
            / 1_000_000.0
            / 1_000_000_000.0;
        let amount_out_f64 = (bought_amount * bought_amount - result_amount * result_amount)
            / PROPORTION as f64
            * 1_000_000_000.0;
        let amount_out = amount_out_f64.round() as u64;

        if self.reserve_exchange < amount_out {
            // This checks exchange token reserve
            return err!(CustomError::NotEnoughExchangeTokenInVault);
        }

        // Transfer project tokens from user to pool
        self.transfer_token_to_pool(
            token_accounts.2,
            token_accounts.1,
            amount,
            authority,
            token_program,
        )?;

        // Transfer exchange tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.4,
            token_accounts.5,
            amount_out,
            token_program,
        )?;

        self.reserve_token += amount;
        self.reserve_exchange -= amount_out; // This becomes exchange token reserve
        msg!("reserve_token {}", self.reserve_token);
        msg!("reserve_exchange {}", self.reserve_exchange);
        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: amount,
            amount_out,
            reserve_exchange_before: self.reserve_exchange,
            reserve_exchange_after: self.reserve_exchange - amount_out,
            reserve_token_before: self.reserve_token,
            reserve_token_after: self.reserve_token + amount,
            is_buy: false,
        });

        Ok(())
    }

    fn transfer_token_from_pool(
        &self,
        from: &Account<'info, TokenAccount>,
        to: &Account<'info, TokenAccount>,
        amount: u64,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.to_account_info(),
                },
                &[&[
                    LiquidityPool::POOL_SEED_PREFIX.as_bytes(),
                    self.token.key().as_ref(),
                    self.exchange_token.key().as_ref(),
                    &[self.bump],
                ]],
            ),
            amount,
        )?;
        Ok(())
    }

    fn transfer_token_to_pool(
        &self,
        from: &Account<'info, TokenAccount>,
        to: &Account<'info, TokenAccount>,
        amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: authority.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }
}
