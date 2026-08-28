# Vote-balance assigner is not Policy

Vote balance is assigned at Signup by a vote-balance assigner, not by
Policy, Checker, or Enforcer. Eligibility stays yes/no on a Subject;
the assigner is a separate, read-only role that returns the vote balance
MACI binds into the leaf. New assignment rules (constant, token, later
others) are new implementations of that role and a new MACI, not a third
Policy contract or a Checker that returns an amount.
