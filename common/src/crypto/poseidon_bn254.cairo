use core::circuit::{
    AddInputResultTrait, CircuitElement as CE, CircuitInput as CI, CircuitInputs, CircuitModulus,
    CircuitOutputsTrait, EvalCircuitTrait, circuit_add, circuit_mul, u384,
};
use super::poseidon_bn254_constants::{mds_t3, mds_t4, rc_t3, rc_t4};

/// Circomlib-compatible Poseidon over the BN254 scalar field.
///
/// `poseidon2` and `poseidon3` match Circom `Poseidon(n)` and poseidon-lite
/// (reference Hades: full MDS, S-box \(x^5\)). Each input must be strictly
/// less than `BN254_SCALAR`.
///
/// Arithmetic uses `core::circuit` AddMod/MulMod builtins (same approach as
/// Garaga's BN254 Poseidon).

/// BN254 scalar field modulus (Circom `bn128` prime).
pub const BN254_SCALAR: u256 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

const N_ROUNDS_F: u32 = 8;
const N_ROUNDS_P_T3: u32 = 57;
const N_ROUNDS_P_T4: u32 = 56;

fn bn254_modulus() -> CircuitModulus {
    TryInto::<
        _, CircuitModulus,
    >::try_into([0x79b9709143e1f593f0000001, 0xb85045b68181585d2833e848, 0x30644e72e131a029, 0x0])
        .unwrap()
}

fn require_in_field(x: u256) {
    assert(x < BN254_SCALAR, 'Poseidon input >= p');
}

fn is_full_round(round: u32, n_rounds_p: u32) -> bool {
    round < N_ROUNDS_F / 2 || round >= N_ROUNDS_F / 2 + n_rounds_p
}

/// Poseidon with 2 inputs (`t = 3`). Used for Merkle parents, chain hash, and
/// user commitment.
pub fn poseidon2(a: u256, b: u256) -> u256 {
    require_in_field(a);
    require_in_field(b);
    permute_t3(0_u256.into(), a.into(), b.into())
}

/// Poseidon with 3 inputs (`t = 4`). Used for the state-tree leaf.
pub fn poseidon3(a: u256, b: u256, c: u256) -> u256 {
    require_in_field(a);
    require_in_field(b);
    require_in_field(c);
    permute_t4(0_u256.into(), a.into(), b.into(), c.into())
}

pub fn poseidon(inputs: Span<u256>) -> u256 {
    let n = inputs.len();
    assert(n == 2 || n == 3, 'Poseidon arity');

    if n == 2 {
        poseidon2(*inputs[0], *inputs[1])
    } else {
        poseidon3(*inputs[0], *inputs[1], *inputs[2])
    }
}

fn permute_t3(mut s0: u384, mut s1: u384, mut s2: u384) -> u256 {
    let modulus = bn254_modulus();
    let rc = rc_t3();
    let mds = mds_t3();
    let total = N_ROUNDS_F + N_ROUNDS_P_T3;
    let mut round: u32 = 0;

    while round < total {
        let off = round * 3;
        let (n0, n1, n2) = if is_full_round(round, N_ROUNDS_P_T3) {
            full_round_t3(s0, s1, s2, *rc[off], *rc[off + 1], *rc[off + 2], mds, modulus)
        } else {
            partial_round_t3(s0, s1, s2, *rc[off], *rc[off + 1], *rc[off + 2], mds, modulus)
        };
        s0 = n0;
        s1 = n1;
        s2 = n2;
        round += 1;
    }

    s0.try_into().unwrap()
}

fn permute_t4(mut s0: u384, mut s1: u384, mut s2: u384, mut s3: u384) -> u256 {
    let modulus = bn254_modulus();
    let rc = rc_t4();
    let mds = mds_t4();
    let total = N_ROUNDS_F + N_ROUNDS_P_T4;
    let mut round: u32 = 0;

    while round < total {
        let off = round * 4;
        let (n0, n1, n2, n3) = if is_full_round(round, N_ROUNDS_P_T4) {
            full_round_t4(
                s0, s1, s2, s3, *rc[off], *rc[off + 1], *rc[off + 2], *rc[off + 3], mds, modulus,
            )
        } else {
            partial_round_t4(
                s0, s1, s2, s3, *rc[off], *rc[off + 1], *rc[off + 2], *rc[off + 3], mds, modulus,
            )
        };
        s0 = n0;
        s1 = n1;
        s2 = n2;
        s3 = n3;
        round += 1;
    }

    s0.try_into().unwrap()
}

fn full_round_t3(
    s0: u384,
    s1: u384,
    s2: u384,
    c0: u384,
    c1: u384,
    c2: u384,
    mds: Span<u384>,
    modulus: CircuitModulus,
) -> (u384, u384, u384) {
    let s0_in = CE::<CI<0>> {};
    let s1_in = CE::<CI<1>> {};
    let s2_in = CE::<CI<2>> {};
    let c0_in = CE::<CI<3>> {};
    let c1_in = CE::<CI<4>> {};
    let c2_in = CE::<CI<5>> {};
    let m00 = CE::<CI<6>> {};
    let m01 = CE::<CI<7>> {};
    let m02 = CE::<CI<8>> {};
    let m10 = CE::<CI<9>> {};
    let m11 = CE::<CI<10>> {};
    let m12 = CE::<CI<11>> {};
    let m20 = CE::<CI<12>> {};
    let m21 = CE::<CI<13>> {};
    let m22 = CE::<CI<14>> {};
    let a0 = circuit_add(s0_in, c0_in);
    let a1 = circuit_add(s1_in, c1_in);
    let a2 = circuit_add(s2_in, c2_in);
    let x0_sq = circuit_mul(a0, a0);
    let x0_qd = circuit_mul(x0_sq, x0_sq);
    let x0_p5 = circuit_mul(x0_qd, a0);
    let x1_sq = circuit_mul(a1, a1);
    let x1_qd = circuit_mul(x1_sq, x1_sq);
    let x1_p5 = circuit_mul(x1_qd, a1);
    let x2_sq = circuit_mul(a2, a2);
    let x2_qd = circuit_mul(x2_sq, x2_sq);
    let x2_p5 = circuit_mul(x2_qd, a2);
    let p0_0 = circuit_mul(m00, x0_p5);
    let p0_1 = circuit_mul(m01, x1_p5);
    let p0_2 = circuit_mul(m02, x2_p5);
    let n0_1 = circuit_add(p0_0, p0_1);
    let n0_2 = circuit_add(n0_1, p0_2);
    let p1_0 = circuit_mul(m10, x0_p5);
    let p1_1 = circuit_mul(m11, x1_p5);
    let p1_2 = circuit_mul(m12, x2_p5);
    let n1_1 = circuit_add(p1_0, p1_1);
    let n1_2 = circuit_add(n1_1, p1_2);
    let p2_0 = circuit_mul(m20, x0_p5);
    let p2_1 = circuit_mul(m21, x1_p5);
    let p2_2 = circuit_mul(m22, x2_p5);
    let n2_1 = circuit_add(p2_0, p2_1);
    let n2_2 = circuit_add(n2_1, p2_2);
    let mut inputs = (n0_2, n1_2, n2_2).new_inputs();
    inputs = inputs.next(s0);
    inputs = inputs.next(s1);
    inputs = inputs.next(s2);
    inputs = inputs.next(c0);
    inputs = inputs.next(c1);
    inputs = inputs.next(c2);
    let mut i: u32 = 0;

    while i < 9 {
        inputs = inputs.next(*mds[i]);
        i += 1;
    }

    let outputs = inputs.done().eval(modulus).unwrap();
    (outputs.get_output(n0_2), outputs.get_output(n1_2), outputs.get_output(n2_2))
}

fn partial_round_t3(
    s0: u384,
    s1: u384,
    s2: u384,
    c0: u384,
    c1: u384,
    c2: u384,
    mds: Span<u384>,
    modulus: CircuitModulus,
) -> (u384, u384, u384) {
    let s0_in = CE::<CI<0>> {};
    let s1_in = CE::<CI<1>> {};
    let s2_in = CE::<CI<2>> {};
    let c0_in = CE::<CI<3>> {};
    let c1_in = CE::<CI<4>> {};
    let c2_in = CE::<CI<5>> {};
    let m00 = CE::<CI<6>> {};
    let m01 = CE::<CI<7>> {};
    let m02 = CE::<CI<8>> {};
    let m10 = CE::<CI<9>> {};
    let m11 = CE::<CI<10>> {};
    let m12 = CE::<CI<11>> {};
    let m20 = CE::<CI<12>> {};
    let m21 = CE::<CI<13>> {};
    let m22 = CE::<CI<14>> {};
    let a0 = circuit_add(s0_in, c0_in);
    let a1 = circuit_add(s1_in, c1_in);
    let a2 = circuit_add(s2_in, c2_in);
    let x0_sq = circuit_mul(a0, a0);
    let x0_qd = circuit_mul(x0_sq, x0_sq);
    let x0_p5 = circuit_mul(x0_qd, a0);
    let p0_0 = circuit_mul(m00, x0_p5);
    let p0_1 = circuit_mul(m01, a1);
    let p0_2 = circuit_mul(m02, a2);
    let n0_1 = circuit_add(p0_0, p0_1);
    let n0_2 = circuit_add(n0_1, p0_2);
    let p1_0 = circuit_mul(m10, x0_p5);
    let p1_1 = circuit_mul(m11, a1);
    let p1_2 = circuit_mul(m12, a2);
    let n1_1 = circuit_add(p1_0, p1_1);
    let n1_2 = circuit_add(n1_1, p1_2);
    let p2_0 = circuit_mul(m20, x0_p5);
    let p2_1 = circuit_mul(m21, a1);
    let p2_2 = circuit_mul(m22, a2);
    let n2_1 = circuit_add(p2_0, p2_1);
    let n2_2 = circuit_add(n2_1, p2_2);
    let mut inputs = (n0_2, n1_2, n2_2).new_inputs();
    inputs = inputs.next(s0);
    inputs = inputs.next(s1);
    inputs = inputs.next(s2);
    inputs = inputs.next(c0);
    inputs = inputs.next(c1);
    inputs = inputs.next(c2);
    let mut i: u32 = 0;

    while i < 9 {
        inputs = inputs.next(*mds[i]);
        i += 1;
    }

    let outputs = inputs.done().eval(modulus).unwrap();
    (outputs.get_output(n0_2), outputs.get_output(n1_2), outputs.get_output(n2_2))
}

fn full_round_t4(
    s0: u384,
    s1: u384,
    s2: u384,
    s3: u384,
    c0: u384,
    c1: u384,
    c2: u384,
    c3: u384,
    mds: Span<u384>,
    modulus: CircuitModulus,
) -> (u384, u384, u384, u384) {
    let s0_in = CE::<CI<0>> {};
    let s1_in = CE::<CI<1>> {};
    let s2_in = CE::<CI<2>> {};
    let s3_in = CE::<CI<3>> {};
    let c0_in = CE::<CI<4>> {};
    let c1_in = CE::<CI<5>> {};
    let c2_in = CE::<CI<6>> {};
    let c3_in = CE::<CI<7>> {};
    let m00 = CE::<CI<8>> {};
    let m01 = CE::<CI<9>> {};
    let m02 = CE::<CI<10>> {};
    let m03 = CE::<CI<11>> {};
    let m10 = CE::<CI<12>> {};
    let m11 = CE::<CI<13>> {};
    let m12 = CE::<CI<14>> {};
    let m13 = CE::<CI<15>> {};
    let m20 = CE::<CI<16>> {};
    let m21 = CE::<CI<17>> {};
    let m22 = CE::<CI<18>> {};
    let m23 = CE::<CI<19>> {};
    let m30 = CE::<CI<20>> {};
    let m31 = CE::<CI<21>> {};
    let m32 = CE::<CI<22>> {};
    let m33 = CE::<CI<23>> {};
    let a0 = circuit_add(s0_in, c0_in);
    let a1 = circuit_add(s1_in, c1_in);
    let a2 = circuit_add(s2_in, c2_in);
    let a3 = circuit_add(s3_in, c3_in);
    let x0_sq = circuit_mul(a0, a0);
    let x0_qd = circuit_mul(x0_sq, x0_sq);
    let x0_p5 = circuit_mul(x0_qd, a0);
    let x1_sq = circuit_mul(a1, a1);
    let x1_qd = circuit_mul(x1_sq, x1_sq);
    let x1_p5 = circuit_mul(x1_qd, a1);
    let x2_sq = circuit_mul(a2, a2);
    let x2_qd = circuit_mul(x2_sq, x2_sq);
    let x2_p5 = circuit_mul(x2_qd, a2);
    let x3_sq = circuit_mul(a3, a3);
    let x3_qd = circuit_mul(x3_sq, x3_sq);
    let x3_p5 = circuit_mul(x3_qd, a3);
    let p0_0 = circuit_mul(m00, x0_p5);
    let p0_1 = circuit_mul(m01, x1_p5);
    let p0_2 = circuit_mul(m02, x2_p5);
    let p0_3 = circuit_mul(m03, x3_p5);
    let n0_1 = circuit_add(p0_0, p0_1);
    let n0_2 = circuit_add(n0_1, p0_2);
    let n0_3 = circuit_add(n0_2, p0_3);
    let p1_0 = circuit_mul(m10, x0_p5);
    let p1_1 = circuit_mul(m11, x1_p5);
    let p1_2 = circuit_mul(m12, x2_p5);
    let p1_3 = circuit_mul(m13, x3_p5);
    let n1_1 = circuit_add(p1_0, p1_1);
    let n1_2 = circuit_add(n1_1, p1_2);
    let n1_3 = circuit_add(n1_2, p1_3);
    let p2_0 = circuit_mul(m20, x0_p5);
    let p2_1 = circuit_mul(m21, x1_p5);
    let p2_2 = circuit_mul(m22, x2_p5);
    let p2_3 = circuit_mul(m23, x3_p5);
    let n2_1 = circuit_add(p2_0, p2_1);
    let n2_2 = circuit_add(n2_1, p2_2);
    let n2_3 = circuit_add(n2_2, p2_3);
    let p3_0 = circuit_mul(m30, x0_p5);
    let p3_1 = circuit_mul(m31, x1_p5);
    let p3_2 = circuit_mul(m32, x2_p5);
    let p3_3 = circuit_mul(m33, x3_p5);
    let n3_1 = circuit_add(p3_0, p3_1);
    let n3_2 = circuit_add(n3_1, p3_2);
    let n3_3 = circuit_add(n3_2, p3_3);
    let mut inputs = (n0_3, n1_3, n2_3, n3_3).new_inputs();
    inputs = inputs.next(s0);
    inputs = inputs.next(s1);
    inputs = inputs.next(s2);
    inputs = inputs.next(s3);
    inputs = inputs.next(c0);
    inputs = inputs.next(c1);
    inputs = inputs.next(c2);
    inputs = inputs.next(c3);
    let mut i: u32 = 0;

    while i < 16 {
        inputs = inputs.next(*mds[i]);
        i += 1;
    }

    let outputs = inputs.done().eval(modulus).unwrap();
    (
        outputs.get_output(n0_3),
        outputs.get_output(n1_3),
        outputs.get_output(n2_3),
        outputs.get_output(n3_3),
    )
}

fn partial_round_t4(
    s0: u384,
    s1: u384,
    s2: u384,
    s3: u384,
    c0: u384,
    c1: u384,
    c2: u384,
    c3: u384,
    mds: Span<u384>,
    modulus: CircuitModulus,
) -> (u384, u384, u384, u384) {
    let s0_in = CE::<CI<0>> {};
    let s1_in = CE::<CI<1>> {};
    let s2_in = CE::<CI<2>> {};
    let s3_in = CE::<CI<3>> {};
    let c0_in = CE::<CI<4>> {};
    let c1_in = CE::<CI<5>> {};
    let c2_in = CE::<CI<6>> {};
    let c3_in = CE::<CI<7>> {};
    let m00 = CE::<CI<8>> {};
    let m01 = CE::<CI<9>> {};
    let m02 = CE::<CI<10>> {};
    let m03 = CE::<CI<11>> {};
    let m10 = CE::<CI<12>> {};
    let m11 = CE::<CI<13>> {};
    let m12 = CE::<CI<14>> {};
    let m13 = CE::<CI<15>> {};
    let m20 = CE::<CI<16>> {};
    let m21 = CE::<CI<17>> {};
    let m22 = CE::<CI<18>> {};
    let m23 = CE::<CI<19>> {};
    let m30 = CE::<CI<20>> {};
    let m31 = CE::<CI<21>> {};
    let m32 = CE::<CI<22>> {};
    let m33 = CE::<CI<23>> {};
    let a0 = circuit_add(s0_in, c0_in);
    let a1 = circuit_add(s1_in, c1_in);
    let a2 = circuit_add(s2_in, c2_in);
    let a3 = circuit_add(s3_in, c3_in);
    let x0_sq = circuit_mul(a0, a0);
    let x0_qd = circuit_mul(x0_sq, x0_sq);
    let x0_p5 = circuit_mul(x0_qd, a0);
    let p0_0 = circuit_mul(m00, x0_p5);
    let p0_1 = circuit_mul(m01, a1);
    let p0_2 = circuit_mul(m02, a2);
    let p0_3 = circuit_mul(m03, a3);
    let n0_1 = circuit_add(p0_0, p0_1);
    let n0_2 = circuit_add(n0_1, p0_2);
    let n0_3 = circuit_add(n0_2, p0_3);
    let p1_0 = circuit_mul(m10, x0_p5);
    let p1_1 = circuit_mul(m11, a1);
    let p1_2 = circuit_mul(m12, a2);
    let p1_3 = circuit_mul(m13, a3);
    let n1_1 = circuit_add(p1_0, p1_1);
    let n1_2 = circuit_add(n1_1, p1_2);
    let n1_3 = circuit_add(n1_2, p1_3);
    let p2_0 = circuit_mul(m20, x0_p5);
    let p2_1 = circuit_mul(m21, a1);
    let p2_2 = circuit_mul(m22, a2);
    let p2_3 = circuit_mul(m23, a3);
    let n2_1 = circuit_add(p2_0, p2_1);
    let n2_2 = circuit_add(n2_1, p2_2);
    let n2_3 = circuit_add(n2_2, p2_3);
    let p3_0 = circuit_mul(m30, x0_p5);
    let p3_1 = circuit_mul(m31, a1);
    let p3_2 = circuit_mul(m32, a2);
    let p3_3 = circuit_mul(m33, a3);
    let n3_1 = circuit_add(p3_0, p3_1);
    let n3_2 = circuit_add(n3_1, p3_2);
    let n3_3 = circuit_add(n3_2, p3_3);
    let mut inputs = (n0_3, n1_3, n2_3, n3_3).new_inputs();
    inputs = inputs.next(s0);
    inputs = inputs.next(s1);
    inputs = inputs.next(s2);
    inputs = inputs.next(s3);
    inputs = inputs.next(c0);
    inputs = inputs.next(c1);
    inputs = inputs.next(c2);
    inputs = inputs.next(c3);
    let mut i: u32 = 0;

    while i < 16 {
        inputs = inputs.next(*mds[i]);
        i += 1;
    }

    let outputs = inputs.done().eval(modulus).unwrap();
    (
        outputs.get_output(n0_3),
        outputs.get_output(n1_3),
        outputs.get_output(n2_3),
        outputs.get_output(n3_3),
    )
}
