# Vote ledger

One file per round, named after the episode it decided (`day-001.json`).

- **Top-comment rounds** are written by the "Snapshot votes" workflow, straight from
  Instagram's official API: every eligible comment's like count at the deadline, ranked.
- **Poll rounds** are recorded by hand, with the options, the vote split and a screenshot.

After each round, `winner` and `decision_note` are filled in. If the top-ranked idea
was not built as written, `decision_note` says why.
