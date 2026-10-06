# Clean code — every change

Report these as **suggestions** only. They never make a review BLOCKING. Formatting is Prettier's job; never comment on it.

- **Names** say what a thing is or does, in the domain's words (therapy, session, room, client, attendance); no `data`, `tmp`, `handle2`. Older code says course, class and student for therapy, room and client — follow the surrounding code.
- **Duplication**: the same logic in two places should become one function, hook or component — unless the copies are about to diverge.
- **Size**: a function doing several steps is split into named steps; deep nesting replaced by early returns.
- **Dead code**: unused exports, parameters, branches and commented-out code are removed.
- **Comments** explain _why_ (a constraint, a trade-off, a past bug), never restate the code.
- **Consistency** with the surrounding code beats personal preference: same idioms, same patterns, same error handling.
- **Simplicity**: no abstraction, option or generality the change does not need yet.
