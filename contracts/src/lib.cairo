/// Minimal Anonymous Credentials Infrastructure (MACI).
///
/// Provides the core functionality and primitives used to build and interact with MACI-based
/// systems.
pub mod MACI;

/// Poll management and voting functionality.
///
/// Provides the core functionality and primitives used to create, configure,
/// and interact with polls in MACI-based systems.
pub mod Poll;

/// Poll factory functionality.
///
/// Provides the functionality required to create and initialize polls with
/// their associated configuration and dependencies.
pub mod PollFactory;

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

/// Vote-balance assignment used at Signup.
///
/// Provides the vote-balance assigner MACI calls to obtain the vote
/// balance bound into a state-tree leaf.
pub mod vote_balance;
