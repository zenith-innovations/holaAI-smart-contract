use crate::errors::CustomError;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[account]
pub struct CurveConfiguration {
    fee_percentage: u64,
    creation_fees: u64,
    proportion: f64,
    fee_collector: Pubkey,
    fee_sol_collector: Pubkey,
    exchange_token_mint: Pubkey,
    admin: Pubkey,
    initial_token_for_pool: u64,
    is_sol_fee: bool,
    is_lockdown: bool,
}

impl CurveConfiguration {
    pub const SEED: &'static str = "CurveConfiguration";

    // Discriminator (8) + f64 (8) + Pubkey (32)
    pub const ACCOUNT_SIZE: usize = 8 + 8 + 8 + 32 + 32 + 8 + 32 + 8 + 8 + 1 + 1;

    pub fn new(
        fee_percentage: u64,         // + 8
        creation_fees: u64,          // + 8
        proportion: f64,             // + 8
        fee_collector: Pubkey,       // + 32
        fee_sol_collector: Pubkey,   // + 32
        exchange_token_mint: Pubkey, // + 32
        admin: Pubkey,               // + 32
        initial_token_for_pool: u64, // + 8
        is_sol_fee: bool,            // + 1
        is_lockdown: bool,           // + 1
    ) -> Self {
        Self {
            fee_percentage,
            creation_fees,
            proportion,
            fee_collector,
            fee_sol_collector,
            exchange_token_mint,
            admin,
            initial_token_for_pool,
            is_sol_fee,
            is_lockdown,
        }
    }

    pub fn update_configuration(
        &mut self,
        fee_percentage: u64,
        creation_fees: u64,
        proportion: f64,
        fee_collector: Pubkey,
        fee_sol_collector: Pubkey,
        exchange_token_mint: Pubkey,
        initial_token_for_pool: u64,
        is_sol_fee: bool,
        is_lockdown: bool,
    ) -> Result<()> {
        self.fee_percentage = fee_percentage;
        self.creation_fees = creation_fees;
        self.proportion = proportion;
        self.fee_collector = fee_collector;
        self.fee_sol_collector = fee_sol_collector;
        self.exchange_token_mint = exchange_token_mint;
        self.initial_token_for_pool = initial_token_for_pool;
        self.is_sol_fee = is_sol_fee;
        self.is_lockdown = is_lockdown;
        Ok(())
    }

    pub fn get_admin(&self) -> Pubkey {
        self.admin
    }

    pub fn get_initial_token_for_pool(&self) -> u64 {
        self.initial_token_for_pool
    }

    pub fn get_proportion(&self) -> f64 {
        self.proportion
    }

    pub fn get_fees(&self) -> u64 {
        self.fee_percentage
    }

    pub fn get_creation_fees(&self) -> u64 {
        self.creation_fees
    }

    pub fn get_fee_collector(&self) -> Pubkey {
        self.fee_collector
    }

    pub fn get_fee_sol_collector(&self) -> Pubkey {
        self.fee_sol_collector
    }

    pub fn get_exchange_token_mint(&self) -> Pubkey {
        self.exchange_token_mint
    }

    pub fn get_is_sol_fee(&self) -> bool {
        self.is_sol_fee
    }

    pub fn get_is_lockdown(&self) -> bool {
        self.is_lockdown
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
pub struct AddLiquidity {
    pub pool: Pubkey,
    pub reserve_token: u64,
    pub reserve_exchange: u64,
}

#[event]
pub struct RemoveLiquidity {
    pub pool: Pubkey,
    pub reserve_token: u64,
    pub reserve_exchange: u64,
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
        curve_config: &Account<'info, CurveConfiguration>,
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
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        authority: &Signer<'info>,
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
            &mut Account<'info, TokenAccount>,
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        amount: u64,
        min_output_amount: u64,
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
            &mut Account<'info, TokenAccount>,
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        amount: u64,
        min_output_amount: u64,
        authority: &Signer<'info>,
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
        curve_config: &Account<'info, CurveConfiguration>,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        let initial_token_for_pool = curve_config.get_initial_token_for_pool();

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
            initial_token_for_pool, // amount of exchange token
            authority,
            token_program,
        )?;

        // Update pool state
        self.total_supply = 1_000_000_000 * u64::pow(10, token_accounts.0.decimals as u32);
        self.update_reserves(token_accounts.0.supply, initial_token_for_pool)?;
        emit!(AddLiquidity {
            pool: self.key(),
            reserve_token: token_accounts.0.supply,
            reserve_exchange: initial_token_for_pool,
        });
        Ok(())
    }

    fn remove_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,         // 0
            &mut Account<'info, TokenAccount>, // 1
            &mut Account<'info, TokenAccount>, // 2
            &mut Account<'info, Mint>,         // 3
            &mut Account<'info, TokenAccount>, // 4
            &mut Account<'info, TokenAccount>, // 5
            &mut Account<'info, TokenAccount>, // 6
            &mut Account<'info, TokenAccount>, // 7
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        if authority.key() != curve_config.admin {
            return err!(CustomError::InvalidAuthority);
        }

        // Transfer all regular tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.1, // pool_token_account
            token_accounts.6, // admin_token_account
            token_accounts.1.amount,
            token_program,
        )?;

        // Transfer all exchange tokens from pool to user
        self.transfer_token_from_pool(
            token_accounts.4, // pool_exchange_token_account
            token_accounts.7, // admin_exchange_token_account
            token_accounts.4.amount,
            token_program,
        )?;

        emit!(RemoveLiquidity {
            pool: self.key(),
            reserve_token: self.reserve_token,
            reserve_exchange: self.reserve_exchange,
        });

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
            &mut Account<'info, Mint>,         // Exchange token mint
            &mut Account<'info, TokenAccount>, // Exchange token pool account
            &mut Account<'info, TokenAccount>, // User's exchange token account
            &mut Account<'info, TokenAccount>, // Fee token account
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        amount: u64,
        min_output_amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        if amount == 0 {
            return err!(CustomError::InvalidAmount);
        }

        let proportion = curve_config.get_proportion();
        let fee_percentage = curve_config.get_fees();
        let fee_amount = amount * fee_percentage / 10000;
        let amount_after_fee = amount - fee_amount;

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;
        let root_val = (proportion as f64 * amount_after_fee as f64 / 1_000_000_000.0
            + bought_amount * bought_amount)
            .sqrt();
        let mut amount_out =
            ((root_val - bought_amount) * 1_000_000.0 * 1_000_000_000.0).round() as u64;

        let max_allowed = (self.total_supply as f64 * 0.8) as u64;
        let current_bought = self.total_supply - self.reserve_token;

        let mut final_amount = amount;
        let mut final_fee = fee_amount;

        if current_bought + amount_out > max_allowed {
            amount_out = max_allowed - current_bought;

            let new_bought_amount = amount_out as f64 / (1_000_000.0 * 1_000_000_000.0);
            let new_amount = ((new_bought_amount * new_bought_amount
                - bought_amount * bought_amount)
                * proportion as f64
                * 1_000_000_000.0)
                .round() as u64;

            let refund_amount = amount_after_fee - new_amount;
            let refund_fee = fee_amount * refund_amount / amount_after_fee;

            final_amount = new_amount + (fee_amount - refund_fee);
            final_fee = fee_amount - refund_fee;
        }

        if amount_out > self.reserve_token {
            return err!(CustomError::NotEnoughTokenInVault);
        }

        if amount_out < min_output_amount {
            return err!(CustomError::MinOutputAmountNotMet);
        }

        // Transfer fee
        self.transfer_token_to_pool(
            token_accounts.5,
            token_accounts.6,
            final_fee,
            authority,
            token_program,
        )?;

        // Transfer exchange tokens from user to pool
        self.transfer_token_to_pool(
            token_accounts.5,
            token_accounts.4,
            final_amount - final_fee,
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

        self.reserve_exchange += final_amount;
        self.reserve_token -= amount_out;

        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: final_amount,
            amount_out,
            reserve_exchange_before: self.reserve_exchange - final_amount,
            reserve_exchange_after: self.reserve_exchange,
            reserve_token_before: self.reserve_token + amount_out,
            reserve_token_after: self.reserve_token,
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
            &mut Account<'info, TokenAccount>, // Fee token account
        ),
        curve_config: &Account<'info, CurveConfiguration>,
        amount: u64,
        min_output_amount: u64,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        if amount == 0 {
            return err!(CustomError::InvalidAmount);
        }
        let proportion = curve_config.get_proportion();

        if self.reserve_token < amount {
            return err!(CustomError::TokenAmountToSellTooBig);
        }

        let fee_percentage = curve_config.get_fees();

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;
        let result_amount = (self.total_supply as f64 - self.reserve_token as f64 - amount as f64)
            / 1_000_000.0
            / 1_000_000_000.0;
        let amount_out_f64 = (bought_amount * bought_amount - result_amount * result_amount)
            / proportion as f64
            * 1_000_000_000.0;
        let amount_out = amount_out_f64.round() as u64;
        let fee_amount = amount_out * fee_percentage / 10000;
        if self.reserve_exchange < amount_out {
            // This checks exchange token reserve
            return err!(CustomError::NotEnoughExchangeTokenInVault);
        }

        if amount_out < min_output_amount {
            return err!(CustomError::MinOutputAmountNotMet);
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
            amount_out - fee_amount,
            token_program,
        )?;

        self.transfer_token_from_pool(
            token_accounts.4,
            token_accounts.6,
            fee_amount,
            token_program,
        )?;

        self.reserve_token += amount;
        self.reserve_exchange -= amount_out - fee_amount;
        msg!("reserve_token {}", self.reserve_token);
        msg!("reserve_exchange {}", self.reserve_exchange);
        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: amount,
            amount_out,
            reserve_exchange_before: self.reserve_exchange,
            reserve_exchange_after: 0,
            reserve_token_before: self.reserve_token,
            reserve_token_after: 0,
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
