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

/// v1 only. Frozen. See `Publication` and `publish_publication`.
pub const BODY_MAX_BYTES: usize = 600;

/// v2. The on-chain blurb that stands in for the body — and, unlike the v1
/// excerpt, part of the hashed preimage, so it is permanent.
pub const EXCERPT_MAX_BYTES: usize = 280;

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

    /// Creates an immutable PublicationV2 account: the note body lives in
    /// Postgres, and only its digest is committed here.
    ///
    /// # Why the on-chain hash recomputation is gone
    ///
    /// `publish_publication` (v1) recomputes sha256 over the body and
    /// compares it to `content_hash`. This instruction cannot: it never sees
    /// the body. Stating the tradeoff plainly, because the v1 doc comment
    /// above promises a check that does not happen here:
    ///
    /// **Lost** — on-chain data availability. `content_hash` is now 32 bytes
    /// the platform authority asserted, and the chain cannot prove it is the
    /// hash of anything. Postgres becomes the source of truth for the note
    /// text; see ARCHITECTURE.md §2 and BACKUP_RECOVERY.md.
    ///
    /// **Not lost** — the integrity guarantee people actually rely on. This
    /// is still an immutable, publicly witnessed, slot-timestamped
    /// commitment: at this slot, under this publication id, the authority
    /// committed to this digest, and nobody (including the platform) can
    /// change it afterward. Serve a reader body B, and if
    /// sha256_v2(title, excerpt, B) equals the stored digest they know those
    /// exact bytes existed then and have not been substituted since.
    ///
    /// Worth being precise about how much the v1 recomputation was ever
    /// worth: `require_keys_eq!(authority, platform.authority)` means only
    /// the platform key can publish at all, so it never defended against a
    /// third party — it caught bugs in our own worker. That role is now held
    /// by the worker's pre-submit check and by live verification on read.
    ///
    /// # Hash preimage (permanent — do not change)
    ///
    /// ```text
    /// sha256( "noteschain/pub/v2"
    ///       || u32le(len(title))   || title
    ///       || u32le(len(excerpt)) || excerpt
    ///       || u32le(len(content)) || content )
    /// ```
    ///
    /// Length-prefixed rather than v1's 0x1E separator, which is not safe
    /// once a body can be 20,000 characters of pasted text containing 0x1E.
    /// Must stay byte-identical to `computeContentHashV2` in
    /// packages/blockchain-client/src/hash.ts.
    #[allow(clippy::too_many_arguments)]
    pub fn publish_publication_v2(
        ctx: Context<PublishPublicationV2>,
        publication_id: u64,
        identity_mode: u8,
        discoverability: u8,
        identity_reference_hash: [u8; 32],
        content_hash: [u8; 32],
        content_length: u64,
        title: String,
        author_display_snapshot: String,
        excerpt: String,
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
        require!(excerpt.len() <= EXCERPT_MAX_BYTES, NotesChainError::ExcerptTooLong);

        // The body is off-chain, so these are the only sanity checks left on
        // the commitment itself: an all-zero digest or a zero-length body
        // means a caller forgot to populate them.
        require!(content_hash != [0u8; 32], NotesChainError::MissingContentHash);
        require!(content_length > 0, NotesChainError::EmptyContent);

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

        // A revision may point at either schema, so this cannot be an
        // `Account<'info, PublicationV2>` — that would silently reject every
        // v1 predecessor. The checks below are exactly what Anchor's typed
        // wrapper was doing implicitly, just spelled out.
        match (previous_publication, &ctx.accounts.previous_publication_account) {
            (Some(expected), Some(prev_account)) => {
                require_keys_eq!(
                    prev_account.key(),
                    expected,
                    NotesChainError::InvalidPreviousPublication
                );
                require_keys_eq!(
                    *prev_account.owner,
                    crate::ID,
                    NotesChainError::InvalidPreviousPublication
                );
                let data = prev_account.try_borrow_data()?;
                require!(data.len() >= 8, NotesChainError::InvalidPreviousPublication);
                let discriminator = &data[..8];
                require!(
                    discriminator == Publication::DISCRIMINATOR
                        || discriminator == PublicationV2::DISCRIMINATOR,
                    NotesChainError::InvalidPreviousPublication
                );
            }
            (None, None) => {}
            _ => return err!(NotesChainError::InvalidPreviousPublication),
        }

        let publication = &mut ctx.accounts.publication;
        publication.version = 2;
        publication.publication_id = publication_id;
        publication.identity_mode = identity_mode;
        publication.discoverability = discoverability;
        publication.published_at = Clock::get()?.unix_timestamp;
        publication.previous_publication = previous_publication;
        publication.identity_reference_hash = identity_reference_hash;
        publication.content_hash = content_hash;
        publication.content_length = content_length;
        publication.title = title;
        publication.author_display_snapshot = author_display_snapshot;
        publication.excerpt = excerpt;
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

/// v2 publication. A separate account type rather than extra fields on
/// `Publication`, for two reasons:
///
///   * Borsh account layout is positional with no trailing-optional, so
///     appending a field to `Publication` would make every already-written
///     account fail to deserialize with "unexpected EOF".
///   * Two structs give two Anchor-generated decoders, each with its own
///     discriminator, so v1 accounts keep decoding exactly as before.
///
/// The one thing NOT to do here is reuse `Publication.content` to hold the
/// excerpt: every existing reader would treat a 280-byte blurb as the full
/// note body.
#[account]
pub struct PublicationV2 {
    pub version: u8,
    pub publication_id: u64,
    pub identity_mode: u8,
    pub discoverability: u8,
    pub published_at: i64,
    pub previous_publication: Option<Pubkey>,
    pub identity_reference_hash: [u8; 32],
    pub content_hash: [u8; 32],
    /// UTF-8 byte length of the off-chain body. Makes the record
    /// self-describing and gives verifiers a cheap pre-check before they
    /// fetch and hash the content.
    pub content_length: u64,
    pub title: String,
    pub author_display_snapshot: String,
    pub excerpt: String,
    pub bump: u8,
}

impl PublicationV2 {
    /// 575 bytes against v1's 887 — the body no longer being on-chain makes a
    /// v2 account ~31% cheaper in rent. The bigger win is transaction size:
    /// v1's 600-byte body cap existed because title + display + body had to
    /// fit inside Solana's hard 1232-byte packet limit alongside signatures
    /// and account keys. Moving the body off-chain is what makes an
    /// effectively unlimited note length possible at all.
    pub const MAX_SPACE: usize = 8 // discriminator
        + 1 // version
        + 8 // publication_id
        + 1 // identity_mode
        + 1 // discoverability
        + 8 // published_at
        + (1 + 32) // Option<Pubkey>
        + 32 // identity_reference_hash
        + 32 // content_hash
        + 8 // content_length
        + (4 + TITLE_MAX_BYTES)
        + (4 + AUTHOR_DISPLAY_MAX_BYTES)
        + (4 + EXCERPT_MAX_BYTES)
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

#[derive(Accounts)]
#[instruction(publication_id: u64)]
pub struct PublishPublicationV2<'info> {
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,

    /// Same seeds as v1 on purpose. The PDA derives from seeds and program id
    /// only — `space` is not an input — so the two schemas share one
    /// monotone id space under the single `publication_counter`, which is the
    /// invariant ARCHITECTURE.md §3.1 rests on. A v2-specific seed would fork
    /// that id space and break it.
    #[account(
        init,
        payer = authority,
        space = PublicationV2::MAX_SPACE,
        seeds = [PUBLICATION_SEED, publication_id.to_le_bytes().as_ref()],
        bump
    )]
    pub publication: Account<'info, PublicationV2>,

    /// Unchecked because a revision may point at a v1 or a v2 account and a
    /// typed `Account<'info, _>` can only be one of them. The handler does
    /// the owner, discriminator, and key checks explicitly.
    /// CHECK: validated in the handler — owner == this program, discriminator
    /// is one of the two Publication types, key matches the claimed pubkey.
    pub previous_publication_account: Option<UncheckedAccount<'info>>,

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
    #[msg("Excerpt exceeds the maximum allowed size.")]
    ExcerptTooLong,
    #[msg("Content hash must not be all zeroes.")]
    MissingContentHash,
    #[msg("Content length must be greater than zero.")]
    EmptyContent,
}
