# Mazoole ✏️

**Mazes drawn by hand, played together.**

Mazoole started as pencil drawings in a spiral notebook, made by a parent and
daughter together. This repo turns those drawings into a small co-op browser game that
keeps the look of the notebook: wobbly pencil walls, crayon colors, stick-figure
heroes.

![Bina's corridor](drawings/bina-corridor.jpg)

## Play

Open `index.html` in a browser. There's no install and no build step. Double-clicking the file works.

**Online:** every push to `main` publishes the game to GitHub Pages
(`https://<owner>.github.io/<repo>/`). One-time setup: in the repo, go to
**Settings → Pages → Source** and choose **GitHub Actions**.

| Who | Keys | Tablet / phone |
|---|---|---|
| **Hero** (player 1, red cape) | `W` `A` `S` `D` | left pad |
| **Fairy** (player 2, butterfly wings) | arrow keys | right pad |
| Restart the level | `R` | ↺ button |
| Menu | `Esc` | ☰ button |

In 1-player mode, both the arrow keys and WASD move the hero.

**Goal:** reach the gift (or rescue the friend in bed). If *either* player gets
there, you both win. You share 5 hearts.

| Thing | What it does |
|---|---|
| 🔴 button in a picture frame | Step on it and the door of the same color opens for good |
| 🟡 key | Opens one scribbled lock door |
| 🦋 wings | Fly over walls for 6 seconds. A ring shows the time left and turns red near the end. Flying also keeps you safe from traps, monsters and spiders |
| ⭐ star | Bonus. Some are sealed inside boxes, so you need wings to reach them |
| 💔 staircase with a broken heart | Trap. Costs a heart unless you fly over it |
| Spiky green monster, spider | Walk back and forth. Dodge them using the side nooks |
| Angry fairy | Shoots a sparkle beam down her corridor. A dotted line warns you before she fires. Wait in a nook and then run! |
| 🍬 candy | 10 points. Grab them quickly one after another for a combo, up to ×5 |
| 🧊 ice | You slide until something stops you. Plan your slides! |
| 🌀 portals `3`–`9` | Step on one and pop out of the other portal with the same number |
| 👻 ghost | Chases whoever is closest, but only when you're near. Flying keeps you safe. After catching someone it goes home and sleeps for a moment |
| 🟪 purple plate | Opens every purple gate, but **only while someone stands on it**. Flying doesn't count. Level 4 needs both players to take turns |

## What we saw in the drawings

The **castle drawing** (`drawings/castle-rescue.jpg`) became level 3, *Rescue in the Tower*:
- The caped stick figure at the bottom left is **the hero** and the starting point.
- The girl lying on the bed in the tower is **the friend to rescue**, which is the goal.
- The smiling girl holding something yellow gives you **the key**. The scribbled
  door beside her is **the lock**.
- The staircase with the broken heart became the **broken-heart traps**.
- The box with a square inside became the **sealed star box**. You need wings to get in.
- The girl flying near the top gave us **the wings power-up**.
- The big angry fairy on the right became the **fairy who shoots a beam**.
- The little framed picture in the corner became the **button** that opens the red door.

The **long corridor drawing** (`drawings/bina-corridor.jpg`) became level 2, *Bina's Corridor*:
- The red door with the present at the end is **the gift** (the goal).
- The spiky creature with teeth is **the monster**. The spider on the right is **the spider**.
- The angry fairy's long line aimed along the top is **the beam**.

Level 1, *Pencil Practice*, is a short tutorial that teaches each item once.
Level 4, *Two Friends, One Plate*, is a two-player puzzle built around the purple plates.

The newer levels each show off one idea:

| Level | Idea |
|---|---|
| 5. Candy Trail | A candy maze with a chasing ghost. Collect the key and escape through the loops |
| 6. Slippery Pond | An ice puzzle. The gift needs 7 planned slides |
| 7. Portal Party | Four rooms with no doors between them, connected only by numbered portals |
| ★ The Fairy Queen's Castle | The secret level. It unlocks at 12 medals and combines ice, portals, a ghost, traps and the fairy's beam |

## Points, medals and stickers

- **Points:** candy 10 (×combo), star 100, key/button/unlock 25, wings 15. Points pop up where you grab them.
- **The score sheet** at the end adds a time bonus (10 points for every second under the clock), 50 for each heart left, and 300 if nobody said ouch.
- **Three medals per maze**, shown on the intro card before you start: ① finish ② collect every star ③ beat the clock. Medals stay earned, so you can go back for the one you missed.
- **Best scores and medals** show on each level card. The total medal count unlocks the secret level.
- **Sticker book:** 14 stickers, such as *Untouchable*, *Candy Combo*, *Ghost Buster*, *Ice Skater*, *Portal Hopper* and *Best Friends*. A new sticker pops up the moment you earn it.

Everything is saved in the browser you play in.

## Make your own maze

**In the game:** open the menu and choose **✏️ Draw your own maze**. Pick a tool
and paint with the mouse or a finger, then press **Play it!**. Your maze is saved in the
browser and appears in the menu. Press **Copy level** to get its text.

**From a photo:** in the maze painter, press **📷 From a photo** and pick a picture
of a drawing. Mazoole finds the paper, turns the pencil lines into walls, and puts
the hero and the goal as far apart as it can. The result is a rough draft: the photo stays
faintly underneath, so you can trace over it. Paint the missing walls, erase stray
ones, and add doors and monsters. The **Lines** slider sets how faint a line can be
and still count as a wall.

**Your own sounds:** in the menu, press **🎤 Our sounds** to record a short clip
for each moment: key, star, button, lock, wings, ouch, hooray and "oh no". If
the microphone isn't allowed, upload a sound file instead. Sounds are saved in
this browser only.

**In code:** every level is a small text drawing in [`js/levels.js`](js/levels.js),
one character per square:

```
#  wall             .  floor           1  hero start      2  fairy start
G  goal             a b c  buttons     A B C  doors (same letter)
k  key              L  lock door       w  wings           *  star
h  heart trap       m  monster         s  spider          F  angry fairy
x  purple plate     X  purple gate (open only while someone is on a plate)
+  candy            ~  ice             3-9  portal pairs   g  ghost
```

Optional level settings: `par: 40` sets the seconds for the clock medal (otherwise it's
worked out from the maze), and `bonus: 12` hides the level until 12 medals are collected.

Add `coop: true` to a level that needs two players.

Paste a copied level into the `MAZOOLE_LEVELS` list and it shows up in the menu.

## How it's built (for grown-ups)

It's plain HTML, CSS and JavaScript, with no framework, no build step and no dependencies apart from one Google Font. The renderer falls back to Comic Sans if the font doesn't load.

| File | Job |
|---|---|
| `js/draw.js` | Pencil-style drawing: wobbly strokes, crayon fill, every sprite. Characters "boil" (redraw with new wobble) 6× a second, like hand-drawn animation. |
| `js/levels.js` | The levels as text maps |
| `js/game.js` | Grid movement, buttons and doors, keys, wings, monsters, fairy beams, hearts, co-op input, touch pads, sound effects (small WebAudio beeps, no audio files) |
| `js/editor.js` | The in-game maze painter |
| `js/photo.js` | Photo → maze: finds the paper, detects pencil lines with a local-contrast threshold, snaps them to a grid |
| `js/voices.js` | Records and plays your own sound effects |
| `js/progress.js` | Medals, best scores and the sticker book |
| `tools/bundle.py` | Packs everything into one HTML file, for sharing a single file |

Design choices:
- **Movement is tile by tile, animated smoothly.** Collisions stay simple and exact, it's easy for young players, and levels can be written as text.
- **Buttons stay pressed** so the game works for one player. Co-op comes from splitting up: one player dodges the monster while the other goes for the key.
- **No softlocks.** If the wings run out over a wall, you drift down to the nearest floor. If you land in a sealed room, you float back to where you picked up the wings.

### Deploy
The site is static, so any static host works. On GitHub Pages, go to Settings → Pages, choose "Deploy from branch" and pick the branch.

## Ideas for next time
- Smarter photo reading: recognize drawn doors, stars and creatures and place them automatically.
- More powers: shrink to fit through cracks, a lantern for dark mazes, a time-freeze.
- Share a maze with a link, so friends can play it on their own devices.
