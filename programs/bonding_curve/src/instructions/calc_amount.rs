use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::state::{CurveConfiguration, LiquidityPool, LiquidityPoolAccount};

pub fn calculate_buy_amount(ctx: Context<Calculate>, amount_in: u64) -> Result<u64> {
    ctx.accounts.pool.calculate_buy_amount(amount_in)
}

pub fn calculate_sell_amount(ctx: Context<Calculate>, token_amount: u64) -> Result<u64> {
    ctx.accounts.pool.calculate_sell_amount(token_amount)
}

pub fn calculate_market_cap(ctx: Context<Calculate>) -> Result<u64> {
    ctx.accounts.pool.calculate_market_cap()
}

#[derive(Accounts)]
pub struct Calculate<'info> {
    #[account(
        seeds = [CurveConfiguration::SEED.as_bytes()],
        bump,
    )]
    pub dex_configuration_account: Box<Account<'info, CurveConfiguration>>,

    #[account(
        seeds = [LiquidityPool::POOL_SEED_PREFIX.as_bytes(), token_mint.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, LiquidityPool>>,

    pub token_mint: Box<Account<'info, Mint>>,
}