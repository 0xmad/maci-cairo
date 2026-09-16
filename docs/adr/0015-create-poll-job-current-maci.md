# Console Create Poll targets the MACI in the URL

Operator Create Poll is a second ops job against the recorded MACI in the path
(`POST /macis/:address/poll`). The form is schedule and Poll public key. Poll
inherits `state_tree_depth`, `vote_options`, `batch_size`, and
`empty_live_ballot_root` from that MACI (ADR-0014). The Operator cannot paste
another MACI address in the body. Create Poll is rejected while a job is running
or an incomplete stand-up checkpoint exists.

Succeeded Polls are stored with schedule and Poll public key and listed with
`GET /macis/:address/polls`.

We rejected collecting vote options or batch size on this form, sending a dummy
live-ballot root on `create_poll`, and changing `make create-poll` JSON. The
CLI still always invokes; the job freezes `next_poll_id` and skips invoke when
`get_poll` is already nonzero. On-chain `coordinator()` must match the stored
MACI coordinator (the CLI default remains seed-0 `devnet-1`).
