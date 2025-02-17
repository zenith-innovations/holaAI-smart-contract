use anchor_lang::{prelude::*, system_program};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
    Metadata,
};
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::errors::CustomError;
use crate::state::CurveConfiguration;

pub fn create_token(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    off_chain_id: String,
    uri: String,
) -> Result<()> {
    let name_ref = &name;
    let symbol_ref = &symbol;
    let off_chain_id_ref = &off_chain_id;
    let uri_ref = &uri;

    if ctx.accounts.dex_configuration_account.get_is_lockdown() == true {
        return err!(CustomError::Lockdown);
    }

    msg!("Creating token");
    msg!(
        "Fee sol collector: {}",
        ctx.accounts.fee_sol_collector.key()
    );
    msg!("Fee collector: {}", ctx.accounts.fee_collector.key());

    if ctx.accounts.dex_configuration_account.get_is_sol_fee() == true {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.fee_sol_collector.to_account_info(),
                },
            ),
            ctx.accounts.dex_configuration_account.get_creation_fees(),
        )?;
    } else {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_fee_token_account.to_account_info(),
                    to: ctx.accounts.fee_collector.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                }
            ),
            ctx.accounts.dex_configuration_account.get_creation_fees(),
        )?;
    }

    let decimals: u8 = 9;
    let amount = 1_000_000_000 * u64::pow(10, decimals as u32);

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

    create_metadata_accounts_v3(
        CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.user.to_account_info(),
                update_authority: ctx.accounts.user.to_account_info(),
                payer: ctx.accounts.user.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        ),
        DataV2 {
            name: name_ref.clone(),
            symbol: symbol_ref.clone(),
            uri: uri_ref.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false, // Is mutable
        false, // Update authority is signer
        None,  // Collection details
    )?;

    token::mint_to(cpi_ctx, amount)?;

    emit!(TokenCreated {
        mint: ctx.accounts.mint.key(),
        off_chain_id: off_chain_id_ref.clone(),
        name: name_ref.clone(),
        symbol: symbol_ref.clone(),
        total_supply: amount,
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

    // Thêm token account của user cho token fee
    #[account(
    mut,
    constraint = user_fee_token_account.owner == user.key()
    )]
    pub user_fee_token_account: Account<'info, TokenAccount>,

    /// CHECK: This account will be the mint authority
    pub mint_authority: UncheckedAccount<'info>,

    /// CHECK: Validate address by deriving pda
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CurveConfiguration::SEED.as_bytes()],
        bump,
    )]
    pub dex_configuration_account: Account<'info, CurveConfiguration>,

    /// CHECK:
    #[account(
        mut,
        constraint = dex_configuration_account.get_fee_sol_collector() == fee_sol_collector.key()
    )]
    pub fee_sol_collector: AccountInfo<'info>,

    /// CHECK:
    #[account(
        mut,
        constraint = dex_configuration_account.get_fee_collector() == fee_collector.key()
    )]
    pub fee_collector: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_metadata_program: Program<'info, Metadata>,
}
