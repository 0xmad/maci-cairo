use maci_cairo::crypto::BabyJubJub::BabyJubJub;
use maci_cairo::utils::math::math;

fn generate_point(s: u256) -> (u256, u256) {
    let scalar = s % BabyJubJub::SUBGROUP_ORDER;

    BabyJubJub::mul(BabyJubJub::GENERATOR.0, BabyJubJub::GENERATOR.1, scalar)
}

#[test]
fn test_add() {
    let p1 = (0, 1);
    let p2 = (0, 1);

    let (x, y) = BabyJubJub::add(p1.0, p1.1, p2.0, p2.1);

    assert_eq!(BabyJubJub::is_on_curve(x, y), true);
    assert_eq!(x, 0);
    assert_eq!(y, 1);
}

#[test]
fn test_not_on_curve() {
    let p1 = (123, 456);
    let p2 = (789, 101);

    let (x, y) = BabyJubJub::add(p1.0, p1.1, p2.0, p2.1);

    assert_eq!(BabyJubJub::is_on_curve(x, y), false);
}

#[test]
#[fuzzer]
fn test_add_closure(s1: u256, s2: u256) {
    let (x1, y1) = generate_point(s1);
    let (x2, y2) = generate_point(s2);

    assert_eq!(BabyJubJub::is_on_curve(x1, y1), true);
    assert_eq!(BabyJubJub::is_on_curve(x2, y2), true);

    let (x, y) = BabyJubJub::add(x1, y1, x2, y2);

    assert_eq!(BabyJubJub::is_on_curve(x, y), true);
}

#[test]
#[fuzzer]
fn test_add_identity(s: u256) {
    let (x, y) = generate_point(s);

    assert_eq!(BabyJubJub::is_on_curve(x, y), true);

    let result = BabyJubJub::add(x, y, 0, 1);

    assert_eq!(result.0, x);
    assert_eq!(result.1, y);
}

#[test]
#[should_panic]
fn test_zero_inverse() {
    let _ = BabyJubJub::inverse(0);
}

#[test]
#[fuzzer]
fn test_add_inverse(s: u256) {
    let (x, y) = generate_point(s);
    let inv_x = math::sub_mod(BabyJubJub::Q, x, BabyJubJub::Q);

    assert_eq!(BabyJubJub::is_on_curve(x, y), true);
    assert_eq!(BabyJubJub::is_on_curve(inv_x, y), true);

    let result = BabyJubJub::add(x, y, inv_x, y);

    assert_eq!(result.0, 0);
    assert_eq!(result.1, 1);
}

#[test]
#[fuzzer]
fn test_add_associativity(s1: u256, s2: u256, s3: u256) {
    let p = generate_point(s1 % 16);
    let q = generate_point(s2 % 16);
    let r = generate_point(s3 % 16);

    assert_eq!(BabyJubJub::is_on_curve(p.0, p.1), true);
    assert_eq!(BabyJubJub::is_on_curve(q.0, q.1), true);
    assert_eq!(BabyJubJub::is_on_curve(r.0, r.1), true);

    let pq = BabyJubJub::add(p.0, p.1, q.0, q.1);
    let res1 = BabyJubJub::add(pq.0, pq.1, r.0, r.1);
    let qr = BabyJubJub::add(q.0, q.1, r.0, r.1);
    let res2 = BabyJubJub::add(p.0, p.1, qr.0, qr.1);

    assert_eq!(res1.0, res2.0);
    assert_eq!(res1.1, res2.1);
}

#[test]
#[fuzzer]
fn test_add_commutativity(s1: u256, s2: u256) {
    let p = generate_point(s1);
    let q = generate_point(s2);

    assert_eq!(BabyJubJub::is_on_curve(p.0, p.1), true);
    assert_eq!(BabyJubJub::is_on_curve(q.0, q.1), true);

    let pq = BabyJubJub::add(p.0, p.1, q.0, q.1);
    let qp = BabyJubJub::add(q.0, q.1, p.0, p.1);

    assert_eq!(pq.0, qp.0);
    assert_eq!(pq.1, qp.1);
}

#[test]
#[fuzzer]
fn test_add_n_times(n: u8, s: u256) {
    let n = n % 8;
    let p = generate_point(s);
    let mut add_result = (0, 1);

    for _ in 0..n {
        add_result = BabyJubJub::add(p.0, p.1, add_result.0, add_result.1)
    }

    let mul_result = BabyJubJub::mul(p.0, p.1, n.into());

    assert_eq!(add_result.0, mul_result.0);
    assert_eq!(add_result.1, mul_result.1);
}

#[test]
#[fuzzer]
fn test_mul_closure(s: u256) {
    let p = generate_point(s);

    let result = BabyJubJub::mul(p.0, p.1, s);

    assert_eq!(BabyJubJub::is_on_curve(result.0, result.1), true);
}

#[test]
#[fuzzer]
fn test_mul_zero(s: u256) {
    let p = generate_point(s);

    let result = BabyJubJub::mul(p.0, p.1, 0);

    assert_eq!(result.0, 0);
    assert_eq!(result.1, 1);
}

#[test]
#[fuzzer]
fn test_mul_identity(s: u256) {
    let p = generate_point(s);

    let result = BabyJubJub::mul(p.0, p.1, 1);

    assert_eq!(result.0, p.0);
    assert_eq!(result.1, p.1);

    let result = BabyJubJub::mul(0, 1, 0);

    assert_eq!(result.0, 0);
    assert_eq!(result.1, 1);
}

#[test]
fn test_mul_n_times_in_subgroup() {
    let p = generate_point(1);

    let result = BabyJubJub::mul(p.0, p.1, BabyJubJub::SUBGROUP_ORDER);

    assert_eq!(result.0, 0);
    assert_eq!(result.1, 1);
}

#[test]
#[fuzzer]
fn test_mul_additive_scalar(a: u256, b: u256) {
    let p = (0, 1);

    let pa = BabyJubJub::mul(p.0, p.1, a);
    let pb = BabyJubJub::mul(p.0, p.1, b);
    let add_result = BabyJubJub::add(pa.0, pa.1, pb.0, pb.1);
    let mul_result = BabyJubJub::mul(p.0, p.1, math::add_mod(a, b, BabyJubJub::Q));

    assert_eq!(add_result.0, mul_result.0);
    assert_eq!(add_result.1, mul_result.1);
}

#[test]
#[fuzzer]
fn test_mul_multiplicative_scalar(a: u256, b: u256) {
    let p = (0, 1);

    let pa = BabyJubJub::mul(p.0, p.1, a);
    let pb = BabyJubJub::mul(p.0, p.1, b);
    let add_result = BabyJubJub::add(pa.0, pa.1, pb.0, pb.1);
    let mul_result = BabyJubJub::mul(p.0, p.1, math::mul_mod(a, b, BabyJubJub::Q));

    assert_eq!(add_result.0, mul_result.0);
    assert_eq!(add_result.1, mul_result.1);
}

#[test]
#[fuzzer]
fn test_mul_distribution(a: u32) {
    let p = generate_point(1);
    let q = generate_point(2);

    let pa = BabyJubJub::mul(p.0, p.1, a.into());
    let qa = BabyJubJub::mul(q.0, q.1, a.into());
    let pq = BabyJubJub::add(p.0, p.1, q.0, q.1);
    let add_result = BabyJubJub::add(pa.0, pa.1, qa.0, qa.1);
    let mul_result = BabyJubJub::mul(pq.0, pq.1, a.into());

    assert_eq!(add_result.0, mul_result.0);
    assert_eq!(add_result.1, mul_result.1);
}

#[test]
#[fuzzer]
fn test_mul_negative_scalar(s: u256) {
    let p = generate_point(s);

    let sp = BabyJubJub::mul(p.0, p.1, s);
    let neg_sp = BabyJubJub::negate(sp.0, sp.1);
    let neg_s = if s == 0 {
        0
    } else {
        BabyJubJub::SUBGROUP_ORDER - (s % BabyJubJub::SUBGROUP_ORDER)
    };

    let result = BabyJubJub::mul(p.0, p.1, neg_s);

    assert_eq!(result.0, neg_sp.0);
    assert_eq!(result.1, neg_sp.1);
}

#[test]
fn test_negate() {
    let p = (1, 1);

    let result = BabyJubJub::negate(p.0, p.1);

    assert_eq!(result.0, BabyJubJub::Q - p.0);
    assert_eq!(result.1, 1);
}

#[test]
#[fuzzer]
fn test_double_negate(s: u256) {
    let p = generate_point(s);

    let neg_p = BabyJubJub::negate(p.0, p.1);
    let result = BabyJubJub::negate(neg_p.0, neg_p.1);

    assert_eq!(result.0, p.0);
    assert_eq!(result.1, p.1);
}

#[test]
fn test_identity() {
    let identity = BabyJubJub::identity();

    assert_eq!(identity.x, 0);
    assert_eq!(identity.y, 1);
    assert_eq!(identity.z, 1);
    assert_eq!(identity.t, 0);
}


#[test]
fn test_double() {
    let p = (0, 1);
    let add_result = BabyJubJub::add(p.0, p.1, p.0, p.1);
    let double_result = BabyJubJub::double(p.0, p.1);

    assert_eq!(double_result.0, add_result.0);
    assert_eq!(double_result.1, add_result.1);
}
