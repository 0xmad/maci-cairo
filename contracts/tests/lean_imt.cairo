use maci_contracts::trees::LeanIMT::{
    ILeanIMTDispatcher, ILeanIMTDispatcherTrait, SNARK_SCALAR_FIELD,
};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::SyscallResultTrait;

fn deploy() -> ILeanIMTDispatcher {
    let contract = declare("LeanIMT").unwrap_syscall().contract_class();
    let (contract_address, _) = contract.deploy(@array![]).unwrap_syscall();

    ILeanIMTDispatcher { contract_address }
}

#[test]
fn test_insert() {
    let imt = deploy();

    let _ = imt
        .insert(1309255631273308531193241901289907343161346846555918942743921933037802809814);
    let node = imt.insert(1);
    let root = imt.get_root();
    let index = imt.get_leaf_index(1);
    let size = imt.get_size();

    assert_eq!(node, 57657544514806701516422874648817029470079888617466081654292212158904804989);
    assert_eq!(root, 57657544514806701516422874648817029470079888617466081654292212158904804989);
    assert_eq!(index, 2);
    assert_eq!(size, 2);
}

#[test]
fn test_multi_insert() {
    let imt = deploy();

    let mut root = imt
        .insert(1309255631273308531193241901289907343161346846555918942743921933037802809814);

    for leaf in 1_u8..10_u8 {
        root = imt.insert(leaf.into());
        assert_eq!(imt.get_leaf_index(leaf.into()), leaf.into() + 1);
    }

    assert_eq!(imt.get_root(), root);
    assert_eq!(imt.get_size(), 10);
}


#[test]
#[fuzzer]
fn test_fuzz_insert(leaf: u256) {
    if (leaf >= SNARK_SCALAR_FIELD) {
        return;
    }

    let imt = deploy();

    let root = imt.insert(leaf);

    assert_eq!(imt.get_root(), root);
    assert_eq!(imt.get_size(), 1);
}

#[test]
#[should_panic(expected: 'Invalid leaf')]
fn test_zero_leaf() {
    let imt = deploy();

    let _ = imt.insert(0);
}

#[test]
#[should_panic(expected: 'Invalid leaf')]
fn test_max_leaf() {
    let imt = deploy();

    let _ = imt.insert(SNARK_SCALAR_FIELD);
}

#[test]
#[should_panic(expected: 'Leaf already exists')]
fn test_duplicated_leaf() {
    let imt = deploy();

    let _ = imt
        .insert(1309255631273308531193241901289907343161346846555918942743921933037802809814);

    let _ = imt
        .insert(1309255631273308531193241901289907343161346846555918942743921933037802809814);
}
