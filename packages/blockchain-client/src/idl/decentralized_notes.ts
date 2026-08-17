/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/decentralized_notes.json`.
 */
export type DecentralizedNotes = {
  "address": "exQDCAihgmrV4FNPpuQXrFXp2pvKUumntCfantzc5GX",
  "metadata": {
    "name": "decentralizedNotes",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "NotesChain — permanent, verifiable publication records on Solana"
  },
  "instructions": [
    {
      "name": "initializePlatform",
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "publishPublication",
      "docs": [
        "Creates a new, immutable Publication account. The program — not the",
        "client — is the authority on `publication_id`: it must equal the",
        "live `platform_config.publication_counter` at execution time (not",
        "submission time), which is what makes this safe under retries or",
        "concurrent submitters (see ARCHITECTURE.md §3.1). A stale counter",
        "fails the whole instruction harmlessly; the caller re-reads the",
        "counter and retries."
      ],
      "discriminator": [
        250,
        156,
        220,
        196,
        84,
        17,
        76,
        235
      ],
      "accounts": [
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "publication",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  98,
                  108,
                  105,
                  99,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "publicationId"
              }
            ]
          }
        },
        {
          "name": "previousPublicationAccount",
          "docs": [
            "Present only when this publication is a revision of an earlier one.",
            "Anchor's `Account<'info, Publication>` deserialization already",
            "proves it's a real, program-owned Publication; the handler only",
            "needs to check it's the *specific* one the caller claimed."
          ],
          "optional": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "publicationId",
          "type": "u64"
        },
        {
          "name": "identityMode",
          "type": "u8"
        },
        {
          "name": "discoverability",
          "type": "u8"
        },
        {
          "name": "identityReferenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "authorDisplaySnapshot",
          "type": "string"
        },
        {
          "name": "content",
          "type": "string"
        },
        {
          "name": "previousPublication",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "publishPublicationV2",
      "docs": [
        "Creates an immutable PublicationV2 account: the note body lives in",
        "Postgres, and only its digest is committed here.",
        "",
        "# Why the on-chain hash recomputation is gone",
        "",
        "`publish_publication` (v1) recomputes sha256 over the body and",
        "compares it to `content_hash`. This instruction cannot: it never sees",
        "the body. Stating the tradeoff plainly, because the v1 doc comment",
        "above promises a check that does not happen here:",
        "",
        "**Lost** — on-chain data availability. `content_hash` is now 32 bytes",
        "the platform authority asserted, and the chain cannot prove it is the",
        "hash of anything. Postgres becomes the source of truth for the note",
        "text; see ARCHITECTURE.md §2 and BACKUP_RECOVERY.md.",
        "",
        "**Not lost** — the integrity guarantee people actually rely on. This",
        "is still an immutable, publicly witnessed, slot-timestamped",
        "commitment: at this slot, under this publication id, the authority",
        "committed to this digest, and nobody (including the platform) can",
        "change it afterward. Serve a reader body B, and if",
        "sha256_v2(title, excerpt, B) equals the stored digest they know those",
        "exact bytes existed then and have not been substituted since.",
        "",
        "Worth being precise about how much the v1 recomputation was ever",
        "worth: `require_keys_eq!(authority, platform.authority)` means only",
        "the platform key can publish at all, so it never defended against a",
        "third party — it caught bugs in our own worker. That role is now held",
        "by the worker's pre-submit check and by live verification on read.",
        "",
        "# Hash preimage (permanent — do not change)",
        "",
        "```text",
        "sha256( \"noteschain/pub/v2\"",
        "|| u32le(len(title))   || title",
        "|| u32le(len(excerpt)) || excerpt",
        "|| u32le(len(content)) || content )",
        "```",
        "",
        "Length-prefixed rather than v1's 0x1E separator, which is not safe",
        "once a body can be 20,000 characters of pasted text containing 0x1E.",
        "Must stay byte-identical to `computeContentHashV2` in",
        "packages/blockchain-client/src/hash.ts."
      ],
      "discriminator": [
        13,
        44,
        61,
        3,
        7,
        193,
        32,
        198
      ],
      "accounts": [
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "publication",
          "docs": [
            "Same seeds as v1 on purpose. The PDA derives from seeds and program id",
            "only — `space` is not an input — so the two schemas share one",
            "monotone id space under the single `publication_counter`, which is the",
            "invariant ARCHITECTURE.md §3.1 rests on. A v2-specific seed would fork",
            "that id space and break it."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  98,
                  108,
                  105,
                  99,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "publicationId"
              }
            ]
          }
        },
        {
          "name": "previousPublicationAccount",
          "docs": [
            "Unchecked because a revision may point at a v1 or a v2 account and a",
            "typed `Account<'info, _>` can only be one of them. The handler does",
            "the owner, discriminator, and key checks explicitly.",
            "is one of the two Publication types, key matches the claimed pubkey."
          ],
          "optional": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "publicationId",
          "type": "u64"
        },
        {
          "name": "identityMode",
          "type": "u8"
        },
        {
          "name": "discoverability",
          "type": "u8"
        },
        {
          "name": "identityReferenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "contentLength",
          "type": "u64"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "authorDisplaySnapshot",
          "type": "string"
        },
        {
          "name": "excerpt",
          "type": "string"
        },
        {
          "name": "previousPublication",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "rotateAuthority",
      "docs": [
        "Current authority only. Does not revoke or transfer program",
        "upgrade authority — that is a separate, deliberately manual",
        "operation (see ARCHITECTURE.md / README production notes)."
      ],
      "discriminator": [
        248,
        225,
        151,
        35,
        28,
        15,
        85,
        12
      ],
      "accounts": [
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    },
    {
      "name": "publication",
      "discriminator": [
        213,
        137,
        189,
        150,
        94,
        132,
        251,
        247
      ]
    },
    {
      "name": "publicationV2",
      "discriminator": [
        181,
        164,
        139,
        13,
        147,
        192,
        16,
        65
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the platform authority may perform this action."
    },
    {
      "code": 6001,
      "name": "invalidAuthority",
      "msg": "New authority must not be the default/zero pubkey."
    },
    {
      "code": 6002,
      "name": "stalePublicationCounter",
      "msg": "The provided publication id no longer matches the platform counter; refetch and retry."
    },
    {
      "code": 6003,
      "name": "titleTooLong",
      "msg": "Title exceeds the maximum allowed size."
    },
    {
      "code": 6004,
      "name": "authorDisplayTooLong",
      "msg": "Author display name exceeds the maximum allowed size."
    },
    {
      "code": 6005,
      "name": "contentTooLong",
      "msg": "Body content exceeds the maximum allowed size."
    },
    {
      "code": 6006,
      "name": "invalidIdentityMode",
      "msg": "Invalid identity mode."
    },
    {
      "code": 6007,
      "name": "invalidDiscoverability",
      "msg": "Invalid discoverability mode."
    },
    {
      "code": 6008,
      "name": "anonymousHashMustBeZero",
      "msg": "Anonymous publications must have a zero-filled identity reference hash."
    },
    {
      "code": 6009,
      "name": "anonymousDisplayMustBeEmpty",
      "msg": "Anonymous publications must have an empty author display snapshot."
    },
    {
      "code": 6010,
      "name": "missingIdentityReference",
      "msg": "Named or pseudonymous publications must include an identity reference hash."
    },
    {
      "code": 6011,
      "name": "contentHashMismatch",
      "msg": "The supplied content hash does not match the recomputed hash of title and content."
    },
    {
      "code": 6012,
      "name": "invalidPreviousPublication",
      "msg": "previous_publication does not match the account supplied to this instruction."
    },
    {
      "code": 6013,
      "name": "counterOverflow",
      "msg": "Publication counter overflow."
    },
    {
      "code": 6014,
      "name": "excerptTooLong",
      "msg": "Excerpt exceeds the maximum allowed size."
    },
    {
      "code": 6015,
      "name": "missingContentHash",
      "msg": "Content hash must not be all zeroes."
    },
    {
      "code": 6016,
      "name": "emptyContent",
      "msg": "Content length must be greater than zero."
    }
  ],
  "types": [
    {
      "name": "platformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "publicationCounter",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "publication",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "publicationId",
            "type": "u64"
          },
          {
            "name": "identityMode",
            "type": "u8"
          },
          {
            "name": "discoverability",
            "type": "u8"
          },
          {
            "name": "publishedAt",
            "type": "i64"
          },
          {
            "name": "previousPublication",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "identityReferenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "authorDisplaySnapshot",
            "type": "string"
          },
          {
            "name": "content",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "publicationV2",
      "docs": [
        "v2 publication. A separate account type rather than extra fields on",
        "`Publication`, for two reasons:",
        "",
        "* Borsh account layout is positional with no trailing-optional, so",
        "appending a field to `Publication` would make every already-written",
        "account fail to deserialize with \"unexpected EOF\".",
        "* Two structs give two Anchor-generated decoders, each with its own",
        "discriminator, so v1 accounts keep decoding exactly as before.",
        "",
        "The one thing NOT to do here is reuse `Publication.content` to hold the",
        "excerpt: every existing reader would treat a 280-byte blurb as the full",
        "note body."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "publicationId",
            "type": "u64"
          },
          {
            "name": "identityMode",
            "type": "u8"
          },
          {
            "name": "discoverability",
            "type": "u8"
          },
          {
            "name": "publishedAt",
            "type": "i64"
          },
          {
            "name": "previousPublication",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "identityReferenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentLength",
            "docs": [
              "UTF-8 byte length of the off-chain body. Makes the record",
              "self-describing and gives verifiers a cheap pre-check before they",
              "fetch and hash the content."
            ],
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "authorDisplaySnapshot",
            "type": "string"
          },
          {
            "name": "excerpt",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
