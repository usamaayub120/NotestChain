//! NotesChain's on-chain program. Deliberately small — see ARCHITECTURE.md
//! §7 and the product spec §10. Three instructions only:
//!   initialize_platform, publish_publication, rotate_authority.
//! No update_publication, delete_publication, or close_publication —
//! publications are immutable once written; a revision is a new account
//! that references the old one via `previous_publication`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash as sha256_hash;

declare_id!("exQDCAihgmrV4FNPpuQXrFXp2pvKUumntCfantzc5GX");

pub const PLATFORM_SEED: &[u8] = b"platform";
pub const PUBLICATION_SEED: &[u8] = b"publication";

pub const TITLE_MAX_BYTES: usize = 100;
pub const AUTHOR_DISPLAY_MAX_BYTES: usize = 50;
pub const BODY_MAX_BYTES: usize = 600;

/// Separator byte between title and content in the hash preimage — must
/// stay byte-for-byte identical to
/// packages/blockchain-client/src/hash.ts's FIELD_SEPARATOR (0x1E), or the
/// off-chain and on-chain hashes will never match.
const HASH_FIELD_SEPARATOR: u8 = 0x1e;

#[program]
pub mod decentralized_notes {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>, treasury: Pubkey) -> Result<()> {
        let platform = &mut ctx.accounts.platform_config;
        platform.version = 1;
        platform.authority = ctx.accounts.authority.key();
        platform.treasury = treasury;
        platform.publication_counter = 0;
        platform.bump = ctx.bumps.platform_config;
        Ok(())
    }

    /// Current authority only. Does not revoke or transfer program
    /// upgrade authority — that is a separate, deliberately manual
    /// operation (see ARCHITECTURE.md / README production notes).
    pub fn rotate_authority(ctx: Context<RotateAuthority>, new_authority: Pubkey) -> Result<()> {
        let platform = &mut ctx.accounts.platform_config;
        require_keys_eq!(
            ctx.accounts.authority.key(),
            platform.authority,
            NotesChainError::Unauthorized
        );
        require_keys_neq!(new_authority, Pubkey::default(), NotesChainError::InvalidAuthority);
        platform.authority = new_authority;
        Ok(())
    }

    /// Creates a new, immutable Publication account. The program — not the
    /// client — is the authority on `publication_id`: it must equal the
    /// live `platform_config.publication_counter` at execution time (not
    /// submission time), which is what makes this safe under retries or
    /// concurrent submitters (see ARCHITECTURE.md §3.1). A stale counter
    /// fails the whole instruction harmlessly; the caller re-reads the
    /// counter and retries.
    #[allow(clippy::too_many_arguments)]
    pub fn publish_publication(
        ctx: Context<PublishPublication>,
        publication_id: u64,
        identity_mode: u8,
        discoverability: u8,
        identity_reference_hash: [u8; 32],
        content_hash: [u8; 32],
        title: String,
        author_display_snapshot: String,
        content: String,
        previous_publication: Option<Pubkey>,
    ) -> Result<()> {
        let platform = &mut ctx.accounts.platform_config;

        require_keys_eq!(
            ctx.accounts.authority.key(),
            platform.authority,
            NotesChainError::Unauthorized
        );
        require_eq!(
            publication_id,
            platform.publication_counter,
            NotesChainError::StalePublicationCounter
        );

        require!(title.len() <= TITLE_MAX_BYTES, NotesChainError::TitleTooLong);
        require!(
            author_display_snapshot.len() <= AUTHOR_DISPLAY_MAX_BYTES,
            NotesChainError::AuthorDisplayTooLong
        );
        require!(content.len() <= BODY_MAX_BYTES, NotesChainError::ContentTooLong);

        let mode = IdentityMode::from_u8(identity_mode).ok_or(NotesChainError::InvalidIdentityMode)?;
        Discoverability::from_u8(discoverability).ok_or(NotesChainError::InvalidDiscoverability)?;

        match mode {
            IdentityMode::Anonymous => {
                require!(
                    identity_reference_hash == [0u8; 32],
                    NotesChainError::AnonymousHashMustBeZero
                );
                require!(
                    author_display_snapshot.is_empty(),
                    NotesChainError::AnonymousDisplayMustBeEmpty
                );
            }
            IdentityMode::Named | IdentityMode::Pseudonymous => {
                require!(
                    identity_reference_hash != [0u8; 32],
                    NotesChainError::MissingIdentityReference
                );
            }
        }

        // Recompute the content hash on-chain rather than trusting the
        // caller — the whole point of storing a hash is that it's
        // independently verifiable, including by this program itself.
        let mut preimage = Vec::with_capacity(title.len() + 1 + content.len());
        preimage.extend_from_slice(title.as_bytes());
        preimage.push(HASH_FIELD_SEPARATOR);
        preimage.extend_from_slice(content.as_bytes());
        let computed_hash = sha256_hash(&preimage);
        require!(
            computed_hash.to_bytes() == content_hash,
            NotesChainError::ContentHashMismatch
        );

        match (previous_publication, &ctx.accounts.previous_publication_account) {
            (Some(expected), Some(prev_account)) => {
                // Account<'info, Publication> deserialization already proved
                // this is a real Publication owned by this program; we only
                // need to confirm it's the specific one the caller claimed.
                require_keys_eq!(
                    prev_account.key(),
                    expected,
                    NotesChainError::InvalidPreviousPublication
                );
            }
            (None, None) => {}
            _ => return err!(NotesChainError::InvalidPreviousPublication),
        }

        let publication = &mut ctx.accounts.publication;
        publication.version = 1;
        publication.publication_id = publication_id;
        publication.identity_mode = identity_mode;
        publication.discoverability = discoverability;
        publication.published_at = Clock::get()?.unix_timestamp;
        publication.previous_publication = previous_publication;
        publication.identity_reference_hash = identity_reference_hash;
        publication.content_hash = content_hash;
        publication.title = title;
        publication.author_display_snapshot = author_display_snapshot;
        publication.content = content;
        publication.bump = ctx.bumps.publication;

        platform.publication_counter = platform
            .publication_counter
            .checked_add(1)
            .ok_or(NotesChainError::CounterOverflow)?;

        Ok(())
    }
}

#[account]
pub struct PlatformConfig {
    pub version: u8,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub publication_counter: u64,
    pub bump: u8,
}

impl PlatformConfig {
    pub const SPACE: usize = 8 // discriminator
        + 1 // version
        + 32 // authority
        + 32 // treasury
        + 8 // publication_counter
        + 1; // bump
}

#[account]
pub struct Publication {
    pub version: u8,
    pub publication_id: u64,
    pub identity_mode: u8,
    pub discoverability: u8,
    pub published_at: i64,
    pub previous_publication: Option<Pubkey>,
    pub identity_reference_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub title: String,
    pub author_display_snapshot: String,
    pub content: String,
    pub bump: u8,
}

impl Publication {
    /// Always allocated at the maximum possible size for the byte limits
    /// above, rather than sized to the actual content — simpler and more
    /// predictable than reallocating, and the rent difference is trivial
    /// at these sizes (notes are short by design).
    pub const MAX_SPACE: usize = 8 // discriminator
        + 1 // version
        + 8 // publication_id
        + 1 // identity_mode
        + 1 // discoverability
        + 8 // published_at
        + (1 + 32) // Option<Pubkey>
        + 32 // identity_reference_hash
        + 32 // content_hash
        + (4 + TITLE_MAX_BYTES)
        + (4 + AUTHOR_DISPLAY_MAX_BYTES)
        + (4 + BODY_MAX_BYTES)
        + 1; // bump
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum IdentityMode {
    Named = 0,
    Pseudonymous = 1,
    Anonymous = 2,
}

impl IdentityMode {
    fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Named),
            1 => Some(Self::Pseudonymous),
            2 => Some(Self::Anonymous),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Discoverability {
    Public = 0,
    Unlisted = 1,
}

impl Discoverability {
    fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Public),
            1 => Some(Self::Unlisted),
            _ => None,
        }
    }
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = PlatformConfig::SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RotateAuthority<'info> {
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(publication_id: u64)]
pub struct PublishPublication<'info> {
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        init,
        payer = authority,
        space = Publication::MAX_SPACE,
        seeds = [PUBLICATION_SEED, publication_id.to_le_bytes().as_ref()],
        bump
    )]
    pub publication: Account<'info, Publication>,

    /// Present only when this publication is a revision of an earlier one.
    /// Anchor's `Account<'info, Publication>` deserialization already
    /// proves it's a real, program-owned Publication; the handler only
    /// needs to check it's the *specific* one the caller claimed.
    pub previous_publication_account: Option<Account<'info, Publication>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum NotesChainError {
    #[msg("Only the platform authority may perform this action.")]
    Unauthorized,
    #[msg("New authority must not be the default/zero pubkey.")]
    InvalidAuthority,
    #[msg("The provided publication id no longer matches the platform counter; refetch and retry.")]
    StalePublicationCounter,
    #[msg("Title exceeds the maximum allowed size.")]
    TitleTooLong,
    #[msg("Author display name exceeds the maximum allowed size.")]
    AuthorDisplayTooLong,
    #[msg("Body content exceeds the maximum allowed size.")]
    ContentTooLong,
    #[msg("Invalid identity mode.")]
    InvalidIdentityMode,
    #[msg("Invalid discoverability mode.")]
    InvalidDiscoverability,
    #[msg("Anonymous publications must have a zero-filled identity reference hash.")]
    AnonymousHashMustBeZero,
    #[msg("Anonymous publications must have an empty author display snapshot.")]
    AnonymousDisplayMustBeEmpty,
    #[msg("Named or pseudonymous publications must include an identity reference hash.")]
    MissingIdentityReference,
    #[msg("The supplied content hash does not match the recomputed hash of title and content.")]
    ContentHashMismatch,
    #[msg("previous_publication does not match the account supplied to this instruction.")]
    InvalidPreviousPublication,
    #[msg("Publication counter overflow.")]
    CounterOverflow,
}
