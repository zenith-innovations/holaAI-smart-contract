use crate::state::{CurveConfiguration, LiquidityPool, LiquidityPoolAccount};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

pub fn remove_liquidity(ctx: Context<RemoveLiquidity>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    let token_accounts = (
        &mut *ctx.accounts.token_mint, // 0
        &mut *ctx.accounts.pool_token_account, // 1
        &mut *ctx.accounts.user_token_account, // 2
        &mut *ctx.accounts.exchange_token_mint, // 3
        &mut *ctx.accounts.pool_exchange_token_account, // 4
        &mut *ctx.accounts.user_exchange_token_account, // 5
        &mut *ctx.accounts.admin_token_account, // 6
        &mut *ctx.accounts.admin_exchange_token_account, // 7
    );

    pool.remove_liquidity(
        token_accounts,
        &ctx.accounts.curve_config,
        &ctx.accounts.user,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}


#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(
        mut,
        seeds = [
            LiquidityPool::POOL_SEED_PREFIX.as_bytes(), 
            token_mint.key().as_ref(),
            exchange_token_mint.key().as_ref()
        ],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, LiquidityPool>>,

    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,

        #[account(mut)]
    pub exchange_token_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = pool
    )]
    pub pool_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = curve_config.get_admin(),
    )]
    pub admin_token_account: Box<Account<'info, TokenAccount>>,


    #[account(
        mut,
        associated_token::mint = exchange_token_mint,
        associated_token::authority = curve_config.get_admin(),
    )]
    pub admin_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = exchange_token_mint,
        associated_token::authority = user,
    )]
    pub user_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = exchange_token_mint,
        associated_token::authority = pool
    )]
    pub pool_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut,
        seeds = [CurveConfiguration::SEED.as_bytes()],
        bump,
    )]
    pub curve_config: Box<Account<'info, CurveConfiguration>>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
