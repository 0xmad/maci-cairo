use maci_contracts::policies::interfaces::IEnforcer::{
    IEnforcerDispatcher, IEnforcerDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address, test_address,
};
use starknet::SyscallResultTrait;

fn deploy_with_owner(owner: starknet::ContractAddress) -> IEnforcerDispatcher {
    let checker = declare("FreeForAllChecker").unwrap_syscall().contract_class();
    let enforcer = declare("FreeForAllEnforcer").unwrap_syscall().contract_class();
    let (checker_address, _) = checker.deploy(@array![]).unwrap_syscall();
    let (enforcer_address, _) = enforcer
        .deploy(@array![checker_address.into(), owner.into()])
        .unwrap_syscall();

    IEnforcerDispatcher { contract_address: enforcer_address }
}

fn deploy() -> IEnforcerDispatcher {
    deploy_with_owner(test_address())
}

#[test]
fn test_enforce_free_for_all() {
    let enforcer = deploy();
    let caller = 1.try_into().unwrap();

    enforcer.set_target(caller);

    start_cheat_caller_address(enforcer.contract_address, caller);
    enforcer.enforce(caller, "");
    stop_cheat_caller_address(enforcer.contract_address);
}

#[test]
fn test_enforce_name() {
    let enforcer = deploy();

    assert_eq!(enforcer.name(), "FreeForAll");
}

#[test]
#[should_panic(expected: 'Already enforced')]
fn test_double_enforce() {
    let enforcer = deploy();
    let caller = 1.try_into().unwrap();

    enforcer.set_target(caller);

    start_cheat_caller_address(enforcer.contract_address, caller);
    enforcer.enforce(caller, "");
    enforcer.enforce(caller, "");
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_enforce_not_owner() {
    let enforcer = deploy();
    let caller = 1.try_into().unwrap();

    enforcer.set_target(caller);
    enforcer.enforce(caller, "");
}

#[test]
fn test_constructor_owner_can_set_target() {
    let owner = 0x123.try_into().unwrap();
    let enforcer = deploy_with_owner(owner);

    start_cheat_caller_address(enforcer.contract_address, owner);
    enforcer.set_target(owner);
    enforcer.enforce(owner, "");
    stop_cheat_caller_address(enforcer.contract_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_set_target_rejects_non_constructor_owner() {
    let owner = 0x123.try_into().unwrap();
    let enforcer = deploy_with_owner(owner);
    enforcer.set_target(owner);
}
