use anchor_lang::prelude::*;

pub mod consts;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::instructions::*;

declare_id!("43zsC4m9jKa1AZJuVpNLxpWFFNqopRHspv9F4Wko7Wsr");

#[program]
pub mod bonding_curve {
    use super::*;

    pub fn initialize(
        ctx: Context<InitializeCurveConfiguration>,
        fee_percentage: u64,
        creation_fees: u64,
        proportion: f64,
        fee_collector: Pubkey,
        fee_sol_collector: Pubkey,
        initial_token_for_pool: u64,
    ) -> Result<()> {
        instructions::initialize(
            ctx,
            fee_percentage,
            creation_fees,
            proportion,
            fee_collector,
            fee_sol_collector,
            initial_token_for_pool,
        )
    }

    pub fn update_configuration(
        ctx: Context<UpdateConfiguration>,
        fee_percentage: u64,
        creation_fees: u64,
        proportion: f64,
        fee_collector: Pubkey,
        fee_sol_collector: Pubkey,
        initial_token_for_pool: u64
    ) -> Result<()> {
        instructions::update_configuration(
            ctx,
            fee_percentage,
            creation_fees,
            proportion,
            fee_collector,
            fee_sol_collector,
            initial_token_for_pool,
        )
    }

    pub fn create_pool(ctx: Context<CreateLiquidityPool>) -> Result<()> {
        instructions::create_pool(ctx)
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>) -> Result<()> {
        instructions::add_liquidity(ctx)
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>) -> Result<()> {
        instructions::remove_liquidity(ctx)
    }

    pub fn buy(ctx: Context<Buy>, amount: u64) -> Result<()> {
        instructions::buy(ctx, amount)
    }

    pub fn sell(ctx: Context<Sell>, amount: u64) -> Result<()> {
        instructions::sell(ctx, amount)
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        off_chain_id: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_token(ctx, name, symbol, off_chain_id, uri)
    }

    pub fn proxy_initialize(
        ctx: Context<ProxyInitialize>,
        init_amount_0: u64,
        init_amount_1: u64,
        open_time: u64,
    ) -> Result<()> {
        instructions::proxy_initialize(ctx, init_amount_0, init_amount_1, open_time)
    }
}
