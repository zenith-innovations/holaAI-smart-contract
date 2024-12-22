use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use raydium_cp_swap::{
    cpi,
    program::RaydiumCpSwap,
    states::AmmConfig,
};

#[derive(Accounts)]
pub struct ProxyInitialize<'info> {
    pub cp_swap_program: Program<'info, RaydiumCpSwap>,
    /// Address paying to create the pool. Can be anyone
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Which config the pool belongs to.
    pub amm_config: Box<Account<'info, AmmConfig>>,

    /// CHECK: pool vault and lp mint authority
    #[account(mut)]
    pub authority: UncheckedAccount<'info>,

    /// CHECK: Initialize an account to store the pool state, init by cp-swap
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,

    /// Token_0 mint, the key must smaller then token_1 mint.
    #[account(mut)]
    pub token_0_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Token_1 mint, the key must grater then token_0 mint.
    #[account(mut)]
    pub token_1_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: pool lp mint, init by cp-swap
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,

    /// payer token0 account
    #[account(mut)]
    pub creator_token_0: Box<InterfaceAccount<'info, TokenAccount>>,

    /// creator token1 account
    #[account(mut)]
    pub creator_token_1: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: creator lp ATA token account, init by cp-swap
    #[account(mut)]
    pub creator_lp_token: UncheckedAccount<'info>,

    /// CHECK: Token_0 vault for the pool, init by cp-swap
    #[account(mut)]
    pub token_0_vault: UncheckedAccount<'info>,

    /// CHECK: Token_1 vault for the pool, init by cp-swap
    #[account(mut)]
    pub token_1_vault: UncheckedAccount<'info>,

    /// create pool fee account
    #[account(mut)]
    pub create_pool_fee: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: an account to store oracle observations, init by cp-swap
    #[account(mut)]
    pub observation_state: UncheckedAccount<'info>,

    /// Program to create mint account and mint tokens
    pub token_program: Program<'info, Token>,
    /// Spl token program or token program 2022
    pub token_0_program: Interface<'info, TokenInterface>,
    /// Spl token program or token program 2022
    pub token_1_program: Interface<'info, TokenInterface>,
    /// Program to create an ATA for receiving position NFT
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// Sysvar for program account
    pub rent: Sysvar<'info, Rent>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// To create a new program account
    pub system_program: Program<'info, System>,
}

pub fn proxy_initialize(
    ctx: Context<ProxyInitialize>,
    init_amount_0: u64,
    init_amount_1: u64,
    open_time: u64,
) -> Result<()> {
    msg!("Here");
    let cpi_accounts = cpi::accounts::Initialize {
        creator: ctx.accounts.creator.to_account_info(),
        amm_config: ctx.accounts.amm_config.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
        pool_state: ctx.accounts.pool_state.to_account_info(),
        token_0_mint: ctx.accounts.token_0_mint.to_account_info(),
        token_1_mint: ctx.accounts.token_1_mint.to_account_info(),
        lp_mint: ctx.accounts.lp_mint.to_account_info(),
        creator_token_0: ctx.accounts.creator_token_0.to_account_info(),
        creator_token_1: ctx.accounts.creator_token_1.to_account_info(),
        creator_lp_token: ctx.accounts.creator_lp_token.to_account_info(),
        token_0_vault: ctx.accounts.token_0_vault.to_account_info(),
        token_1_vault: ctx.accounts.token_1_vault.to_account_info(),
        create_pool_fee: ctx.accounts.create_pool_fee.to_account_info(),
        observation_state: ctx.accounts.observation_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        token_0_program: ctx.accounts.token_0_program.to_account_info(),
        token_1_program: ctx.accounts.token_1_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.cp_swap_program.to_account_info(), cpi_accounts);
    cpi::initialize(cpi_context, init_amount_0, init_amount_1, open_time)
}