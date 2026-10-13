/// A BabyJubJub public key represented by its affine coordinates.
///
/// The coordinates must represent a valid point on the BabyJubJub curve
/// before the key can be registered through `sign_up`. A Policy judges this
/// key as the Subject.
#[derive(Drop, Copy, PartialEq, Serde)]
pub struct PublicKey {
    /// The x-coordinate of the public key.
    pub x: u256,
    /// The y-coordinate of the public key.
    pub y: u256,
}
