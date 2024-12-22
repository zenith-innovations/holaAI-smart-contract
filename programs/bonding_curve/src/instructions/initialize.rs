use crate::{errors::CustomError, state::*};
use anchor_lang::prelude::*;

pub fn initialize(
    ctx: Context<InitializeCurveConfiguration>,
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
    let dex_config = &mut ctx.accounts.dex_configuration_account;

    if fee_percentage < 1 || fee_percentage > 10000 {
        return err!(CustomError::InvalidFee);
    }

    dex_config.set_inner(CurveConfiguration::new(
        fee_percentage,
        creation_fees,
        proportion,
        fee_collector,
        fee_sol_collector,
        exchange_token_mint,
        ctx.accounts.admin.key(),
        initial_token_for_pool,
        is_sol_fee,
        is_lockdown,
    ));

    emit!(CreateConfigurationEvent {
        fee_percentage: fee_percentage as u64,
        creation_fees,
        proportion,
        initial_token_for_pool,
        fee_collector,
        fee_sol_collector,
        exchange_token_mint,
        is_sol_fee,
        is_lockdown,
    });

    Ok(())
}

pub fn update_configuration(
    ctx: Context<UpdateConfiguration>,
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
    let dex_config = &mut ctx.accounts.dex_configuration_account;

    dex_config.update_configuration(
        fee_percentage,
        creation_fees,
        proportion,
        fee_collector,
        fee_sol_collector,
        exchange_token_mint,
        initial_token_for_pool,
        is_sol_fee,
        is_lockdown,
    )?;

    emit!(UpdateConfigurationEvent {
        fee_percentage,
        creation_fees,
        proportion,
        initial_token_for_pool,
        fee_collector,
        fee_sol_collector,
        exchange_token_mint,
        is_sol_fee,
        is_lockdown,
    });

    Ok(())
}

#[event]
pub struct UpdateConfigurationEvent {
    pub fee_percentage: u64,
    pub creation_fees: u64,
    pub proportion: f64,
    pub initial_token_for_pool: u64,
    pub fee_collector: Pubkey,
    pub fee_sol_collector: Pubkey,
    pub exchange_token_mint: Pubkey,
    pub is_sol_fee: bool,
    pub is_lockdown: bool,
}

#[event]
pub struct CreateConfigurationEvent {
    pub fee_percentage: u64,
    pub creation_fees: u64,
    pub proportion: f64,
    pub initial_token_for_pool: u64,
    pub fee_collector: Pubkey,
    pub fee_sol_collector: Pubkey,
    pub exchange_token_mint: Pubkey,
    pub is_sol_fee: bool,
    pub is_lockdown: bool,
}

#[derive(Accounts)]
pub struct InitializeCurveConfiguration<'info> {
    #[account(
        init,
        space = CurveConfiguration::ACCOUNT_SIZE,
        payer = admin,
        seeds = [CurveConfiguration::SEED.as_bytes()],
        bump,
    )]
    pub dex_configuration_account: Box<Account<'info, CurveConfiguration>>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfiguration<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub dex_configuration_account: Box<Account<'info, CurveConfiguration>>,
}
