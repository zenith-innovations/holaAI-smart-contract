use anchor_lang::prelude::*;

pub mod consts;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("EgCVj2y8BiAEwS4SdQCyByiU52Xx8GsucabhXUmaj9fj");

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

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        off_chain_id: String,
        is_agent: bool,
    ) -> Result<()> {
        instructions::create_token(ctx, name, symbol, off_chain_id, is_agent)
    }
}
