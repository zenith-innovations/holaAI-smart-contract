use crate::consts::INITIAL_LAMPORTS_FOR_POOL;
use crate::consts::PROPORTION;
use crate::errors::CustomError;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[account]
pub struct CurveConfiguration {
    pub fees: f64,
    pub fee_collector: Pubkey,
}

impl CurveConfiguration {
    pub const SEED: &'static str = "CurveConfiguration";

    // Discriminator (8) + f64 (8)
    pub const ACCOUNT_SIZE: usize = 8 + 32 + 8;

    pub fn new(fees: f64, fee_collector: Pubkey) -> Self {
        Self {
            fees,
            fee_collector,
        }
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
    pub reserve_token: u64,     // Reserve amount of regular token
    pub reserve_exchange: u64,  // Reserve amount of exchange token (replacing reserve_exchange)
    pub bump: u8,
}

impl LiquidityPool {
    pub const POOL_SEED_PREFIX: &'static str = "liquidity_pool";

    // Discriminator (8) + Pubkey (32) + Pubkey (32) + totalsupply (8)
    // + reserve one (8) + reserve two (8) + Bump (1)
    pub const ACCOUNT_SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;

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
#[event]
pub struct TradeEvent {
    pub pool: Pubkey,
    pub token_mint: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub reserve_token_before: u64,
    pub reserve_token_after: u64,
    pub reserve_sol_before: u64,
    pub reserve_sol_after: u64,
    pub is_buy: bool,
}

pub trait LiquidityPoolAccount<'info> {
    // Updates the token reserves in the liquidity pool
    fn update_reserves(&mut self, reserve_token: u64, reserve_exchange: u64) -> Result<()>;

    // Allows adding liquidity by depositing an amount of two tokens and getting back pool shares
    fn add_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,    // token_mint
            &mut Account<'info, TokenAccount>, // pool_token_account
            &mut Account<'info, TokenAccount>, // user_token_account
            &mut Account<'info, Mint>,    // exchange_token_mint
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
        bonding_configuration_account: &Account<'info, CurveConfiguration>,
        fee_collector: &AccountInfo<'info>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
                        &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        amount: u64,
        bump: u8,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn sell(
        &mut self,
        bonding_configuration_account: &Account<'info, CurveConfiguration>,
        fee_collector: &AccountInfo<'info>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        amount: u64,
        bump: u8,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
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

    fn transfer_sol_to_fee_collector(
        &self,
        from: &AccountInfo<'info>,
        fee_collector: &AccountInfo<'info>,
        amount: u64,
        bump: u8,
        system_program: &Program<'info, System>,
    ) -> Result<()>;

    fn calculate_buy_amount(&self, amount_in: u64) -> Result<u64>;

    fn calculate_sell_amount(&self, token_amount: u64) -> Result<u64>;

    fn calculate_market_cap(&self) -> Result<u64>;
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
            &mut Account<'info, Mint>,    // token_mint
            &mut Account<'info, TokenAccount>, // pool_token_account
            &mut Account<'info, TokenAccount>, // user_token_account
            &mut Account<'info, Mint>,    // exchange_token_mint
            &mut Account<'info, TokenAccount>, // pool_exchange_token_account
            &mut Account<'info, TokenAccount>, // user_exchange_token_account
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        self.transfer_token_to_pool(
            token_accounts.2,
            token_accounts.1,
            token_accounts.0.supply,
            authority,
            token_program,
        )?;

        self.transfer_token_to_pool(
            token_accounts.5,  // user_exchange_token_account
            token_accounts.4,  // pool_exchange_token_account
            token_accounts.3.supply,  // amount of exchange token
            authority,
            token_program,
        )?;
        self.total_supply = 1_000_000_000_000_000_000;
        self.update_reserves(token_accounts.0.supply, INITIAL_LAMPORTS_FOR_POOL)?;

        Ok(())
    }

    fn remove_liquidity(
        &mut self,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        authority: &Signer<'info>,
        bump: u8,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        self.transfer_token_from_pool(
            token_accounts.1,
            token_accounts.2,
            token_accounts.1.amount as u64,
            token_program,
        )?;
        // let amount = self.to_account_info().lamports() - self.get_lamports();
        let amount = pool_sol_vault.to_account_info().lamports() as u64;
        self.transfer_sol_from_pool(pool_sol_vault, authority, amount, bump, system_program)?;

        Ok(())
    }

    fn buy(
        &mut self,
        bonding_configuration_account: &Account<'info, CurveConfiguration>,
        fee_collector: &AccountInfo<'info>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        amount: u64,
        bump: u8,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        let fee = bonding_configuration_account.fees;
        let fee_amount = (amount as f64 * fee / 100.0).round() as u64;

        self.transfer_sol_to_fee_collector(pool_sol_vault, fee_collector, fee_amount, bump, system_program)?;

        let amount_after_fee = amount - fee_amount;

        let amount_out = self.calculate_buy_amount(amount_after_fee)?;

        self.reserve_sol += amount;
        self.reserve_token -= amount_out;

        self.transfer_sol_to_pool(authority, pool_sol_vault, amount_after_fee, system_program)?;
        self.transfer_token_from_pool(
            token_accounts.1,
            token_accounts.2,
            amount_out,
            token_program,
        )?;

        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: amount,
            amount_out,
            reserve_sol_before: self.reserve_sol - amount,
            reserve_sol_after: self.reserve_sol,
            reserve_token_before: self.reserve_token + amount_out,
            reserve_token_after: self.reserve_token,
            is_buy: true,
        });

        Ok(())
    }

    fn sell(
        &mut self,
        bonding_configuration_account: &Account<'info, CurveConfiguration>,
        fee_collector: &AccountInfo<'info>,
        token_accounts: (
            &mut Account<'info, Mint>,
            &mut Account<'info, TokenAccount>,
            &mut Account<'info, TokenAccount>,
        ),
        pool_sol_vault: &mut AccountInfo<'info>,
        amount: u64,
        bump: u8,
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        let amount_out = self.calculate_sell_amount(amount)?;
        let fee = bonding_configuration_account.fees;
        let fee_amount = (amount_out as f64 * fee / 100.0).round() as u64;

        self.transfer_sol_to_fee_collector(pool_sol_vault, fee_collector, fee_amount, bump, system_program)?;

        let amount_after_fee = amount_out - fee_amount;

        self.reserve_token += amount;
        self.reserve_sol -= amount_after_fee;

        self.transfer_token_to_pool(
            token_accounts.2,
            token_accounts.1,
            amount,
            authority,
            token_program,
        )?;
        self.transfer_sol_from_pool(
            pool_sol_vault,
            authority,
            amount_after_fee,
            bump,
            system_program,
        )?;

        emit!(TradeEvent {
            pool: self.key(),
            token_mint: token_accounts.0.key(),
            amount_in: amount,
            amount_out: amount_after_fee,
            reserve_sol_before: self.reserve_sol + amount_out,
            reserve_sol_after: self.reserve_sol,
            reserve_token_before: self.reserve_token - amount,
            reserve_token_after: self.reserve_token,
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

    fn transfer_sol_from_pool(
        &self,
        from: &mut AccountInfo<'info>,
        to: &Signer<'info>,
        amount: u64,
        bump: u8,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        // let pool_account_info = self.to_account_info();

        system_program::transfer(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: from.clone(),
                    to: to.to_account_info().clone(),
                },
                &[&[
                    LiquidityPool::SOL_VAULT_PREFIX.as_bytes(),
                    self.token.key().as_ref(),
                    // LiquidityPool::POOL_SEED_PREFIX.as_bytes(),
                    // self.token.key().as_ref(),
                    &[bump],
                ]],
            ),
            amount,
        )?;
        Ok(())
    }

    fn transfer_sol_to_pool(
        &self,
        from: &Signer<'info>,
        to: &mut AccountInfo<'info>,
        amount: u64,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        // let pool_account_info = self.to_account_info();

        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }

    fn transfer_sol_to_fee_collector(
        &self,
        from: &AccountInfo<'info>,
        fee_collector: &AccountInfo<'info>,
        amount: u64,
        bump: u8,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        system_program::transfer(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: from.clone(),
                    to: fee_collector.clone(),
                },
                &[&[
                    LiquidityPool::SOL_VAULT_PREFIX.as_bytes(),
                    self.token.key().as_ref(),
                    &[bump],
                ]],
            ),
            amount,
        )?;
    Ok(())
}

    fn calculate_buy_amount(&self, amount_in: u64) -> Result<u64> {
        if amount_in == 0 {
            return err!(CustomError::InvalidAmount);
        }

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;

        let root_val = (PROPORTION as f64 * amount_in as f64 / 1_000_000_000.0
            + bought_amount * bought_amount)
            .sqrt();

        let amount_out =
            ((root_val - bought_amount) * 1_000_000.0 * 1_000_000_000.0).round() as u64;

        if amount_out > self.reserve_token {
            return err!(CustomError::NotEnoughTokenInVault);
        }

        Ok(amount_out)
    }

    fn calculate_sell_amount(&self, token_amount: u64) -> Result<u64> {
        if token_amount == 0 {
            return err!(CustomError::InvalidAmount);
        }

        if self.reserve_token < token_amount {
            return err!(CustomError::TokenAmountToSellTooBig);
        }

        let bought_amount =
            (self.total_supply as f64 - self.reserve_token as f64) / 1_000_000.0 / 1_000_000_000.0;

        let result_amount =
            (self.total_supply as f64 - self.reserve_token as f64 - token_amount as f64)
                / 1_000_000.0
                / 1_000_000_000.0;

        let amount_out = ((bought_amount * bought_amount - result_amount * result_amount)
            / PROPORTION as f64
            * 1_000_000_000.0)
            .round() as u64;

        if self.reserve_sol < amount_out {
            return err!(CustomError::NotEnoughExchangeTokenInVault);
        }

        Ok(amount_out)
    }

    fn calculate_market_cap(&self) -> Result<u64> {
        // Tính số token đã bán
        let sold_amount = (self.total_supply - self.reserve_token) as f64 / 1_000_000_000.0;

        // Tính giá hiện tại theo công thức tương tự sell
        let current_price = sold_amount / PROPORTION as f64;

        // Market cap = current_price * circulating supply * 10^9 (chuyển về lamports)
        let market_cap = (current_price * sold_amount * 1_000_000_000.0).round() as u64;

        Ok(market_cap)
    }
}
