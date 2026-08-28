use MACI::Signup;
use maci_common::crypto::BabyJubJub::BabyJubJub;
use maci_contracts::MACI::{
    Constants, ConstructorParams, IMACIDispatcher, IMACIDispatcherTrait, MACI, PublicKey,
};
use maci_contracts::policies::interfaces::IEnforcer::{
    IEnforcerDispatcher, IEnforcerDispatcherTrait,
};
use maci_contracts::trees::LeanIMT::{ILeanIMTDispatcher, ILeanIMTDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events,
    start_cheat_block_timestamp, start_cheat_caller_address, stop_cheat_block_timestamp,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

const TEST_EMPTY_BALLOT_ROOTS: (u256, u256, u256, u256, u256) = (
    16015576667038038422103932363190100635991292382181099511410843174865570503661,
    166510078825589460025300915201657086611944528317298994959376081297530246971,
    10057734083972610459557695472359628128485394923403014377687504571662791937025,
    4904828619307091008204672239231377290495002626534171783829482835985709082773,
    18694062287284245784028624966421731916526814537891066525886866373016385890569,
);


#[starknet::contract]
mod ZeroVoteBalanceAssigner {
    use maci_contracts::vote_balance::interfaces::IVoteBalanceAssigner::IVoteBalanceAssigner;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Impl of IVoteBalanceAssigner<ContractState> {
        fn get(
            self: @ContractState, subject: starknet::ContractAddress, evidence: ByteArray,
        ) -> u256 {
            0
        }
    }
}

#[starknet::contract]
mod OversizedVoteBalanceAssigner {
    use core::num::traits::Pow;
    use maci_contracts::vote_balance::interfaces::IVoteBalanceAssigner::IVoteBalanceAssigner;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl Impl of IVoteBalanceAssigner<ContractState> {
        fn get(
            self: @ContractState, subject: starknet::ContractAddress, evidence: ByteArray,
        ) -> u256 {
            2_u256.pow(251)
        }
    }
}


fn generate_public_key(private_key: u256) -> PublicKey {
    let (x, y) = BabyJubJub::mul(BabyJubJub::GENERATOR.0, BabyJubJub::GENERATOR.1, private_key);

    PublicKey { x, y }
}

fn deploy_constant_vote_balance_assigner() -> ContractAddress {
    let assigner_contract = declare("ConstantInitialVoteBalance").unwrap_syscall().contract_class();
    let mut assigner_calldata = array![];
    let vote_balance: u256 = 3;
    vote_balance.serialize(ref assigner_calldata);
    let (vote_balance_assigner, _) = assigner_contract.deploy(@assigner_calldata).unwrap_syscall();

    vote_balance_assigner
}

fn deploy_maci(
    vote_balance_assigner: ContractAddress, state_tree_depth: u8,
) -> (IMACIDispatcher, ILeanIMTDispatcher) {
    let maci_contract = declare("MACI").unwrap_syscall().contract_class();
    let imt_contract = declare("LeanIMT").unwrap_syscall().contract_class();
    let (state_tree_address, _) = imt_contract.deploy(@array![]).unwrap_syscall();
    let checker_contract = declare("FreeForAllChecker").unwrap_syscall().contract_class();
    let enforcer_contract = declare("FreeForAllEnforcer").unwrap_syscall().contract_class();
    let (checker_address, _) = checker_contract.deploy(@array![]).unwrap_syscall();
    let (enforcer_address, _) = enforcer_contract
        .deploy(@array![checker_address.into()])
        .unwrap_syscall();

    let params = ConstructorParams {
        state_tree_depth,
        state_tree_address,
        empty_ballot_roots: TEST_EMPTY_BALLOT_ROOTS,
        enforcer: enforcer_address,
        vote_balance_assigner,
    };
    let mut calldata = array![];
    params.serialize(ref calldata);

    let (maci_address, _) = maci_contract.deploy(@calldata).unwrap_syscall();

    let enforcer = IEnforcerDispatcher { contract_address: enforcer_address };
    enforcer.set_target(maci_address);

    (
        IMACIDispatcher { contract_address: maci_address },
        ILeanIMTDispatcher { contract_address: state_tree_address },
    )
}

pub fn deploy() -> (IMACIDispatcher, ILeanIMTDispatcher) {
    let assigner = deploy_constant_vote_balance_assigner();
    deploy_maci(assigner, 5)
}

#[test]
fn test_constructor() {
    let (maci, _) = deploy();

    assert_eq!(maci.total_signups(), 0);
    assert_eq!(maci.state_tree_depth(), 5);
    assert_eq!(maci.get_state_tree_root(), Constants::PAD_KEY_HASH);
    assert_eq!(maci.get_state_tree_root_indexed_signup(0), Constants::PAD_KEY_HASH);
    assert_eq!(maci.get_state_index(Constants::PAD_KEY_HASH), 0);
}

#[test]
#[should_panic(expected: 'Too many signups')]
fn test_signup_too_many_signups() {
    let assigner = deploy_constant_vote_balance_assigner();
    let (maci, _) = deploy_maci(assigner, 2);

    for private_key in 1_u32..5_u32 {
        let value: felt252 = private_key.into();
        let caller = value.try_into().unwrap();
        start_cheat_caller_address(maci.contract_address, caller);
        maci.sign_up(generate_public_key(private_key.into()), "");
    }

    stop_cheat_caller_address(maci.contract_address);
}

#[test]
#[should_panic(expected: 'Invalid public key')]
fn test_signup_invalid_public_key() {
    let (maci, _) = deploy();

    maci.sign_up(PublicKey { x: 1, y: 2 }, "");
}

#[test]
#[should_panic(expected: 'Already enforced')]
fn test_double_signup_same_address() {
    let (maci, _) = deploy();
    let public_key1 = generate_public_key(9000);
    let public_key2 = generate_public_key(9001);

    maci.sign_up(public_key1, "");
    maci.sign_up(public_key2, "");
}


#[test]
fn test_signup() {
    let mut spy = spy_events();
    let timestamp = 1_700_000_000;

    let (maci, imt_contract) = deploy();
    let public_key1 = generate_public_key(9000);
    let public_key2 = generate_public_key(9001);

    start_cheat_block_timestamp(maci.contract_address, timestamp);
    start_cheat_caller_address(maci.contract_address, 1.try_into().unwrap());
    maci.sign_up(public_key1, "");

    start_cheat_caller_address(maci.contract_address, 2.try_into().unwrap());
    maci.sign_up(public_key2, "");
    stop_cheat_block_timestamp(maci.contract_address);
    stop_cheat_caller_address(maci.contract_address);

    let leaf_hash1 = MACI::hash_state_leaf(public_key1, 3);
    let leaf_hash2 = MACI::hash_state_leaf(public_key2, 3);

    assert_eq!(maci.total_signups(), 2);
    assert_eq!(
        maci.get_state_tree_root(),
        2733690249170393328342678854874796288937122268445951915858397652968886526000,
    );
    assert_eq!(maci.get_state_tree_root(), imt_contract.get_root());
    assert_eq!(maci.get_state_tree_root_indexed_signup(0), Constants::PAD_KEY_HASH);
    assert_eq!(
        maci.get_state_tree_root_indexed_signup(1),
        640363641296375460809719516352163455719949987866342593579367400151342769153,
    );
    assert_eq!(
        maci.get_state_tree_root_indexed_signup(2),
        2733690249170393328342678854874796288937122268445951915858397652968886526000,
    );
    assert_eq!(maci.get_state_index(Constants::PAD_KEY_HASH), 0);
    assert_eq!(maci.get_state_index(leaf_hash1), imt_contract.get_leaf_index(leaf_hash1) - 1);
    assert_eq!(maci.get_state_index(leaf_hash2), imt_contract.get_leaf_index(leaf_hash2) - 1);
    assert_eq!(imt_contract.get_size(), 3);

    spy
        .assert_emitted(
            @array![
                (
                    maci.contract_address,
                    MACI::Event::Signup(
                        Signup {
                            state_index: 1,
                            timestamp,
                            public_key_x: public_key1.x,
                            public_key_y: public_key1.y,
                            vote_balance: 3,
                        },
                    ),
                ),
                (
                    maci.contract_address,
                    MACI::Event::Signup(
                        Signup {
                            state_index: 2,
                            timestamp,
                            public_key_x: public_key2.x,
                            public_key_y: public_key2.y,
                            vote_balance: 3,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_signup_leaf_binds_public_key_and_vote_balance() {
    let (maci, _) = deploy();
    let vote_balance: u256 = 3;
    let public_key = generate_public_key(9000);

    maci.sign_up(public_key, "");

    let leaf = MACI::hash_state_leaf(public_key, vote_balance);
    assert_eq!(maci.get_state_index(leaf), 1);
}

#[test]
#[should_panic(expected: 'Zero vote balance')]
fn test_signup_rejects_zero_vote_balance() {
    let stub = declare("ZeroVoteBalanceAssigner").unwrap_syscall().contract_class();
    let (assigner, _) = stub.deploy(@array![]).unwrap_syscall();
    let (maci, _) = deploy_maci(assigner, 5);
    maci.sign_up(generate_public_key(9000), "");
}

#[test]
#[should_panic(expected: 'Vote balance too large')]
fn test_signup_rejects_vote_balance_too_large() {
    let stub = declare("OversizedVoteBalanceAssigner").unwrap_syscall().contract_class();
    let (assigner, _) = stub.deploy(@array![]).unwrap_syscall();
    let (maci, _) = deploy_maci(assigner, 5);
    maci.sign_up(generate_public_key(9000), "");
}
