use starknet::ContractAddress;

#[starknet::interface]
pub trait IConstantAMM<TContractState> {
    fn swap(ref self: TContractState, token_in: ContractAddress, amount_in: u256) -> u256;
    fn add_liquidity(ref self: TContractState, amount0: u256, amount1: u256) -> u256;
    fn remove_liquidity(ref self: TContractState, shares: u256) -> (u256, u256);
}

mod Errors {
    pub const INVALID_FEE: felt252 = 0;
    pub const INSUFFICIENT_BALANCE: felt252 = 1;
    pub const INVALID_TOKEN: felt252 = 2;
    pub const INVALID_AMOUNT: felt252 = 3;
    pub const INVALID_SHARES: felt252 = 4;
}

#[starknet::contract]
pub mod ConstantAMM {
    use core::num::traits::Sqrt;
    use openzeppelin::interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::Errors;

    #[storage]
    struct Storage {
        token0: IERC20Dispatcher,
        token1: IERC20Dispatcher,
        reserve0: u256,
        reserve1: u256,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        fee: u16,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, token0: ContractAddress, token1: ContractAddress, fee: u16,
    ) {
        assert(fee <= 1000, Errors::INVALID_FEE);
        self.token0.write(IERC20Dispatcher { contract_address: token0 });
        self.token1.write(IERC20Dispatcher { contract_address: token1 });
        self.fee.write(fee);
    }

    #[abi(embed_v0)]
    impl ConstantAMM of super::IConstantAMM<ContractState> {
        fn swap(ref self: ContractState, token_in: ContractAddress, amount_in: u256) -> u256 {
            assert(amount_in > 0, Errors::INVALID_AMOUNT);

            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let is_token0 = self.select_token(token_in);
            let (token0, token1) = (self.token0.read(), self.token1.read());
            let (reserve0, reserve1) = (self.reserve0.read(), self.reserve1.read());
            let (token_in, token_out, reserve_in, reserve_out) = if is_token0 {
                (token0, token1, reserve0, reserve1)
            } else {
                (token1, token0, reserve1, reserve0)
            };

            token_in.transfer_from(caller, this, amount_in);

            let amount_in_with_fee = (amount_in * (1000 - self.fee.read().into()) / 1000);
            let amount_out = (reserve_out * amount_in_with_fee) / (reserve_in + amount_in_with_fee);

            token_out.transfer(caller, amount_out);

            self._update(self.token0.read().balance_of(this), self.token1.read().balance_of(this));

            amount_out
        }

        fn add_liquidity(ref self: ContractState, amount0: u256, amount1: u256) -> u256 {
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let (token0, token1) = (self.token0.read(), self.token1.read());

            token0.transfer_from(caller, this, amount0);
            token1.transfer_from(caller, this, amount1);

            let (reserve0, reserve1) = (self.reserve0.read(), self.reserve1.read());

            if reserve0 > 0 || reserve1 > 0 {
                assert(reserve0 * amount1 == reserve1 * amount0, Errors::INVALID_AMOUNT);
            }

            let total_supply = self.total_supply.read();
            let shares = if total_supply == 0 {
                (amount0 * amount1).sqrt().into()
            } else {
                PrivateFunctions::min(
                    amount0 * total_supply / reserve0, amount1 * total_supply / reserve1,
                )
            };

            assert(shares > 0, Errors::INVALID_SHARES);
            self._mint(caller, shares);
            self._update(self.token0.read().balance_of(this), self.token1.read().balance_of(this));

            shares
        }

        fn remove_liquidity(ref self: ContractState, shares: u256) -> (u256, u256) {
            let caller = starknet::get_caller_address();
            let this = starknet::get_contract_address();
            let (token0, token1) = (self.token0.read(), self.token1.read());
            let (balance0, balance1) = (token0.balance_of(this), token1.balance_of(this));
            let total_supply = self.total_supply.read();
            let (amount0, amount1) = (
                (shares * balance0) / total_supply, (shares * balance1) / total_supply,
            );

            assert(amount0 > 0 && amount1 > 0, Errors::INVALID_SHARES);

            self._burn(caller, shares);
            self._update(balance0 - amount0, balance1 - amount1);

            token0.transfer(caller, amount0);
            token1.transfer(caller, amount1);

            (amount0, amount1)
        }
    }

    #[generate_trait]
    impl PrivateFunctions of PrivateFunctionsTrait {
        fn _mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.balances.write(to, self.balances.read(to) + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }

        fn _burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            let balance = self.balances.read(from);
            assert(balance >= amount, Errors::INSUFFICIENT_BALANCE);

            self.balances.write(from, balance - amount);
            self.total_supply.write(self.total_supply.read() - amount);
        }

        fn _update(ref self: ContractState, reserve0: u256, reserve1: u256) {
            self.reserve0.write(reserve0);
            self.reserve1.write(reserve1);
        }

        #[inline(always)]
        fn select_token(self: @ContractState, token: ContractAddress) -> bool {
            assert(
                token == self.token0.read().contract_address
                    || token == self.token1.read().contract_address,
                Errors::INVALID_TOKEN,
            );

            token == self.token0.read().contract_address
        }

        #[inline(always)]
        fn min(x: u256, y: u256) -> u256 {
            if x <= y {
                x
            } else {
                y
            }
        }
    }
}
