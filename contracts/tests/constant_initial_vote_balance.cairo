use maci_contracts::vote_balance::interfaces::IVoteBalanceAssigner::{
    IVoteBalanceAssignerDispatcher, IVoteBalanceAssignerDispatcherTrait,
};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::SyscallResultTrait;

fn deploy(vote_balance: u256) -> IVoteBalanceAssignerDispatcher {
    let contract = declare("ConstantInitialVoteBalance").unwrap_syscall().contract_class();
    let mut calldata = array![];
    vote_balance.serialize(ref calldata);
    let (address, _) = contract.deploy(@calldata).unwrap_syscall();
    IVoteBalanceAssignerDispatcher { contract_address: address }
}

#[test]
fn test_get_returns_configured_vote_balance() {
    let assigner = deploy(3);
    let subject = 1.try_into().unwrap();

    assert_eq!(IVoteBalanceAssignerDispatcherTrait::get(assigner, subject, ""), 3);
}

#[test]
#[should_panic(expected: 'Zero vote balance')]
fn test_constructor_rejects_zero_vote_balance() {
    deploy(0);
}

#[test]
#[should_panic(expected: 'Vote balance too large')]
fn test_constructor_rejects_vote_balance_too_large() {
    deploy(core::num::traits::Pow::pow(2_u256, 251));
}
