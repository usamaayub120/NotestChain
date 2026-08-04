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
    }
  ]
};
