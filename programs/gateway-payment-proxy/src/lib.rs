use anchor_lang::prelude::*;
use anchor_spl::{token::{Token, TokenAccount, Transfer}};
use solana_gateway::Gateway;

declare_id!("gpp77nzp35M7wfS4MofJPg3CLxqAuLa3XgKS7333Pg6");

pub fn validate_gateway_token(
    gateway_token_info: &AccountInfo,
    recipient_authority: &Pubkey,
    gatekeeper_network: &Pubkey,
) -> Result<()> {
    Gateway::verify_gateway_token_account_info(
        gateway_token_info,
        recipient_authority,
        gatekeeper_network,
            None

    ).map_err(|_| error!(ErrorCode::InvalidGatewayToken))
}

#[program]
pub mod gateway_payment_proxy {
    use super::*;

    pub fn transfer(ctx: Context<GatedTransfer>, amount: u64, gatekeeper_network: Pubkey) -> Result<()> {
        let recipient = &ctx.accounts.recipient;
        let gateway_token = ctx.accounts.gateway_token.to_account_info();
        validate_gateway_token(&gateway_token, &recipient.owner, &gatekeeper_network)?;

        let transfer_instruction = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: recipient.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        );
        anchor_spl::token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, gatekeeper_network: Pubkey)]
pub struct GatedTransfer<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut)]
    payer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    recipient: Account<'info, TokenAccount>,
    /// The recipient's gateway token
    ///  Must be a valid gateway token owned by the recipient
    /// CHECK: the derivation is checked in the gateway program.
    gateway_token: UncheckedAccount<'info>,
    #[account(address = spl_token::id())]
    token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Gateway Token")]
    InvalidGatewayToken
}