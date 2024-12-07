use anchor_lang::prelude::*;

pub mod consts;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("8pjqbSdygweTeMQR9DkC5TNtErq2RsHL49DmcERPzvtQ");

#[program]
pub mod bonding_curve {
    use super::*;

    pub fn initialize(ctx: Context<InitializeCurveConfiguration>, fee: f64) -> Result<()> {
        instructions::initialize(ctx, fee)
    }

    pub fn create_pool(ctx: Context<CreateLiquidityPool>) -> Result<()> {
        instructions::create_pool(ctx)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>) -> Result<()> {
        instructions::add_liquidity(ctx)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, bump: u8) -> Result<()> {
        instructions::remove_liquidity(ctx, bump)
    }

    pub fn buy(ctx: Context<Buy>, amount: u64) -> Result<()> {
        instructions::buy(ctx, amount)
    }

    pub fn sell(ctx: Context<Sell>, amount: u64, bump: u8) -> Result<()> {
        instructions::sell(ctx, amount, bump)
    }

    pub fn calculate_buy_amount(ctx: Context<Calculate>, amount_in: u64) -> Result<u64> {
        instructions::calculate_buy_amount(ctx, amount_in)
    }

    pub fn calculate_sell_amount(ctx: Context<Calculate>, token_amount: u64) -> Result<u64> {
        instructions::calculate_sell_amount(ctx, token_amount)
    }

    pub fn calculate_market_cap(ctx: Context<Calculate>) -> Result<u64> {
        instructions::calculate_market_cap(ctx)
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        off_chain_id: String,
    ) -> Result<()> {
        instructions::create_token(ctx, name, symbol, off_chain_id)
    }
}
