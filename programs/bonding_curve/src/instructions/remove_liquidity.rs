use crate::{
    errors::CustomError,
    state::{LiquidityPool, LiquidityPoolAccount},
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, bump: u8) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    if pool.creator.key() != ctx.accounts.user.key() {
        return Err(CustomError::NotCreator.into());
    }

    let token_accounts = (
        &mut *ctx.accounts.token_mint,
        &mut *ctx.accounts.pool_token_account,
        &mut *ctx.accounts.user_token_account,
        &mut *ctx.accounts.exchange_token_mint,
        &mut *ctx.accounts.pool_exchange_token_account,
        &mut *ctx.accounts.user_exchange_token_account,
    );

    pool.remove_liquidity(
        token_accounts,
        &mut ctx.accounts.pool_sol_vault,
        &ctx.accounts.user,
        bump,
        &ctx.accounts.token_program,
        &ctx.accounts.system_program,
    )?;

    emit!(LiquidityRemoved {
        pool: ctx.accounts.pool.key(),
    });
    Ok(())
}

#[event]
pub struct LiquidityRemoved {
    pub pool: Pubkey,
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
        associated_token::mint = exchange_token_mint,
        associated_token::authority = pool
    )]
    pub pool_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = exchange_token_mint,
        associated_token::authority = user,
    )]
    pub user_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
