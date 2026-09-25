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
//   +  candy        -> 10 points (grab them fast for a combo!)
//   ~  ice          -> you slide until something stops you
//   3 4 5 ... 9  portals: step on one and pop out of the other with the same number
//   g  ghost        (chases you! wings make you safe from it)
//
// Optional:  par: 40  = seconds to beat for the clock medal
//            bonus: 12  = medals needed to unlock the level
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
  {
    name: "Candy Trail",
    story: "Gobble the candy trail! A scribble ghost chases you, but wings make you safe. Find the key to open the gift.",
    goal: "gift",
    map: [
      "#####################",
      "#*+++++++++++++++++*#",
      "#+###+#####+#####+#+#",
      "#+#w#+++++#+#+++#+#+#",
      "#+#+#+###+#+#+#+#+g+#",
      "#1++++++++++++#+++#+#",
      "#2###+#+##+##+#+#+#+#",
      "#+++#+#++#L#++#+#k#+#",
      "#+#+#+####G######+#+#",
      "#*+++++++++++++++++*#",
      "#####################",
    ],
  },
  {
    name: "Slippery Pond",
    story: "The pond is frozen! Once you start sliding you can't stop until you bump into something. Plan your slides to reach the stars.",
    goal: "gift",
    map: [
      "####################",
      "#1..#~~~~~~~~~~~~~*#",
      "#2..~~~~~~~#~~~~~~~#",
      "#...#~~~~~~~~~~#~~~#",
      "##.##~~~~#~#~~~~~~~#",
      "#*~~~~~~~~~~~~~#~~~#",
      "#~~~~#~~~~~~~~~~~~~#",
      "#~~~~~~~~~#~~~~~~#~#",
      "#~~~#~~~~~~~~*~~~~G#",
      "####################",
    ],
  },
  {
    name: "Portal Party",
    story: "Four rooms, no doors between them. Step on a swirly portal to pop out of the one with the same number!",
    goal: "friend",
    map: [
      "######################",
      "#1....3#*...5#......F#",
      "#2.....#.....#.......#",
      "#......#..m..#...4...#",
      "#..*...#.....#.......#",
      "########.....####L####",
      "#....5.#.....#.......#",
      "#......###.###...G...#",
      "#.k....F.....#.......#",
      "#....4.#.3...#..*....#",
      "######################",
    ],
  },
  {
    name: "The Fairy Queen's Castle",
    story: "The secret last castle! Everything you've learned: ice, portals, keys, ghosts and the angry fairy queen. Good luck, heroes!",
    goal: "friend",
    bonus: 12,
    map: [
      "##########################",
      "#1...#~~~~~~~#+++++++++*+#",
      "#2...~~~~#~~~~+###+###+#+#",
      "#....#~~~~~~~#+#w#+++#+#+#",
      "##3###~~~~#~~~+#+#+#+#+#+#",
      "#++++#########+++++#g+++k#",
      "#+##+#.....a.......####A##",
      "#+#*+#.h..h..h.....####.##",
      "#++++#.......##########L##",
      "######...3...#++++++++++*#",
      "#F........h..#+++++++++++#",
      "#............#++++++++++G#",
      "##########################",
    ],
  },
];
