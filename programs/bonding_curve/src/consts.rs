use anchor_lang::prelude::Pubkey;

pub const INITIAL_TOKEN_FOR_POOL: u64 = 1_000_000_000;   // 1 token
pub const TOKEN_SELL_LIMIT_PERCENT: u64 = 8000;     //  80%
pub const PROPORTION: u64 = 1280;      //  800M token is sold on 500SOL ===> (500 * 2 / 800) = 1.25 ===> 800 : 1.25 = 640 ====> 640 * 2 = 1280


pub const FEE_COLLECTOR: &str = "351g3DjKzZ1nXD4iydGBB5dFKGqF3JWs6DcvxzHAYouM";
pub const CREATION_FEE: u64 = 60_000_000;