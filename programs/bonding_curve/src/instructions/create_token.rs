use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;

use crate::errors::CustomError;

pub fn create_token(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    off_chain_id: String,
) -> Result<()> {
    let decimals: u8 = 9;

    let amount = 1_000_000_000 * u64::pow(10, decimals as u32);
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

    token::mint_to(cpi_ctx, amount).map_err(|_| CustomError::MintFailed)?;

    emit!(TokenCreated {
        mint: ctx.accounts.mint.key(),
        off_chain_id: off_chain_id,
        total_supply: amount,
        name: name,
        symbol: symbol,
    });
    
    Ok(())
}

#[event]
pub struct TokenCreated {
    pub mint: Pubkey,
    pub off_chain_id: String,
    pub name: String,
    pub symbol: String,
    pub total_supply: u64,
}


#[derive(Accounts)]
#[instruction(name: String, symbol: String, off_chain_id: String)]
pub struct CreateToken<'info> {
    #[account(
        init,
        payer = user,
        mint::decimals = 9,
        mint::authority = user,
        mint::freeze_authority = user,
        seeds = [b"mint", user.key().as_ref(), off_chain_id.as_bytes()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
