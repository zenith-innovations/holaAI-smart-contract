use std::str::FromStr;

use anchor_lang::prelude::*;
use raydium_cp_swap::states::{AmmConfig, AMM_CONFIG_SEED};
use solana_program::{instruction::Instruction, program::invoke_signed};

#[derive(Accounts)]
#[instruction(index: u16)]
pub struct CreateAmmConfig<'info> {
    /// Address to be set as protocol owner.
    #[account(mut)]
    pub owner: Signer<'info>,

    ///CHECK:ẠHCJS
    #[account(
        seeds = [
            AMM_CONFIG_SEED.as_bytes(),
            &index.to_be_bytes()
        ],
        bump,
    )]
    pub amm_config: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn proxy_create_amm_config(
    ctx: Context<CreateAmmConfig>,
    index: u16,
    trade_fee_rate: u64,
    protocol_fee_rate: u64,
    fund_fee_rate: u64,
    create_pool_fee: u64,
    bump: u8,
) -> Result<()> {
    msg!(&ctx.accounts.system_program.key().to_string());
    let account_ints = vec![
        AccountMeta::new(ctx.accounts.owner.key(), true),
        AccountMeta::new(ctx.accounts.amm_config.key(), false),
        AccountMeta::new(ctx.accounts.system_program.key(), false),
    ];
    let ix_data =
        anchor_lang::InstructionData::data(&raydium_cp_swap::instruction::CreateAmmConfig {
            index,
            trade_fee_rate,
            protocol_fee_rate,
            fund_fee_rate,
            create_pool_fee,
        });
    invoke_signed(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: Pubkey::from_str("CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW").unwrap(),
            accounts: account_ints,
            data: ix_data,
        },
        &[
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.amm_config.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[&[
            b"amm_config",        // AMM_CONFIG_SEED
            &index.to_be_bytes(), // index seed
        ]],
    )?;
    Ok(())
}
