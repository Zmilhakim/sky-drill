# Sky Drill

**The 60-second pro tryout.** A mini game for an esports event booth: three short drills, one score, and a live
leaderboard that works with no network.

Built for the Cloud9 x JetBrains "Sky's the Limit" hackathon 2026, Category 3 (Event Mini Game).

## The game

A fan walks up, clicks once, and plays three drills back to back. Each one tests a skill that competitive players
train every day.

| Drill | Time | What the player does | Skill |
| --- | --- | --- | --- |
| Flick | 20 s | Clicks one target after another. Each new target appears far from the last. | Flick aim and reaction time |
| Hold the Angle | 20 s | Shapes peek out from cover. Clicks the red rivals, never the blue teammates. | Reaction time with trigger discipline |
| Track | 15 s | Keeps the crosshair inside a circle that drifts and speeds up. No clicking. | Smooth tracking |

Then the player gets a result card: total score, a rank from WARM-UP to SKY HIGH, average reaction time, accuracy,
teammates hit and tracking share. They can save the score under a three-letter tag, arcade style.

A full session takes about 70 seconds, including the short countdown before each drill.

## Made for a booth

- **No tutorial.** Each drill starts with one sentence and a three-second countdown. The mouse is the only control.
- **Resets itself.** Every run builds fresh game state. If a player walks away, the game returns to the start
  screen after 12 seconds without input during a run, or 30 seconds on the result screens.
- **Local live leaderboard.** Scores are kept in the browser's local storage. Open `board.html` in a second window
  on a second monitor: it shows today's top ten, the latest run, the fastest reaction and the all-time best, and
  it updates the moment a score is saved. No Wi-Fi and no server are needed.
- **No assets to license.** All graphics are drawn in code and all sounds are generated with the Web Audio API.
  Names, shapes and sounds are original.
- **Any screen.** The game is drawn in a fixed 16:9 field and scaled to fit the window.

### Operator keys

| Key | Where | Action |
| --- | --- | --- |
| `F` | game | Full screen on or off |
| `M` | game | Sound on or off |
| `Esc` | game | Back to the start screen |
| `Ctrl` + `Shift` + `X` | leaderboard | Clear all saved scores (asks first) |

`F` and `M` are ignored while a player is typing a tag.

## Run it

Requires Node.js 20.19 or later (22.12 or later on the 22 line).

```sh
npm install
npm run dev        # development server, prints the address
```

For a booth, build once and serve the built files from the same machine:

```sh
npm run booth      # builds, then serves on http://localhost:4173
```

- Game: `http://localhost:4173/`
- Leaderboard for the second monitor: `http://localhost:4173/board.html`

Both pages must be opened in the same browser on the same machine, because they share that browser's local
storage. After the first `npm install`, nothing needs the internet.

Other commands:

```sh
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript, no output files
npm run build      # production build in dist/
```

## How it is built

TypeScript, Vite and the Canvas 2D API. There is no game engine and no runtime dependency.

```
src/core/     Pure game logic with no browser APIs, covered by unit tests
  rng.ts          seeded random numbers, so a run can be replayed in tests
  flick.ts        drill 1
  hold.ts         drill 2
  track.ts        drill 3
  scoring.ts      run summary and rank ladder
  leaderboard.ts  local score table (validation, sorting, "today")
src/ui/       Screens, drawing and sound
src/main.ts   Canvas setup, input, frame loop
src/board.ts  Second-screen leaderboard
```

The drills know nothing about the screen. Each one takes time steps and pointer events and exposes its state, so
the same code runs in the browser and in the tests.

## JetBrains tools used

- **WebStorm 2026.3** is the IDE for the project. The `.idea` folder is committed.
- **JetBrains Air with Junie** (inside WebStorm) scaffolded the Vite + TypeScript project and wrote the first
  version of the unit tests for `src/core`. Those tests were then reviewed by hand; several that could pass
  without exercising their branch were rewritten. The commit history shows which commits came from which step.

## Licence

MIT. See [LICENSE](LICENSE).
