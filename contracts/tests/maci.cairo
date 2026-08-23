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
use starknet::SyscallResultTrait;

const TEST_EMPTY_BALLOT_ROOTS: (u256, u256, u256, u256, u256) = (
    16015576667038038422103932363190100635991292382181099511410843174865570503661,
    166510078825589460025300915201657086611944528317298994959376081297530246971,
    10057734083972610459557695472359628128485394923403014377687504571662791937025,
    4904828619307091008204672239231377290495002626534171783829482835985709082773,
    18694062287284245784028624966421731916526814537891066525886866373016385890569,
);

fn generate_public_key(private_key: u256) -> PublicKey {
    let (x, y) = BabyJubJub::mul(BabyJubJub::GENERATOR.0, BabyJubJub::GENERATOR.1, private_key);

    PublicKey { x, y }
}

pub fn deploy() -> (IMACIDispatcher, ILeanIMTDispatcher) {
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
        state_tree_depth: 5,
        state_tree_address,
        empty_ballot_roots: TEST_EMPTY_BALLOT_ROOTS,
        enforcer: enforcer_address,
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
    let (maci, _) = deploy();

    for private_key in 1_u32..33_u32 {
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

    let public_key1_hash = MACI::hash_public_key(public_key1);
    let public_key2_hash = MACI::hash_public_key(public_key2);

    assert_eq!(maci.total_signups(), 2);
    assert_eq!(
        maci.get_state_tree_root(),
        3266885984234653362040472077962401554823514262458304549412758470818026455349,
    );
    assert_eq!(maci.get_state_tree_root(), imt_contract.get_root());
    assert_eq!(maci.get_state_tree_root_indexed_signup(0), Constants::PAD_KEY_HASH);
    assert_eq!(
        maci.get_state_tree_root_indexed_signup(1),
        2514563577246852816373755405848957005003293329638338732571692190413076252516,
    );
    assert_eq!(
        maci.get_state_tree_root_indexed_signup(2),
        3266885984234653362040472077962401554823514262458304549412758470818026455349,
    );
    assert_eq!(maci.get_state_index(Constants::PAD_KEY_HASH), 0);
    assert_eq!(
        maci.get_state_index(public_key1_hash), imt_contract.get_leaf_index(public_key1_hash) - 1,
    );
    assert_eq!(
        maci.get_state_index(public_key2_hash), imt_contract.get_leaf_index(public_key2_hash) - 1,
    );
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
                        },
                    ),
                ),
            ],
        );
}
