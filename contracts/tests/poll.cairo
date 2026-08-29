use maci_contracts::Poll::{Ballot, IPollDispatcher, IPollDispatcherTrait, Poll};
use maci_contracts::PollFactory::{
    CreatePollArgs, IPollFactoryDispatcher, IPollFactoryDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events,
};
use starknet::SyscallResultTrait;


fn deploy() -> (IPollDispatcher, IPollFactoryDispatcher) {
    let (maci_dispatcher, _) = crate::maci::deploy();

    let default_poll_args = CreatePollArgs {
        start_date: 0,
        end_date: 1_000,
        poll_public_key: (0, 1),
        maci: maci_dispatcher.contract_address,
        state_tree_depth: 5,
        vote_options: 5,
    };

    let poll_factory_contract = declare("PollFactory").unwrap_syscall().contract_class();
    let poll_contract = declare("Poll").unwrap_syscall().contract_class();
    let mut calldata = array![];
    (poll_contract.class_hash).serialize(ref calldata);

    let (poll_factory_address, _) = poll_factory_contract.deploy(@calldata).unwrap_syscall();

    let poll_factory_dispatcher = IPollFactoryDispatcher { contract_address: poll_factory_address };

    let poll_address = poll_factory_dispatcher.create_poll(default_poll_args);

    let poll_dispatcher = IPollDispatcher { contract_address: poll_address };

    (poll_dispatcher, poll_factory_dispatcher)
}

#[test]
fn test_create_multiple_polls() {
    let (poll1, poll1_factory_dispatcher) = deploy();
    let (poll2, poll2_factory_dispatcher) = deploy();

    assert!(poll1.contract_address != poll2.contract_address);
    assert!(
        poll1_factory_dispatcher
            .get_poll_class_hash() == poll2_factory_dispatcher
            .get_poll_class_hash(),
    );
}

#[test]
fn test_poll_vote() {
    let mut spy = spy_events();
    let (poll, _) = deploy();
    let ballot = Ballot {
        hash: 0x1234,
        user_commitment: 0x5678,
        encrypted_votes_c1: array![array![0x101, 0x102].span(), array![0x201, 0x202].span()].span(),
        encrypted_votes_c2: array![array![0x301, 0x302].span(), array![0x401, 0x402].span()].span(),
        proof: array![0x501, 0x502, 0x503, 0x504].span(),
    };
    let new_chain_hash =
        5404176071187867183128936264657385541614671583170553453444335674304907852880;

    poll.vote(ballot);

    assert_eq!(poll.get_chain_hash(), new_chain_hash);

    spy
        .assert_emitted(
            @array![
                (
                    poll.contract_address,
                    Poll::Event::Voted(
                        Poll::Voted {
                            hash: ballot.hash,
                            user_commitment: ballot.user_commitment,
                            encrypted_votes_c1: ballot.encrypted_votes_c1,
                            encrypted_votes_c2: ballot.encrypted_votes_c2,
                            chain_hash: new_chain_hash,
                        },
                    ),
                ),
            ],
        );
}
