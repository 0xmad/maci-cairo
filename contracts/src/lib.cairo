/// Minimal Anonymous Credentials Infrastructure (MACI).
///
/// Provides the core functionality and primitives used to build and interact with MACI-based
/// systems.
pub mod MACI;

pub mod circuits;

/// Policy implementations and interfaces.
///
/// Provides checkers and enforcers used to validate subjects
/// and apply policy decisions throughout the library.
pub mod policies;

/// Tree data structures and related operations.
///
/// Provides implementations and utilities for cryptographic tree structures, including
/// Merkle-tree-based primitives.
pub mod trees;
