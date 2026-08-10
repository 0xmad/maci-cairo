/// Minimal Anonymous Credentials Infrastructure (MACI).
///
/// Provides the core functionality and primitives used to build and interact with MACI-based
/// systems.
pub mod MACI;

/// Cryptographic primitives and utilities.
///
/// Provides cryptographic operations and supporting
/// functionality used throughout the library.
pub mod crypto;

/// Tree data structures and related operations.
///
/// Provides implementations and utilities for cryptographic tree structures, including
/// Merkle-tree-based primitives.
pub mod trees;

/// General-purpose utility functions and supporting types.
///
/// Contains reusable helpers shared across the library.
pub mod utils;
