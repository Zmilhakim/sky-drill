# How AI tools were used to build Sky Drill

This is the workflow story for the hackathon's "Best AI-Powered Workflow Story" bonus. It is a plain account of
who did what, including the parts that did not go well.

## The setup

- **WebStorm 2026.3** as the IDE, with the `.idea` folder committed.
- **JetBrains Air** inside WebStorm, running **Junie** (the free "Junie Lite" workspace on JetBrains AI).
- **Claude Code**, a second coding agent, working in the same project folder from a terminal.
- One person, new to programming, deciding what the game should be, playing every build and pasting tasks into Air.

The rule we kept: every agent task is small, has a stated boundary ("do not change any other file"), ends with
"run the type check, the tests and the build", and is reviewed before it is committed. Each commit message says
which tool produced the change, so the history can be checked against this document.

## What each tool did

| Step | Tool | Result |
| --- | --- | --- |
| Project scaffold: Vite, TypeScript, Vitest, licence, `.gitignore` | Junie in Air | Worked first time. 8 files, build and sample test passing. |
| Game logic and screens: three drills, scoring, leaderboard, canvas UI, sounds | Claude Code | The bulk of the code. Logic was kept free of browser APIs so it could be tested. |
| Automated play-through in headless Chrome, with screenshots of every screen | Claude Code | Found two bugs before any human played: the saved score showed "#0 today", and a button label overflowed. |
| Unit tests for `src/core` | Junie in Air | 78 tests in one run, all passing, no source bugs found. |
| Review of those tests | Claude Code | Several tests could pass without testing anything (see below). Rewritten; 80 tests now. |
| Start-screen highlight cycle | Junie in Air | Worked. One condition only held for a 1-second highlight; generalised in review by Claude Code. |

## Three things we learned

**1. A bot is a bad judge of difficulty.** The automated player scored 29,000 because it reacts in 350 ms without
fail. The first human run scored 6,376, with 19% on the tracking drill and a comment that the third drill was
confusing. A booth game has to be clear with no tutorial, so the fix was in the game, not in a help text: the
target now stands still at first, a dashed line points from the crosshair to it, and the label switches between
"MOVE YOUR CROSSHAIR HERE" and "SCORING! STAY ON IT". The second human run scored 7,771 with 61% tracking.

**2. Passing tests are not the same as tests that test.** Junie's test for "clicking a teammate costs 300" looked
for a teammate among randomly spawned shapes and, if none appeared, ended with `expect(true).toBe(true)`. It was
green either way. The same pattern appeared in two more tests. In review, Claude Code rewrote them to place the
shape directly and assert exact values, and added boundary tests for the hit radius. (Two commit messages call
this review "by hand"; it was the second agent's review, not a person's.) The TypeScript check also caught five unused
imports that the test runner did not mind.

**3. Small tasks with a boundary beat big ones.** Every Junie task named the files it may touch and the checks it
must run. When a task was pasted with a muddled first half by mistake, Junie still delivered the intended change,
because the last sentence was specific and the boundary was clear.

## What we would do the same way again

- Keep game rules in pure functions and classes that take time steps and pointer events. It made the drills
  testable by an agent, by a headless browser and by people.
- Let one agent write and a different reviewer check. Neither agent reviewed its own work.
- Put the tool name in the commit message.
