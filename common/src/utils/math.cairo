/// Utilities for arithmetic over a `u256` modular field.
///
/// The functions in this module reduce their inputs modulo `m` and perform
/// addition, subtraction, multiplication, and exponentiation without
/// overflowing the `u256` range where applicable.
///
/// A modulus of `0` is treated as invalid and causes the operations to
/// return `0`.
pub mod math {
    use core::integer::u512_safe_div_rem_by_u256;
    use core::num::traits::WideMul;
    use core::zeroable::NonZero;

    /// Computes `(a + b) mod m`.
    ///
    /// Both inputs are first reduced modulo `m`. The addition is performed
    /// using modular arithmetic to avoid overflowing `u256`.
    ///
    /// Arguments:
    /// - `a`: First operand.
    /// - `b`: Second operand.
    /// - `m`: Modulus.
    ///
    /// Returns:
    /// - `(a + b) mod m`.
    /// - `0` if `m` is `0`.
    pub fn add_mod(a: u256, b: u256, m: u256) -> u256 {
        if m == 0 {
            return 0;
        }

        let a = a % m;
        let b = b % m;

        let ma = m - a;

        if b >= ma {
            b - ma
        } else {
            a + b
        }
    }

    /// Computes `(a - b) mod m`.
    ///
    /// Both inputs are first reduced modulo `m`. If `b` is greater than `a`,
    /// the subtraction wraps around the modulus.
    ///
    /// Arguments:
    /// - `a`: First operand.
    /// - `b`: Second operand.
    /// - `m`: Modulus.
    ///
    /// Returns:
    /// - `(a - b) mod m`.
    /// - `0` if `m` is `0`.
    pub fn sub_mod(a: u256, b: u256, m: u256) -> u256 {
        if m == 0 {
            return 0;
        }

        let a = a % m;
        let b = b % m;

        if a >= b {
            a - b
        } else {
            m - (b - a)
        }
    }

    /// Computes `(a * b) mod m`.
    ///
    /// The multiplication is performed using a `u512` intermediate value,
    /// preventing overflow of the `u256` operands before the result is
    /// reduced modulo `m`.
    ///
    /// Arguments:
    /// - `a`: First operand.
    /// - `b`: Second operand.
    /// - `m`: Modulus.
    ///
    /// Returns:
    /// - `(a * b) mod m`.
    /// - `0` if `m` is `0`.
    ///
    /// Panics:
    /// - If `m` cannot be converted into a non-zero value. This is prevented
    ///   by the explicit `m == 0` check above.
    pub fn mul_mod(a: u256, b: u256, m: u256) -> u256 {
        if m == 0 {
            return 0;
        }

        let m: NonZero<u256> = m.try_into().unwrap();

        let product = a.wide_mul(b);
        let (_, remainder) = u512_safe_div_rem_by_u256(product, m);

        remainder
    }

    /// Computes `base^exponent mod modulus`.
    ///
    /// Exponentiation uses the square-and-multiply algorithm, reducing every
    /// multiplication modulo `modulus`. This allows large exponents to be
    /// handled efficiently without constructing the full power.
    ///
    /// An exponent of `0` returns `1 mod modulus`.
    ///
    /// Arguments:
    /// - `base`: The value to exponentiate.
    /// - `exponent`: The non-negative exponent.
    /// - `modulus`: The modulus.
    ///
    /// Returns:
    /// - `base^exponent mod modulus`.
    /// - `0` if `modulus` is `0`.
    pub fn pow_mod(base: u256, exponent: u256, modulus: u256) -> u256 {
        if modulus == 0 {
            return 0;
        }

        let mut result: u256 = 1 % modulus;
        let mut base = base % modulus;
        let mut exponent = exponent;

        while exponent != 0 {
            if exponent.low % 2_u128 != 0 {
                result = mul_mod(result, base, modulus);
            }

            base = mul_mod(base, base, modulus);
            exponent /= 2;
        }

        result
    }
}
