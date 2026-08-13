use maci_common::utils::math::math;

const Q: u256 = 0x30644E72E131A029B85045B68181585D2833E84879B9709143E1F593F0000001;

#[test]
fn test_add_mod_zero() {
    let result = math::add_mod(1, 1, 0);

    assert_eq!(result, 0);
}

#[test]
fn test_add_mod() {
    assert_eq!(math::add_mod(1, 1, Q), 2);
    assert_eq!(math::add_mod(Q, Q, Q), 0);
}

#[test]
fn test_add_mod_overflow_branch() {
    let result = math::add_mod(60, 50, 100);

    assert_eq!(result, 10);
}

#[test]
#[fuzzer]
fn test_add_mod_commutative(x: u256, y: u256, m: u256) {
    if m == 0 {
        return;
    }

    let result1 = math::add_mod(x, y, m);
    let result2 = math::add_mod(y, x, m);

    assert_eq!(result1, result2);
}

#[test]
#[fuzzer]
fn test_add_mod_range(x: u256, y: u256, m: u256) {
    if m == 0 {
        return;
    }

    let result = math::add_mod(x, y, m);

    assert!(result < m);
}

#[test]
#[fuzzer]
fn test_add_mod_associative(a: u256, b: u256, c: u256, m: u256) {
    if m == 0 {
        return;
    }

    let lhs = math::add_mod(math::add_mod(a, b, m), c, m);
    let rhs = math::add_mod(a, math::add_mod(b, c, m), m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_add_mod_inverse(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    let a = a % m;

    let neg_a = if a == 0 {
        0
    } else {
        m - a
    };

    assert_eq!(math::add_mod(a, neg_a, m), 0);
}

#[test]
#[fuzzer]
fn test_add_mod_identity(x: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::add_mod(x, 0, m), x % m);
    assert_eq!(math::add_mod(0, x, m), x % m);
}

#[test]
fn test_sub_mod_zero() {
    let result = math::sub_mod(1, 1, 0);

    assert_eq!(result, 0);
}

#[test]
fn test_sub_mod() {
    assert_eq!(math::sub_mod(2, 1, Q), 1);
    assert_eq!(math::sub_mod(Q, Q, Q), 0);
}

#[test]
fn test_sub_mod_overflow_branch() {
    let result = math::sub_mod(50, 60, 100);

    assert_eq!(result, 90);
}

#[test]
#[fuzzer]
fn test_sub_mod_identity(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::sub_mod(a, 0, m), a % m);
}

#[test]
#[fuzzer]
fn test_sub_mod_self(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::sub_mod(a, a, m), 0);
}

#[test]
#[fuzzer]
fn test_sub_mod_as_add_inverse(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    let b = b % m;

    let neg_b = if b == 0 {
        0
    } else {
        m - b
    };

    assert_eq!(math::sub_mod(a, b, m), math::add_mod(a, neg_b, m));
}

#[test]
#[fuzzer]
fn test_sub_mod_range(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    let result = math::sub_mod(a, b, m);

    assert!(result < m);
}

#[test]
#[fuzzer]
fn test_sub_mod_antisymmetric(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    let lhs = math::sub_mod(a, b, m);
    let rhs = math::sub_mod(b, a, m);

    assert_eq!(math::add_mod(lhs, rhs, m), 0);
}

#[test]
fn test_mul_mod_zero_modulus() {
    let result = math::mul_mod(1, 1, 0);

    assert_eq!(result, 0);
}

#[test]
fn test_mul_mod() {
    assert_eq!(math::mul_mod(2, 1, Q), 2);
    assert_eq!(math::mul_mod(Q, Q, Q), 0);
}

#[test]
#[fuzzer]
fn test_mul_mod_identity(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::mul_mod(a, 1, m), a % m);
    assert_eq!(math::mul_mod(1, a, m), a % m);
}

#[test]
#[fuzzer]
fn test_mul_mod_zero(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::mul_mod(a, 0, m), 0);
    assert_eq!(math::mul_mod(0, a, m), 0);
}

#[test]
#[fuzzer]
fn test_mul_mod_commutative(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::mul_mod(a, b, m), math::mul_mod(b, a, m));
}

#[test]
#[fuzzer]
fn test_mul_mod_associative(a: u256, b: u256, c: u256, m: u256) {
    if m == 0 {
        return;
    }

    let lhs = math::mul_mod(math::mul_mod(a, b, m), c, m);
    let rhs = math::mul_mod(a, math::mul_mod(b, c, m), m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_mul_mod_distributive(a: u256, b: u256, c: u256, m: u256) {
    if m == 0 {
        return;
    }

    let lhs = math::mul_mod(a, math::add_mod(b, c, m), m);
    let rhs = math::add_mod(math::mul_mod(a, b, m), math::mul_mod(a, c, m), m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_mul_mod_range(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert!(math::mul_mod(a, b, m) < m);
}

#[test]
#[fuzzer]
fn test_mul_mod_inverse(x: u256) {
    let x = x % Q;

    if x == 0 {
        return;
    }

    let inverse = math::pow_mod(x, Q - 2, Q);
    let result = math::mul_mod(x, inverse, Q);

    assert_eq!(result, 1);
}

#[test]
fn test_pow_mod_zero_modulus() {
    let result = math::mul_mod(1, 1, 0);

    assert_eq!(result, 0);
}

#[test]
fn test_pow_mod() {
    assert_eq!(math::pow_mod(2, 1, Q), 2);
    assert_eq!(math::pow_mod(Q, Q, Q), 0);
}

#[test]
#[fuzzer]
fn test_pow_mod_zero(a: u256, m: u256) {
    if m <= 1 {
        return;
    }

    assert_eq!(math::pow_mod(a, 0, m), 1);
}

#[test]
#[fuzzer]
fn test_pow_mod_one(a: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::pow_mod(a, 1, m), a % m);
}

#[test]
#[fuzzer]
fn test_pow_mod_zero_base(n: u256, m: u256) {
    if m == 0 || m == 1 || n == 0 {
        return;
    }

    assert_eq!(math::pow_mod(0, n, m), 0);
}

#[test]
#[fuzzer]
fn test_pow_mod_add_exponents(a: u256, x: u128, y: u128, m: u256) {
    if m == 0 {
        return;
    }

    let x: u256 = x.into();
    let y: u256 = y.into();

    let lhs = math::pow_mod(a, x + y, m);
    let rhs = math::mul_mod(math::pow_mod(a, x, m), math::pow_mod(a, y, m), m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_pow_mod_power(a: u256, x: u128, y: u128, m: u256) {
    if m == 0 {
        return;
    }

    let x: u256 = x.into();
    let y: u256 = y.into();

    let lhs = math::pow_mod(math::pow_mod(a, x, m), y, m);
    let rhs = math::pow_mod(a, x * y, m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_add_then_sub(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    let result = math::sub_mod(math::add_mod(a, b, m), b, m);

    assert_eq!(result, a % m);
}

#[test]
#[fuzzer]
fn test_sub_then_add(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    let result = math::add_mod(math::sub_mod(a, b, m), b, m);

    assert_eq!(result, a % m);
}

#[test]
#[fuzzer]
fn test_mul_mod_distributive_sub(a: u256, b: u256, c: u256, m: u256) {
    if m == 0 {
        return;
    }

    let lhs = math::mul_mod(a, math::sub_mod(b, c, m), m);
    let rhs = math::sub_mod(math::mul_mod(a, b, m), math::mul_mod(a, c, m), m);

    assert_eq!(lhs, rhs);
}

#[test]
#[fuzzer]
fn test_add_mod_reduction(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::add_mod(a, b, m), math::add_mod(a % m, b % m, m));
}

#[test]
#[fuzzer]
fn test_mul_mod_reduction(a: u256, b: u256, m: u256) {
    if m == 0 {
        return;
    }

    assert_eq!(math::mul_mod(a, b, m), math::mul_mod(a % m, b % m, m));
}

#[test]
fn test_add_mod_boundary() {
    assert_eq!(math::add_mod(60, 50, 100), 10);
    assert_eq!(math::add_mod(60, 40, 100), 0);
    assert_eq!(math::add_mod(0, 0, 100), 0);
    assert_eq!(math::add_mod(99, 1, 100), 0);
}

#[test]
fn test_sub_mod_boundary() {
    assert_eq!(math::sub_mod(50, 20, 100), 30);
    assert_eq!(math::sub_mod(20, 50, 100), 70);
    assert_eq!(math::sub_mod(50, 50, 100), 0);
    assert_eq!(math::sub_mod(0, 1, 100), 99);
}

#[test]
fn test_mul_mod_boundary() {
    assert_eq!(math::mul_mod(0, 100, 101), 0);
    assert_eq!(math::mul_mod(1, 100, 101), 100);
    assert_eq!(math::mul_mod(100, 100, 101), 1);
}
