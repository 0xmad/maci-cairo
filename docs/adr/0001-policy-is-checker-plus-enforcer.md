# Policy is Checker plus Enforcer

Signup eligibility is not a hard-coded gate inside MACI. A Policy is a Checker
(stateless check of Subject + evidence) plus an Enforcer (records that a
Subject was enforced and calls the Checker). New rules are new implementations
of those two roles.
