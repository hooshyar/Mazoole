// Mazoole levels.
//
// Every level is a little text drawing. One character = one square on the
// paper. To make a new level, copy one below, change the letters, and reload.
// (Or use "Draw your own maze" in the game and press "Copy level".)
//
//   #  wall                    .  floor
//   1  player 1 start (hero)   2  player 2 start (fairy)
//   G  the goal (gift / friend to rescue)
//   a b c  buttons  -> open doors  A B C  (same letter, forever)
//   k  key          -> opens one lock door  L
//   w  wings        -> fly over walls for a few seconds
//   *  star         -> collect them all!
//   h  broken-heart trap (flying over it is safe)
//   m  spiky monster (walks left and right)
//   s  spider       (hangs on a thread: goes up and down)
//   F  angry fairy  (shoots a sparkle beam, time your run!)
//   x  purple plate -> opens every purple gate  X  only while someone stands on it
//                      (flying doesn't count!)
//
// Add  coop: true  to a level that needs two players.
//
// The outside edge must be walls.

window.MAZOOLE_LEVELS = [
  {
    name: "Pencil Practice",
    story: "Press the button, grab the yellow key, and find the gift! Wings let you fly over walls.",
    goal: "gift",
    map: [
      "####################",
      "#1..#.......#......#",
      "#...#..*....L...G..#",
      "#2..#.......#......#",
      "#...#.......########",
      "#...A..###..#......#",
      "#.a.#..#*#..#..w...#",
      "#...#..###.........#",
      "#.k.#.......#..*...#",
      "####################",
    ],
  },
  {
    name: "Bina's Corridor",
    story: "A long, twisty corridor. Watch out for the spiky monster and the angry fairy's beam!",
    goal: "gift",
    map: [
      "########################",
      "#G..B.......F#.........#",
      "###########.##.#######.#",
      "#......#.....#.#.....#.#",
      "#.####.#.#####.#.###.#.#",
      "#.#b.#...#.....#.#*#...#",
      "#.#..#####.#####.#.#####",
      "#.#........#.....#.....#",
      "#.##########.#####.###.#",
      "#..m.........#...#...#.#",
      "####.##.##.###.#.#####.#",
      "#1.......2.....#.......#",
      "########################",
    ],
  },
  {
    name: "Rescue in the Tower",
    story: "Our friend is stuck in bed in the tower! Get the key from the kind girl, sneak past the stairs of broken hearts and the big angry fairy.",
    goal: "friend",
    map: [
      "##########################",
      "#......#................F#",
      "#..G...L.######w######.###",
      "#......#.#....#.#....#.#.#",
      "########.#.##.#.#.k..#...#",
      "#a######.#.#*#.#.#....##.#",
      "#.#......#.###.#.##.###..#",
      "#.#.#######....#........##",
      "#.#.............#######..#",
      "#.#.hh.h..h.#.#.........##",
      "#.###.h..h..#.#....s.....#",
      "#12.A....h.......h.......#",
      "##########################",
    ],
  },
  {
    name: "Two Friends, One Plate",
    story: "A two-player puzzle! Purple gates only stay open while someone stands on a purple plate. Take turns helping each other.",
    goal: "gift",
    coop: true,
    map: [
      "####################",
      "#1..#.......#......#",
      "#...#...x...#..*...#",
      "#2..........X...G..#",
      "#...#...m...#......#",
      "#...#########......#",
      "#...#.....*.#......#",
      "#...X.......#......#",
      "#...#...x...#......#",
      "####################",
    ],
  },
];
