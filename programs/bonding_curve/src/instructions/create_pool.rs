use crate::{errors::CustomError, state::*};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

pub fn create_pool(ctx: Context<CreateLiquidityPool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let dex_configuration_account = &mut ctx.accounts.dex_configuration_account;

    if dex_configuration_account.get_exchange_token_mint() != ctx.accounts.exchange_token_mint.key() {
        return err!(CustomError::InvalidExchangeTokenMint);
    }
    if dex_configuration_account.get_is_lockdown() == true {
        return err!(CustomError::Lockdown);
    }

    pool.set_inner(LiquidityPool::new(
        ctx.accounts.payer.key(),
        ctx.accounts.token_mint.key(),
        ctx.accounts.exchange_token_mint.key(),
        ctx.bumps.pool,
    ));
    emit!(PoolCreated {
        pool: ctx.accounts.pool.key(),
        token_mint: ctx.accounts.token_mint.key(),
    });
    Ok(())
}

#[event]
pub struct PoolCreated {
    pub pool: Pubkey,
    pub token_mint: Pubkey,
}

#[derive(Accounts)]
pub struct CreateLiquidityPool<'info> {
    #[account(
        init,
        space = LiquidityPool::ACCOUNT_SIZE,
        payer = payer,
        seeds = [LiquidityPool::POOL_SEED_PREFIX.as_bytes(), token_mint.key().as_ref(), exchange_token_mint.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, LiquidityPool>>,

    #[account(
        mut,
        seeds = [CurveConfiguration::SEED.as_bytes()],
        bump,
    )]
    pub dex_configuration_account: Box<Account<'info, CurveConfiguration>>,

    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub exchange_token_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = pool
    )]
    pub pool_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = exchange_token_mint,
        associated_token::authority = pool
    )]
    pub pool_exchange_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
