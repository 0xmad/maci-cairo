use maci_common::crypto::poseidon_bn254::{BN254_SCALAR, poseidon, poseidon2, poseidon3};

#[test]
fn test_poseidon3_matches_poseidon_lite() {
    assert_eq!(
        poseidon3(1, 2, 3),
        6542985608222806190361240322586112750744169038454362455181422643027100751666,
    );
}

#[test]
fn test_poseidon2_matches_poseidon_lite() {
    assert_eq!(
        poseidon2(1, 2),
        7853200120776062878684798364095072458815029376092732009249414926327459813530,
    );
}

#[test]
fn test_poseidon2_accepts_input_just_below_modulus() {
    assert_eq!(
        poseidon2(BN254_SCALAR - 1, 0),
        12398508882227933492673204572813459761914093043589189755216261111298919601208,
    );
}

#[test]
fn test_poseidon3_accepts_input_just_below_modulus() {
    assert_eq!(
        poseidon3(BN254_SCALAR - 1, 0, 0),
        19995003932431518142420037639546124879958109781376591867897177037222171918880,
    );
}

#[test]
#[should_panic(expected: 'Poseidon input >= p')]
fn test_poseidon2_rejects_input_at_modulus() {
    let _ = poseidon2(BN254_SCALAR, 0);
}

#[test]
#[should_panic(expected: 'Poseidon input >= p')]
fn test_poseidon3_rejects_input_at_modulus() {
    let _ = poseidon3(0, BN254_SCALAR, 0);
}

#[test]
#[should_panic(expected: 'Poseidon input >= p')]
fn test_poseidon2_rejects_input_above_modulus() {
    let _ = poseidon2(BN254_SCALAR + 1, 0);
}

#[test]
#[should_panic(expected: 'Poseidon input >= p')]
fn test_poseidon3_rejects_input_above_modulus() {
    let _ = poseidon3(0, BN254_SCALAR + 1, 0);
}

#[test]
#[should_panic(expected: 'Poseidon arity')]
fn test_poseidon_rejects_wrong_arity() {
    let _ = poseidon(array![1].span());
}

#[test]
#[should_panic(expected: 'Poseidon arity')]
fn test_poseidon_rejects_arity_six() {
    let _ = poseidon(array![1, 2, 3, 4, 5, 6].span());
}
