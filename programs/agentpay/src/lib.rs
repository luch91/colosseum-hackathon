use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");

pub const MARKETPLACE_SEED: &[u8] = b"marketplace";
pub const SERVICE_SEED: &[u8] = b"service";
pub const PAYMENT_SEED: &[u8] = b"payment";

pub const MAX_NAME_LEN: usize = 50;
pub const MAX_ENDPOINT_LEN: usize = 200;
pub const MAX_DESC_LEN: usize = 200;

#[program]
pub mod agentpay {
    use super::*;

    /// Initialize the marketplace. Called once by the admin.
    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1000, AgentPayError::FeeTooHigh); // max 10%

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.admin = ctx.accounts.admin.key();
        marketplace.fee_bps = fee_bps;
        marketplace.total_services = 0;
        marketplace.total_volume = 0;
        marketplace.bump = ctx.bumps.marketplace;

        emit!(MarketplaceInitialized {
            admin: ctx.accounts.admin.key(),
            fee_bps,
        });

        Ok(())
    }

    /// Register a new API service on the marketplace.
    pub fn register_service(
        ctx: Context<RegisterService>,
        name: String,
        endpoint: String,
        description: String,
        price_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME_LEN, AgentPayError::NameTooLong);
        require!(endpoint.len() <= MAX_ENDPOINT_LEN, AgentPayError::EndpointTooLong);
        require!(description.len() <= MAX_DESC_LEN, AgentPayError::DescriptionTooLong);
        require!(price_lamports > 0, AgentPayError::InvalidPrice);

        let service = &mut ctx.accounts.service;
        service.provider = ctx.accounts.provider.key();
        service.name = name.clone();
        service.endpoint = endpoint;
        service.description = description;
        service.price_lamports = price_lamports;
        service.calls_served = 0;
        service.active = true;
        service.bump = ctx.bumps.service;

        ctx.accounts.marketplace.total_services = ctx
            .accounts
            .marketplace
            .total_services
            .checked_add(1)
            .ok_or(AgentPayError::Overflow)?;

        emit!(ServiceRegistered {
            provider: ctx.accounts.provider.key(),
            name,
            price_lamports,
        });

        Ok(())
    }

    /// Update the price of an existing service. Provider only.
    pub fn update_service_price(ctx: Context<UpdateService>, new_price: u64) -> Result<()> {
        require!(new_price > 0, AgentPayError::InvalidPrice);
        ctx.accounts.service.price_lamports = new_price;
        Ok(())
    }

    /// Toggle service active/inactive. Provider only.
    pub fn toggle_service(ctx: Context<UpdateService>) -> Result<()> {
        let service = &mut ctx.accounts.service;
        service.active = !service.active;
        Ok(())
    }

    /// Pay for one service call. Creates a PaymentRecord PDA as proof.
    /// The request_hash must be unique per call (hash of URL + body + nonce).
    pub fn pay_for_service(
        ctx: Context<PayForService>,
        request_hash: [u8; 32],
    ) -> Result<()> {
        // Read all values from service upfront — avoids borrow conflicts when mutating later
        require!(ctx.accounts.service.active, AgentPayError::ServiceInactive);
        let price = ctx.accounts.service.price_lamports;
        let service_key = ctx.accounts.service.key();

        let fee_bps = ctx.accounts.marketplace.fee_bps as u64;
        let fee = price
            .checked_mul(fee_bps)
            .ok_or(AgentPayError::Overflow)?
            .checked_div(10_000)
            .ok_or(AgentPayError::Overflow)?;
        let provider_amount = price.checked_sub(fee).ok_or(AgentPayError::Overflow)?;

        // Transfer provider share
        system_program::transfer(
            CpiContext::new(
                *ctx.accounts.system_program.key,
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.provider.to_account_info(),
                },
            ),
            provider_amount,
        )?;

        // Transfer marketplace fee to admin (skip if zero)
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    *ctx.accounts.system_program.key,
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.admin.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Record payment — PDA prevents replay attacks
        let record = &mut ctx.accounts.payment_record;
        record.service = service_key;
        record.payer = ctx.accounts.payer.key();
        record.amount = price;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.used = false;
        record.request_hash = request_hash;
        record.bump = ctx.bumps.payment_record;

        // Update stats
        ctx.accounts.service.calls_served = ctx
            .accounts
            .service
            .calls_served
            .checked_add(1)
            .ok_or(AgentPayError::Overflow)?;

        ctx.accounts.marketplace.total_volume = ctx
            .accounts
            .marketplace
            .total_volume
            .checked_add(price)
            .ok_or(AgentPayError::Overflow)?;

        emit!(PaymentMade {
            service: service_key,
            payer: ctx.accounts.payer.key(),
            amount: price,
            request_hash,
        });

        Ok(())
    }

    /// Mark a payment record as used. Called by the provider after verifying
    /// and serving the response. Prevents the same proof being replayed.
    pub fn consume_payment(ctx: Context<ConsumePayment>) -> Result<()> {
        let record = &mut ctx.accounts.payment_record;
        require!(!record.used, AgentPayError::PaymentAlreadyUsed);
        record.used = true;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account structs
// ---------------------------------------------------------------------------

#[account]
pub struct Marketplace {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub total_services: u64,
    pub total_volume: u64,
    pub bump: u8,
}

impl Marketplace {
    // discriminator(8) + admin(32) + fee_bps(2) + total_services(8) + total_volume(8) + bump(1)
    pub const LEN: usize = 8 + 32 + 2 + 8 + 8 + 1;
}

#[account]
pub struct Service {
    pub provider: Pubkey,
    pub name: String,
    pub endpoint: String,
    pub description: String,
    pub price_lamports: u64,
    pub calls_served: u64,
    pub active: bool,
    pub bump: u8,
}

impl Service {
    // discriminator(8) + provider(32) + name(4+50) + endpoint(4+200) + description(4+200)
    // + price_lamports(8) + calls_served(8) + active(1) + bump(1)
    pub const LEN: usize = 8 + 32 + (4 + MAX_NAME_LEN) + (4 + MAX_ENDPOINT_LEN) + (4 + MAX_DESC_LEN) + 8 + 8 + 1 + 1;
}

#[account]
pub struct PaymentRecord {
    pub service: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub used: bool,
    pub request_hash: [u8; 32],
    pub bump: u8,
}

impl PaymentRecord {
    // discriminator(8) + service(32) + payer(32) + amount(8) + timestamp(8)
    // + used(1) + request_hash(32) + bump(1)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 32 + 1;
}

// ---------------------------------------------------------------------------
// Instruction contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = Marketplace::LEN,
        seeds = [MARKETPLACE_SEED],
        bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, endpoint: String, description: String, price_lamports: u64)]
pub struct RegisterService<'info> {
    #[account(
        init,
        payer = provider,
        space = Service::LEN,
        seeds = [SERVICE_SEED, provider.key().as_ref()],
        bump,
    )]
    pub service: Account<'info, Service>,
    #[account(
        mut,
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateService<'info> {
    #[account(
        mut,
        seeds = [SERVICE_SEED, provider.key().as_ref()],
        bump = service.bump,
        has_one = provider,
    )]
    pub service: Account<'info, Service>,
    pub provider: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(request_hash: [u8; 32])]
pub struct PayForService<'info> {
    #[account(
        init,
        payer = payer,
        space = PaymentRecord::LEN,
        seeds = [
            PAYMENT_SEED,
            service.key().as_ref(),
            payer.key().as_ref(),
            request_hash.as_ref(),
        ],
        bump,
    )]
    pub payment_record: Account<'info, PaymentRecord>,
    #[account(
        mut,
        seeds = [SERVICE_SEED, provider.key().as_ref()],
        bump = service.bump,
        has_one = provider,
    )]
    pub service: Account<'info, Service>,
    #[account(
        mut,
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
    )]
    pub marketplace: Account<'info, Marketplace>,
    /// CHECK: Receives payment — verified via service.provider constraint above
    #[account(mut, address = service.provider)]
    pub provider: UncheckedAccount<'info>,
    /// CHECK: Receives fee — verified via marketplace.admin
    #[account(mut, address = marketplace.admin)]
    pub admin: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConsumePayment<'info> {
    #[account(
        mut,
        seeds = [
            PAYMENT_SEED,
            service.key().as_ref(),
            payment_record.payer.as_ref(),
            payment_record.request_hash.as_ref(),
        ],
        bump = payment_record.bump,
        has_one = service,
    )]
    pub payment_record: Account<'info, PaymentRecord>,
    #[account(
        seeds = [SERVICE_SEED, provider.key().as_ref()],
        bump = service.bump,
        has_one = provider,
    )]
    pub service: Account<'info, Service>,
    pub provider: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct MarketplaceInitialized {
    pub admin: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct ServiceRegistered {
    pub provider: Pubkey,
    pub name: String,
    pub price_lamports: u64,
}

#[event]
pub struct PaymentMade {
    pub service: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub request_hash: [u8; 32],
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum AgentPayError {
    #[msg("Fee cannot exceed 10% (1000 bps)")]
    FeeTooHigh,
    #[msg("Service name is too long (max 50 chars)")]
    NameTooLong,
    #[msg("Endpoint URL is too long (max 200 chars)")]
    EndpointTooLong,
    #[msg("Description is too long (max 200 chars)")]
    DescriptionTooLong,
    #[msg("Price must be greater than 0")]
    InvalidPrice,
    #[msg("Service is not currently active")]
    ServiceInactive,
    #[msg("This payment has already been consumed")]
    PaymentAlreadyUsed,
    #[msg("Arithmetic overflow")]
    Overflow,
}
