use maci_contracts::MACI::IMACIDispatcherTrait;
use maci_contracts::Poll::{
    Ballot, IPollDispatcher, IPollDispatcherTrait, Poll, TallyBatch, TallyFinalize,
};
use maci_contracts::PollFactory::{IPollFactoryDispatcher, IPollFactoryDispatcherTrait};
use snforge_std::{
    DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::SyscallResultTrait;


const FIRST_VOTE_CHAIN_HASH: u256 =
    5404176071187867183128936264657385541614671583170553453444335674304907852880;

fn identity_accumulator() -> Span<Span<u256>> {
    array![array![0, 1].span(), array![0, 1].span()].span()
}

fn deploy() -> IPollDispatcher {
    let (maci, _) = crate::maci::deploy();
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    let poll_address = maci.create_poll(crate::maci::default_create_poll_args());
    stop_cheat_caller_address(maci.contract_address);
    IPollDispatcher { contract_address: poll_address }
}

fn sample_ballot() -> Ballot {
    Ballot {
        hash: 0x1234,
        user_commitment: 0x5678,
        encrypted_votes_c1: array![array![0x101, 0x102].span(), array![0x201, 0x202].span()].span(),
        encrypted_votes_c2: array![array![0x301, 0x302].span(), array![0x401, 0x402].span()].span(),
        proof: array![0x501, 0x502, 0x503, 0x504].span(),
    }
}

fn tally_batch(
    new_chain_hash: u256, live_root: u256, acc_c1: Span<Span<u256>>, acc_c2: Span<Span<u256>>,
) -> TallyBatch {
    TallyBatch {
        new_chain_hash,
        new_live_root: live_root,
        new_accumulator_c1: acc_c1,
        new_accumulator_c2: acc_c2,
        proof: array![0x2].span(),
    }
}

fn tally_finalize(totals: Span<u256>) -> TallyFinalize {
    TallyFinalize {
        accumulator_c1: identity_accumulator(),
        accumulator_c2: identity_accumulator(),
        tally_totals: totals,
        proof: array![].span(),
    }
}

#[test]
fn test_create_poll_persists_config() {
    let poll = deploy();
    let args = crate::maci::default_create_poll_args();

    assert_eq!(poll.poll_id(), 0);
    assert_eq!(poll.start_date(), args.start_date);
    assert_eq!(poll.end_date(), args.end_date);
    assert_eq!(poll.poll_public_key(), args.poll_public_key);
    assert_eq!(poll.state_tree_depth(), args.state_tree_depth);
    assert_eq!(poll.vote_options(), args.vote_options);
    assert_eq!(poll.batch_size(), args.batch_size);
    assert_eq!(poll.tally_live_root(), args.empty_live_ballot_root);
    assert_eq!(poll.get_chain_hash(), 0);
    assert_eq!(poll.ballot_count(), 0);
    assert_eq!(poll.tally_batches_processed(), 0);
    assert!(!poll.is_tally_complete());
    assert_eq!(poll.tally_accumulator_c1(), identity_accumulator());
    assert_eq!(poll.tally_accumulator_c2(), identity_accumulator());
}

#[test]
fn test_create_multiple_polls() {
    let (maci, _) = crate::maci::deploy();
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    let poll1 = maci.create_poll(crate::maci::default_create_poll_args());
    let poll2 = maci.create_poll(crate::maci::default_create_poll_args());
    stop_cheat_caller_address(maci.contract_address);

    assert!(poll1 != poll2);
}

#[test]
#[should_panic(expected: 'Caller is not MACI')]
fn test_factory_create_poll_rejects_non_maci() {
    let (maci, _) = crate::maci::deploy();
    let factory = IPollFactoryDispatcher { contract_address: maci.get_poll_factory() };
    factory
        .create_poll(
            maci_contracts::PollFactory::PollConstructorArgs {
                start_date: 0,
                end_date: 1,
                poll_public_key: (0, 1),
                maci: maci.contract_address,
                state_tree_depth: 5,
                vote_options: 1,
                poll_id: 0,
                batch_size: 1,
                empty_live_ballot_root: 0,
            },
        );
}

#[test]
fn test_factory_get_poll_class_hash() {
    let poll_contract = declare("Poll").unwrap_syscall().contract_class();
    let (maci, _) = crate::maci::deploy();
    let factory = IPollFactoryDispatcher { contract_address: maci.get_poll_factory() };

    assert_eq!(factory.get_poll_class_hash(), *poll_contract.class_hash);
}

#[test]
fn test_poll_vote() {
    let mut spy = spy_events();
    let poll = deploy();
    let ballot = sample_ballot();

    poll.vote(ballot);

    assert_eq!(poll.get_chain_hash(), FIRST_VOTE_CHAIN_HASH);
    assert_eq!(poll.ballot_count(), 1);

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
                            chain_hash: FIRST_VOTE_CHAIN_HASH,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_full_batch_writes_checkpoint_on_vote() {
    let poll = deploy();
    poll.vote(sample_ballot());
    poll.vote(sample_ballot());

    assert_eq!(poll.ballot_count(), 2);
    assert_eq!(poll.chain_hash_checkpoint(0), poll.get_chain_hash());
}

#[test]
#[should_panic(expected: 'Poll not started')]
fn test_vote_before_start() {
    let (maci, _) = crate::maci::deploy();
    let mut args = crate::maci::default_create_poll_args();
    args.start_date = 50;
    args.end_date = 100;
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    let poll_address = maci.create_poll(args);
    stop_cheat_caller_address(maci.contract_address);
    let poll = IPollDispatcher { contract_address: poll_address };

    start_cheat_block_timestamp(poll.contract_address, 10);
    poll.vote(sample_ballot());
}

#[test]
#[should_panic(expected: 'Poll ended')]
fn test_vote_at_end() {
    let poll = deploy();
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll.vote(sample_ballot());
}

#[test]
#[should_panic(expected: 'Poll not over')]
fn test_tally_before_end() {
    let poll = deploy();
    poll.tally_finalize(tally_finalize(array![0, 0].span()));
}

#[test]
fn test_empty_poll_finalize() {
    let mut spy = spy_events();
    let poll = deploy();
    let totals = array![0_u256, 0].span();

    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll.tally_finalize(tally_finalize(totals));
    stop_cheat_block_timestamp(poll.contract_address);

    assert!(poll.is_tally_complete());
    assert_eq!(poll.tally_totals(), totals);

    spy
        .assert_emitted(
            @array![
                (
                    poll.contract_address,
                    Poll::Event::TallyFinalized(Poll::TallyFinalized { tally_totals: totals }),
                ),
            ],
        );
}

#[test]
fn test_process_tally_batch_then_finalize() {
    let mut spy = spy_events();
    let poll = deploy();
    let new_live_root: u256 = 0xdef;
    let new_acc_c1 = array![array![2, 3].span(), array![4, 5].span()].span();
    let new_acc_c2 = array![array![6, 7].span(), array![8, 9].span()].span();
    let totals = array![11_u256, 22].span();

    poll.vote(sample_ballot());

    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll
        .process_tally_batch(
            tally_batch(FIRST_VOTE_CHAIN_HASH, new_live_root, new_acc_c1, new_acc_c2),
        );

    assert_eq!(poll.chain_hash_checkpoint(0), FIRST_VOTE_CHAIN_HASH);
    assert_eq!(poll.tally_batches_processed(), 1);
    assert_eq!(poll.tally_live_root(), new_live_root);
    assert_eq!(poll.tally_accumulator_c1(), new_acc_c1);
    assert_eq!(poll.tally_accumulator_c2(), new_acc_c2);

    poll.tally_finalize(tally_finalize(totals));

    assert!(poll.is_tally_complete());
    assert_eq!(poll.tally_totals(), totals);

    spy
        .assert_emitted(
            @array![
                (
                    poll.contract_address,
                    Poll::Event::TallyBatchProcessed(
                        Poll::TallyBatchProcessed {
                            chain_hash: FIRST_VOTE_CHAIN_HASH,
                            live_root: new_live_root,
                            accumulator_c1: new_acc_c1,
                            accumulator_c2: new_acc_c2,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_multiple_checkpoints_and_batches() {
    let mut spy = spy_events();
    let poll = deploy();
    let first_acc_c1 = array![array![2, 3].span(), array![4, 5].span()].span();
    let first_acc_c2 = array![array![6, 7].span(), array![8, 9].span()].span();
    let second_acc_c1 = array![array![10, 11].span(), array![12, 13].span()].span();
    let second_acc_c2 = array![array![14, 15].span(), array![16, 17].span()].span();
    let first_live_root: u256 = 0x111;
    let second_live_root: u256 = 0x222;
    let totals = array![3_u256, 4].span();

    poll.vote(sample_ballot());
    poll.vote(sample_ballot());
    poll.vote(sample_ballot());
    poll.vote(sample_ballot());

    let first_checkpoint = poll.chain_hash_checkpoint(0);
    let second_checkpoint = poll.chain_hash_checkpoint(1);

    assert_eq!(poll.ballot_count(), 4);
    assert_eq!(poll.batch_size(), 2);
    assert!(first_checkpoint != second_checkpoint);
    assert_eq!(second_checkpoint, poll.get_chain_hash());

    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll
        .process_tally_batch(
            tally_batch(first_checkpoint, first_live_root, first_acc_c1, first_acc_c2),
        );

    assert_eq!(poll.tally_batches_processed(), 1);
    assert_eq!(poll.tally_live_root(), first_live_root);
    assert_eq!(poll.tally_accumulator_c1(), first_acc_c1);
    assert_eq!(poll.tally_accumulator_c2(), first_acc_c2);

    poll
        .process_tally_batch(
            tally_batch(second_checkpoint, second_live_root, second_acc_c1, second_acc_c2),
        );

    assert_eq!(poll.tally_batches_processed(), 2);
    assert_eq!(poll.tally_live_root(), second_live_root);
    assert_eq!(poll.tally_accumulator_c1(), second_acc_c1);
    assert_eq!(poll.tally_accumulator_c2(), second_acc_c2);

    poll.tally_finalize(tally_finalize(totals));

    assert!(poll.is_tally_complete());
    assert_eq!(poll.tally_totals(), totals);

    spy
        .assert_emitted(
            @array![
                (
                    poll.contract_address,
                    Poll::Event::TallyBatchProcessed(
                        Poll::TallyBatchProcessed {
                            chain_hash: first_checkpoint,
                            live_root: first_live_root,
                            accumulator_c1: first_acc_c1,
                            accumulator_c2: first_acc_c2,
                        },
                    ),
                ),
                (
                    poll.contract_address,
                    Poll::Event::TallyBatchProcessed(
                        Poll::TallyBatchProcessed {
                            chain_hash: second_checkpoint,
                            live_root: second_live_root,
                            accumulator_c1: second_acc_c1,
                            accumulator_c2: second_acc_c2,
                        },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: 'Invalid chain hash checkpoint')]
fn test_tally_batch_rejects_wrong_checkpoint() {
    let poll = deploy();
    poll.vote(sample_ballot());
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll.process_tally_batch(tally_batch(1, 0xabc, identity_accumulator(), identity_accumulator()));
}

#[test]
#[should_panic(expected: 'Tally batches incomplete')]
fn test_finalize_requires_all_batches() {
    let poll = deploy();
    poll.vote(sample_ballot());
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll.tally_finalize(tally_finalize(array![0, 0].span()));
}

#[test]
#[should_panic(expected: 'No tally batch')]
fn test_extra_tally_batch_rejected() {
    let poll = deploy();
    poll.vote(sample_ballot());
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll
        .process_tally_batch(
            tally_batch(
                FIRST_VOTE_CHAIN_HASH, 0xabc, identity_accumulator(), identity_accumulator(),
            ),
        );
    poll
        .process_tally_batch(
            tally_batch(
                FIRST_VOTE_CHAIN_HASH, 0xabc, identity_accumulator(), identity_accumulator(),
            ),
        );
}

#[test]
#[should_panic(expected: 'Tally complete')]
fn test_tally_completes_once() {
    let poll = deploy();
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    let finalize = tally_finalize(array![0, 0].span());
    poll.tally_finalize(finalize);
    poll.tally_finalize(finalize);
}

#[test]
#[should_panic(expected: 'Tally complete')]
fn test_tally_batch_rejected_after_complete() {
    let poll = deploy();
    start_cheat_block_timestamp(poll.contract_address, 1_000);
    poll.tally_finalize(tally_finalize(array![0, 0].span()));
    poll.process_tally_batch(tally_batch(0, 0xabc, identity_accumulator(), identity_accumulator()));
}

#[test]
#[should_panic(expected: 'Invalid poll config')]
fn test_create_poll_rejects_empty_schedule() {
    let (maci, _) = crate::maci::deploy();
    let mut args = crate::maci::default_create_poll_args();
    args.end_date = args.start_date;
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    maci.create_poll(args);
}

#[test]
#[should_panic(expected: 'Invalid poll config')]
fn test_create_poll_rejects_zero_vote_options() {
    let (maci, _) = crate::maci::deploy();
    let mut args = crate::maci::default_create_poll_args();
    args.vote_options = 0;
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    maci.create_poll(args);
}

#[test]
#[should_panic(expected: 'Invalid poll config')]
fn test_create_poll_rejects_zero_batch_size() {
    let (maci, _) = crate::maci::deploy();
    let mut args = crate::maci::default_create_poll_args();
    args.batch_size = 0;
    start_cheat_caller_address(maci.contract_address, crate::maci::coordinator());
    maci.create_poll(args);
}
