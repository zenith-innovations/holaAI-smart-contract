use crate::{errors::CustomError, state::*};
use anchor_lang::prelude::*;

pub fn initialize(
    ctx: Context<InitializeCurveConfiguration>,
    fee_percentage: u64,
    creation_fees: u64,
    proportion: f64,
    fee_collector: Pubkey,
    fee_sol_collector: Pubkey,
    initial_token_for_pool: u64,
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
        ctx.accounts.admin.key(),
        initial_token_for_pool,
    ));

    emit!(CreateConfigurationEvent {
        fee_percentage: fee_percentage as u64,
        creation_fees,
        proportion,
        initial_token_for_pool,
        fee_collector,
        fee_sol_collector,
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
    initial_token_for_pool: u64,
) -> Result<()> {
    let dex_config = &mut ctx.accounts.dex_configuration_account;

    dex_config.update_configuration(
        fee_percentage,
        creation_fees,
        proportion,
        fee_collector,
        fee_sol_collector,
        initial_token_for_pool,
    )?;

    emit!(UpdateConfigurationEvent {
        fee_percentage,
        creation_fees,
        proportion,
        initial_token_for_pool,
        fee_collector,
        fee_sol_collector,
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
}

#[event]
pub struct CreateConfigurationEvent {
    pub fee_percentage: u64,
    pub creation_fees: u64,
    pub proportion: f64,
    pub initial_token_for_pool: u64,
    pub fee_collector: Pubkey,
    pub fee_sol_collector: Pubkey,
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
