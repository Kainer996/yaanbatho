/* Original fictional Alderwing village tales; no real-world bird facts. */
(function(root){'use strict';const content={
  "quests": [
    {
      "id": "vq01",
      "title": "The Missing Lunch Bell",
      "intro": "Our little folk keep arriving for lunch at different times. The bell has lost its voice.",
      "steps": [
        {
          "label": "Find the brass clapper",
          "done": "Found the brass clapper."
        },
        {
          "label": "Fit the clapper to the lunch bell",
          "done": "Fitted the clapper to the lunch bell."
        },
        {
          "label": "Ring the repaired bell",
          "done": "Rang the repaired bell."
        }
      ],
      "outro": "One clear note brings the neighbours together. Nobody has to eat alone."
    },
    {
      "id": "vq02",
      "title": "Buttons for the Rain",
      "intro": "The villagers have made rain capes, but their buttons rolled away.",
      "steps": [
        {
          "label": "Gather the blue buttons",
          "done": "Gathered the blue buttons."
        },
        {
          "label": "Gather the wooden buttons",
          "done": "Gathered the wooden buttons."
        },
        {
          "label": "Leave the buttons in the sewing basket",
          "done": "Left the buttons in the sewing basket."
        }
      ],
      "outro": "The Peeps fasten their capes and proudly practise being waterproof."
    },
    {
      "id": "vq03",
      "title": "A Letter Under a Stone",
      "intro": "A shy neighbour left an apology but cannot remember which stone hides it.",
      "steps": [
        {
          "label": "Read the stone with a chalk heart",
          "done": "Read the stone with a chalk heart."
        },
        {
          "label": "Recover the folded apology",
          "done": "Recovered the folded apology."
        },
        {
          "label": "Deliver the apology to the reply box",
          "done": "Delivered the apology to the reply box."
        }
      ],
      "outro": "A little note comes back: Friends again. The heart now has two names."
    },
    {
      "id": "vq04",
      "title": "Lanterns for Home",
      "intro": "The late-working villagers need a trail of lights to find their way home.",
      "steps": [
        {
          "label": "Collect the lantern wicks",
          "done": "Collected the lantern wicks."
        },
        {
          "label": "Light the first path lantern",
          "done": "Lit the first path lantern."
        },
        {
          "label": "Light the homeward lantern",
          "done": "Lit the homeward lantern."
        }
      ],
      "outro": "The folk follow the warm lights, waving goodnight at every turn."
    },
    {
      "id": "vq05",
      "title": "The Crooked Scarecrow",
      "intro": "Our scarecrow frightens the children more than the shadows. Please help us soften its face.",
      "steps": [
        {
          "label": "Find the patchwork smile",
          "done": "Found the patchwork smile."
        },
        {
          "label": "Mend the scarecrow face",
          "done": "Mended the scarecrow face."
        },
        {
          "label": "Tie on the friendly ribbon",
          "done": "Tied on the friendly ribbon."
        }
      ],
      "outro": "The little folk name it Uncle Straw and bring it a pretend cup of tea."
    },
    {
      "id": "vq06",
      "title": "Three Notes for a Birthday",
      "intro": "The neighbours want a surprise birthday tune, but each remembers a different bit.",
      "steps": [
        {
          "label": "Read the first neighbour’s tune card",
          "done": "Read the first neighbour’s tune card."
        },
        {
          "label": "Read the second neighbour’s tune card",
          "done": "Read the second neighbour’s tune card."
        },
        {
          "label": "Arrange the birthday music",
          "done": "Arranged the birthday music."
        }
      ],
      "outro": "The Peeps hum the tune together. The birthday guest joins in before the surprise."
    },
    {
      "id": "vq07",
      "title": "A Wheel for the Handcart",
      "intro": "The villagers’ small handcart has shed its wheel beside the path.",
      "steps": [
        {
          "label": "Retrieve the loose wheel",
          "done": "Retrieved the loose wheel."
        },
        {
          "label": "Find the axle pin",
          "done": "Found the axle pin."
        },
        {
          "label": "Repair the handcart",
          "done": "Repaired the handcart."
        }
      ],
      "outro": "The neighbours give their cart a careful test push and a very grand name."
    },
    {
      "id": "vq08",
      "title": "The Quiet Games",
      "intro": "A resting villager needs peace, and the children want something to play.",
      "steps": [
        {
          "label": "Collect the painted pebbles",
          "done": "Collected the painted pebbles."
        },
        {
          "label": "Lay out a quiet pebble game",
          "done": "Laid out a quiet pebble game."
        }
      ],
      "outro": "The children play in whispers. Their tiny victory dances are nearly silent."
    },
    {
      "id": "vq09",
      "title": "Seed Labels in a Tangle",
      "intro": "Our planting labels blew loose. The gardeners need their picture clues matched again.",
      "steps": [
        {
          "label": "Read the round-seed sketch",
          "done": "Read the round-seed sketch."
        },
        {
          "label": "Find the matching seed packet",
          "done": "Found the matching seed packet."
        },
        {
          "label": "Return the packet to the labelled basket",
          "done": "Returned the packet to the labelled basket."
        }
      ],
      "outro": "The gardeners put the pictures back in order and stop calling every seed a bean."
    },
    {
      "id": "vq10",
      "title": "A Toast to the Brave",
      "intro": "The village folk want to thank the birds who guard Alderwing.",
      "steps": [
        {
          "label": "Collect the thank-you ribbons",
          "done": "Collected the thank-you ribbons."
        },
        {
          "label": "Hang the first ribbon",
          "done": "Hung the first ribbon."
        },
        {
          "label": "Hang the ribbon of welcome",
          "done": "Hung the ribbon of welcome."
        }
      ],
      "outro": "The Peeps leave their messages at bird height, carefully remembering how small a robin is."
    },
    {
      "id": "vq11",
      "title": "The Borrowed Hammer",
      "intro": "One neighbour borrowed another’s hammer and forgot where it went.",
      "steps": [
        {
          "label": "Follow the chalk hammer clue",
          "done": "Followed the chalk hammer clue."
        },
        {
          "label": "Recover the borrowed hammer",
          "done": "Recovered the borrowed hammer."
        },
        {
          "label": "Place it in the tool-return box",
          "done": "Placed it in the tool-return box."
        }
      ],
      "outro": "The borrower adds a thank-you pebble. The owner leaves a matching smile."
    },
    {
      "id": "vq12",
      "title": "Clouds in a Jar",
      "intro": "The children asked for a cloud. Their elder suggests something kinder to the sky.",
      "steps": [
        {
          "label": "Collect a tuft of fallen wool",
          "done": "Collected a tuft of fallen wool."
        },
        {
          "label": "Find the blue glass jar",
          "done": "Found the blue glass jar."
        },
        {
          "label": "Make the pretend cloud",
          "done": "Made the pretend cloud."
        }
      ],
      "outro": "The children admire their cloud and agree the real ones should stay free."
    },
    {
      "id": "vq13",
      "title": "The Supper Seating Puzzle",
      "intro": "Two villagers both want the sunny seat at the shared supper.",
      "steps": [
        {
          "label": "Read the first seating request",
          "done": "Read the first seating request."
        },
        {
          "label": "Read the second seating request",
          "done": "Read the second seating request."
        },
        {
          "label": "Set out the turn-taking cards",
          "done": "Set out the turn-taking cards."
        }
      ],
      "outro": "The neighbours agree to swap halfway through supper. Both get the sunny seat."
    },
    {
      "id": "vq14",
      "title": "A Ribbon for the Lost",
      "intro": "A villager has lost a keepsake ribbon from before the shadows came.",
      "steps": [
        {
          "label": "Check the snagged cloth clue",
          "done": "Checked the snagged cloth clue."
        },
        {
          "label": "Recover the faded ribbon",
          "done": "Recovered the faded ribbon."
        }
      ],
      "outro": "The owner smooths the ribbon with both hands. Some small things carry whole homes."
    },
    {
      "id": "vq15",
      "title": "The Puddle Crossing",
      "intro": "The little folk have been hopping over a muddy patch with very mixed success.",
      "steps": [
        {
          "label": "Collect a flat stepping stone",
          "done": "Collected a flat stepping stone."
        },
        {
          "label": "Set the first stepping stone",
          "done": "Set the first stepping stone."
        },
        {
          "label": "Set the second stepping stone",
          "done": "Set the second stepping stone."
        }
      ],
      "outro": "The neighbours cross with dry feet and unnecessary ceremony."
    },
    {
      "id": "vq16",
      "title": "The Sleepy Watch",
      "intro": "The evening watch keeps forgetting whose turn comes next.",
      "steps": [
        {
          "label": "Read the watch’s picture roster",
          "done": "Read the watch’s picture roster."
        },
        {
          "label": "Collect the wooden turn token",
          "done": "Collected the wooden turn token."
        },
        {
          "label": "Leave the token at the watch post",
          "done": "Left the token at the watch post."
        }
      ],
      "outro": "The watch passes one token from hand to hand. Nobody has to remember alone."
    },
    {
      "id": "vq17",
      "title": "A Gift for the Smallest",
      "intro": "The villagers are making a welcome gift for their smallest neighbour.",
      "steps": [
        {
          "label": "Find the tiny wooden cup",
          "done": "Found the tiny wooden cup."
        },
        {
          "label": "Find the soft carrying cloth",
          "done": "Found the soft carrying cloth."
        },
        {
          "label": "Wrap the welcome parcel",
          "done": "Wrapped the welcome parcel."
        }
      ],
      "outro": "The smallest neighbour has a cup that fits. Everyone else tries to look casual about it."
    },
    {
      "id": "vq18",
      "title": "The Story with No Ending",
      "intro": "Our storyteller’s last page blew away just before the exciting part.",
      "steps": [
        {
          "label": "Find the page about the storm",
          "done": "Found the page about the storm."
        },
        {
          "label": "Find the page about the lantern",
          "done": "Found the page about the lantern."
        },
        {
          "label": "Put the ending in the story box",
          "done": "Put the ending in the story box."
        }
      ],
      "outro": "The folk learn that the hero shared the lantern. It was enough light for two."
    },
    {
      "id": "vq19",
      "title": "Footprints by the Basket",
      "intro": "Someone moved the villagers’ picnic basket. The chalk clues may explain why.",
      "steps": [
        {
          "label": "Inspect the small muddy prints",
          "done": "Inspected the small muddy prints."
        },
        {
          "label": "Read the rain-warning note",
          "done": "Read the rain-warning note."
        },
        {
          "label": "Find the sheltered picnic basket",
          "done": "Found the sheltered picnic basket."
        }
      ],
      "outro": "A helpful neighbour saved the picnic from rain. The mystery ends with thanks."
    },
    {
      "id": "vq20",
      "title": "The Kindness Chain",
      "intro": "A villager wants to pass on a kindness without taking credit.",
      "steps": [
        {
          "label": "Collect the anonymous gift",
          "done": "Collected the anonymous gift."
        },
        {
          "label": "Deliver it to the kindness basket",
          "done": "Delivered it to the kindness basket."
        },
        {
          "label": "Read the new thank-you note",
          "done": "Read the new thank-you note."
        }
      ],
      "outro": "The next neighbour adds a gift of their own. The chain has begun."
    },
    {
      "id": "vq21",
      "title": "A Safe Place for Pins",
      "intro": "The sewing circle spilled its pins along the paths.",
      "steps": [
        {
          "label": "Recover the first pin cushion",
          "done": "Recovered the first pin cushion."
        },
        {
          "label": "Recover the second pin cushion",
          "done": "Recovered the second pin cushion."
        },
        {
          "label": "Close the sewing tin",
          "done": "Closed the sewing tin."
        }
      ],
      "outro": "The sewing folk count their pins twice, then give the tin a warning face."
    },
    {
      "id": "vq22",
      "title": "The Festival Pennant",
      "intro": "The villagers’ festival flag is missing its bright centre.",
      "steps": [
        {
          "label": "Find the sun patch",
          "done": "Found the sun patch."
        },
        {
          "label": "Find the green edging",
          "done": "Found the green edging."
        },
        {
          "label": "Mend the festival pennant",
          "done": "Mended the festival pennant."
        }
      ],
      "outro": "The Peeps raise their little flag and cheer as if it can hear them."
    },
    {
      "id": "vq23",
      "title": "The Errant Recipe",
      "intro": "The village cooks mixed the recipe pictures into the shopping notes.",
      "steps": [
        {
          "label": "Read the pot-shaped clue",
          "done": "Read the pot-shaped clue."
        },
        {
          "label": "Recover the supper recipe",
          "done": "Recovered the supper recipe."
        },
        {
          "label": "Put the recipe in its wooden frame",
          "done": "Put the recipe in its wooden frame."
        }
      ],
      "outro": "The cooks can follow their own pictures again. The frame is wiped with great care."
    },
    {
      "id": "vq24",
      "title": "A Chime for the Breeze",
      "intro": "The villagers want a gentle sound beside their gathering place.",
      "steps": [
        {
          "label": "Collect the smooth chime pieces",
          "done": "Collected the smooth chime pieces."
        },
        {
          "label": "Thread the chime cord",
          "done": "Threaded the chime cord."
        },
        {
          "label": "Hang the little wind chime",
          "done": "Hung the little wind chime."
        }
      ],
      "outro": "The folk stop talking for a moment, just to hear the breeze have its turn."
    },
    {
      "id": "vq25",
      "title": "The Two Matching Mittens",
      "intro": "Two villagers each have a left mitten and insist the other has the right one.",
      "steps": [
        {
          "label": "Read the striped mitten label",
          "done": "Read the striped mitten label."
        },
        {
          "label": "Find the plain mitten bundle",
          "done": "Found the plain mitten bundle."
        },
        {
          "label": "Sort the two pairs",
          "done": "Sorted the two pairs."
        }
      ],
      "outro": "Both neighbours hold up warm hands. The argument was mostly about stripes."
    },
    {
      "id": "vq26",
      "title": "The Moon Parade",
      "intro": "The children want to walk a tiny parade without waking the village.",
      "steps": [
        {
          "label": "Collect the paper moons",
          "done": "Collected the paper moons."
        },
        {
          "label": "Hang a moon at the first stop",
          "done": "Hung a moon at the first stop."
        },
        {
          "label": "Hang a moon at the final stop",
          "done": "Hung a moon at the final stop."
        }
      ],
      "outro": "The parade proceeds in proud silence, apart from one whispered toot."
    },
    {
      "id": "vq27",
      "title": "A Bench Full of Splinters",
      "intro": "The neighbours’ little rest bench catches everyone’s sleeves.",
      "steps": [
        {
          "label": "Find the smoothing stone",
          "done": "Found the smoothing stone."
        },
        {
          "label": "Smooth the bench edge",
          "done": "Smoothed the bench edge."
        },
        {
          "label": "Tie on the ready-to-sit ribbon",
          "done": "Tied on the ready-to-sit ribbon."
        }
      ],
      "outro": "The first sitter pats the bench approvingly and promptly falls asleep."
    },
    {
      "id": "vq28",
      "title": "The Missing Game Piece",
      "intro": "The village’s favourite board game cannot finish without its last piece.",
      "steps": [
        {
          "label": "Read the game-board sketch",
          "done": "Read the game-board sketch."
        },
        {
          "label": "Find the carved acorn piece",
          "done": "Found the carved acorn piece."
        },
        {
          "label": "Return the piece to the game box",
          "done": "Returned the piece to the game box."
        }
      ],
      "outro": "The folk finish yesterday’s game. They immediately ask for another."
    },
    {
      "id": "vq29",
      "title": "A Welcome in Pictures",
      "intro": "A new neighbour cannot read the village’s old written welcome.",
      "steps": [
        {
          "label": "Collect the house picture",
          "done": "Collected the house picture."
        },
        {
          "label": "Collect the friendly-hand picture",
          "done": "Collected the friendly-hand picture."
        },
        {
          "label": "Arrange the picture welcome",
          "done": "Arranged the picture welcome."
        }
      ],
      "outro": "The newcomer understands at once: a home, a hand, and room for one more."
    },
    {
      "id": "vq30",
      "title": "The Humming Stones",
      "intro": "The children think a stone hums. Their elder asks for a careful little investigation.",
      "steps": [
        {
          "label": "Listen beside the first marked stone",
          "done": "Listened beside the first marked stone."
        },
        {
          "label": "Listen beside the second marked stone",
          "done": "Listened beside the second marked stone."
        },
        {
          "label": "Read the hidden reed-whistle note",
          "done": "Read the hidden reed-whistle note."
        }
      ],
      "outro": "A neighbour has been practising a reed whistle. The children ask for a lesson."
    },
    {
      "id": "vq31",
      "title": "The Rain Gauge",
      "intro": "The gardeners need help remembering how much rain fell.",
      "steps": [
        {
          "label": "Find the marked measuring stick",
          "done": "Found the marked measuring stick."
        },
        {
          "label": "Set it beside the rain cup",
          "done": "Set it beside the rain cup."
        },
        {
          "label": "Place the rain picture in the log",
          "done": "Placed the rain picture in the log."
        }
      ],
      "outro": "The gardeners keep a simple picture record. Their guesses finally get a rest."
    },
    {
      "id": "vq32",
      "title": "The Unfinished Quilt",
      "intro": "The neighbours are stitching a quilt from scraps of their old homes.",
      "steps": [
        {
          "label": "Recover the checked cloth square",
          "done": "Recovered the checked cloth square."
        },
        {
          "label": "Recover the flowered cloth square",
          "done": "Recovered the flowered cloth square."
        },
        {
          "label": "Lay the squares in the quilt basket",
          "done": "Laid the squares in the quilt basket."
        }
      ],
      "outro": "No two squares match. The folk decide that is exactly why it is beautiful."
    },
    {
      "id": "vq33",
      "title": "The Door That Knocked",
      "intro": "A villager is worried by a knocking sound on still evenings.",
      "steps": [
        {
          "label": "Read the neighbour’s sound sketch",
          "done": "Read the neighbour’s sound sketch."
        },
        {
          "label": "Inspect the loose hanging sign",
          "done": "Inspected the loose hanging sign."
        },
        {
          "label": "Fasten the sign’s soft backing",
          "done": "Fastened the sign’s soft backing."
        }
      ],
      "outro": "The knocking stops. The villager leaves a relieved little thank-you drawing."
    },
    {
      "id": "vq34",
      "title": "The Picnic Promise",
      "intro": "The little folk promised a picnic to a neighbour who cannot carry a basket.",
      "steps": [
        {
          "label": "Pick up the picnic cloth",
          "done": "Picked up the picnic cloth."
        },
        {
          "label": "Collect the packed cups",
          "done": "Collected the packed cups."
        },
        {
          "label": "Leave the picnic parcel at the meeting marker",
          "done": "Left the picnic parcel at the meeting marker."
        }
      ],
      "outro": "The neighbours share the carrying. Nobody has to miss the outing."
    },
    {
      "id": "vq35",
      "title": "The Silver Paper Star",
      "intro": "A child made a star for the village, but the wind took it.",
      "steps": [
        {
          "label": "Follow the glittering paper scrap",
          "done": "Followed the glittering paper scrap."
        },
        {
          "label": "Recover the folded star",
          "done": "Recovered the folded star."
        },
        {
          "label": "Hang it on the wish stand",
          "done": "Hung it on the wish stand."
        }
      ],
      "outro": "The child wishes for everyone to get one nice surprise. This may already count."
    },
    {
      "id": "vq36",
      "title": "The Unlabelled Keys",
      "intro": "The tool keepers have three keys and no idea which is which.",
      "steps": [
        {
          "label": "Read the tool-box key sketch",
          "done": "Read the tool-box key sketch."
        },
        {
          "label": "Find the matching key ring",
          "done": "Found the matching key ring."
        },
        {
          "label": "Attach the picture labels",
          "done": "Attached the picture labels."
        }
      ],
      "outro": "The keepers stop trying every key in every lock, though one does a final check."
    },
    {
      "id": "vq37",
      "title": "The Friend Seat",
      "intro": "A lonely villager wants a way to ask for company without a speech.",
      "steps": [
        {
          "label": "Find the painted friendship sign",
          "done": "Found the painted friendship sign."
        },
        {
          "label": "Set the sign beside the meeting mat",
          "done": "Set the sign beside the meeting mat."
        }
      ],
      "outro": "The sign says Sit with me in simple pictures. A neighbour soon does."
    },
    {
      "id": "vq38",
      "title": "The Festival Rhythm",
      "intro": "The villagers’ little drum circle cannot agree on when to begin.",
      "steps": [
        {
          "label": "Read the slow-beat card",
          "done": "Read the slow-beat card."
        },
        {
          "label": "Read the answering-beat card",
          "done": "Read the answering-beat card."
        },
        {
          "label": "Set the shared starting flag",
          "done": "Set the shared starting flag."
        }
      ],
      "outro": "They raise the flag, start together, and enjoy being almost in time."
    },
    {
      "id": "vq39",
      "title": "A Map for Small Feet",
      "intro": "The village children are making a picture map of their favourite paths.",
      "steps": [
        {
          "label": "Stamp the first path marker",
          "done": "Stamped the first path marker."
        },
        {
          "label": "Stamp the second path marker",
          "done": "Stamped the second path marker."
        },
        {
          "label": "Return the little map to its folder",
          "done": "Returned the little map to its folder."
        }
      ],
      "outro": "The map has more hearts than directions. The children know exactly what it means."
    },
    {
      "id": "vq40",
      "title": "The Mended Toy Boat",
      "intro": "A neighbour’s toy boat split along its seam. It has important pretend voyages ahead.",
      "steps": [
        {
          "label": "Find the wooden hull",
          "done": "Found the wooden hull."
        },
        {
          "label": "Collect the repair twine",
          "done": "Collected the repair twine."
        },
        {
          "label": "Mend the toy boat on its mat",
          "done": "Mended the toy boat on its mat."
        }
      ],
      "outro": "The boat is ready for imagined oceans. Its captain salutes you with both hands."
    },
    {
      "id": "vq41",
      "title": "The Spare Blanket",
      "intro": "The village folk want a warm parcel ready for the next tired traveller.",
      "steps": [
        {
          "label": "Collect the folded spare blanket",
          "done": "Collected the folded spare blanket."
        },
        {
          "label": "Find the welcome tag",
          "done": "Found the welcome tag."
        },
        {
          "label": "Pack the traveller’s bundle",
          "done": "Packed the traveller’s bundle."
        }
      ],
      "outro": "The tag shows a bed and a friendly face. No traveller needs to ask twice."
    },
    {
      "id": "vq42",
      "title": "The Tidy Tool Trail",
      "intro": "The repair circle left its things scattered after a busy afternoon.",
      "steps": [
        {
          "label": "Return the small mallet",
          "done": "Returned the small mallet."
        },
        {
          "label": "Return the measuring cord",
          "done": "Returned the measuring cord."
        },
        {
          "label": "Close the shared tool basket",
          "done": "Closed the shared tool basket."
        }
      ],
      "outro": "The folk draw a picture of each tool inside the lid, ready for next time."
    },
    {
      "id": "vq43",
      "title": "The Bell’s Quiet Hour",
      "intro": "The villagers want their evening bell to be kinder to sleeping little ones.",
      "steps": [
        {
          "label": "Find the felt bell wrap",
          "done": "Found the felt bell wrap."
        },
        {
          "label": "Fit the soft bell wrap",
          "done": "Fitted the soft bell wrap."
        },
        {
          "label": "Try the softened chime",
          "done": "Tried the softened chime."
        }
      ],
      "outro": "The bell makes a warm little note. A nearby sleeper does not stir."
    },
    {
      "id": "vq44",
      "title": "The Thank-You Post",
      "intro": "The neighbours want a place to leave kind notes where everyone can see.",
      "steps": [
        {
          "label": "Collect the painted note clips",
          "done": "Collected the painted note clips."
        },
        {
          "label": "Fasten the clips to the thank-you cord",
          "done": "Fastened the clips to the thank-you cord."
        },
        {
          "label": "Hang the first kind note",
          "done": "Hung the first kind note."
        }
      ],
      "outro": "By evening the cord carries more smiles than it was built to hold."
    },
    {
      "id": "vq45",
      "title": "A Fair Share of Shade",
      "intro": "Two groups of villagers keep moving the same sunshade in opposite directions.",
      "steps": [
        {
          "label": "Read the morning shade request",
          "done": "Read the morning shade request."
        },
        {
          "label": "Read the afternoon shade request",
          "done": "Read the afternoon shade request."
        },
        {
          "label": "Mark the two agreed shade positions",
          "done": "Marked the two agreed shade positions."
        }
      ],
      "outro": "The neighbours learn to move the shade together when the sun moves on."
    },
    {
      "id": "vq46",
      "title": "The Pebble Memorial",
      "intro": "The villagers are remembering homes lost to the usurper’s shadows.",
      "steps": [
        {
          "label": "Find the smooth memory pebble",
          "done": "Found the smooth memory pebble."
        },
        {
          "label": "Read the old home’s picture card",
          "done": "Read the old home’s picture card."
        },
        {
          "label": "Place the pebble on the memory mat",
          "done": "Placed the pebble on the memory mat."
        }
      ],
      "outro": "The folk sit together a while. Remembering hurts less with someone beside you."
    },
    {
      "id": "vq47",
      "title": "The Little Weather Vane",
      "intro": "Our villagers want a simple way to tell which way the wind blows.",
      "steps": [
        {
          "label": "Recover the wooden arrow",
          "done": "Recovered the wooden arrow."
        },
        {
          "label": "Find the turning peg",
          "done": "Found the turning peg."
        },
        {
          "label": "Fit the little weather vane",
          "done": "Fitted the little weather vane."
        }
      ],
      "outro": "The Peeps test it with very serious blowing, then let the real wind try."
    },
    {
      "id": "vq48",
      "title": "The Story Swap",
      "intro": "Two neighbours keep telling the same story and want to learn each other’s.",
      "steps": [
        {
          "label": "Read the first neighbour’s story card",
          "done": "Read the first neighbour’s story card."
        },
        {
          "label": "Read the second neighbour’s story card",
          "done": "Read the second neighbour’s story card."
        },
        {
          "label": "Exchange the story envelopes",
          "done": "Exchanged the story envelopes."
        }
      ],
      "outro": "One story is about bravery, one about soup. Both are told with equal pride."
    },
    {
      "id": "vq49",
      "title": "The Welcome-Home Trail",
      "intro": "The villagers have prepared small signs for neighbours returning from a long journey.",
      "steps": [
        {
          "label": "Find the homeward chalk",
          "done": "Found the homeward chalk."
        },
        {
          "label": "Draw the first welcome arrow",
          "done": "Drew the first welcome arrow."
        },
        {
          "label": "Draw the final welcome arrow",
          "done": "Drew the final welcome arrow."
        }
      ],
      "outro": "The arrows lead home. Beside the last one, someone has drawn open arms."
    },
    {
      "id": "vq50",
      "title": "Fifty Small Kindnesses",
      "intro": "The little folk want to make a promise: help can be small and still matter.",
      "steps": [
        {
          "label": "Read the kindness promise",
          "done": "Read the kindness promise."
        },
        {
          "label": "Collect the empty promise cards",
          "done": "Collected the empty promise cards."
        },
        {
          "label": "Leave a card for the next helper",
          "done": "Left a card for the next helper."
        }
      ],
      "outro": "The villagers save a blank card for every new friend. There will always be another kindness to do."
    }
  ],
  "lore": [
    {
      "id": "vl01",
      "title": "The First Lantern",
      "text": "When the usurper’s shadows reached Alderwing, the little folk covered their lamps. One neighbour uncovered hers so a lost robin could find the path. The next night, there were two lights."
    },
    {
      "id": "vl02",
      "title": "A School with Branches",
      "text": "The Peeps say the Academy tree remembers every kind word spoken beneath it. They leave their smallest thank-you notes near the roots, where even a tree might bend to read."
    },
    {
      "id": "vl03",
      "title": "The Feather and the Hand",
      "text": "Birds guide Alderwing with keen minds and brave wings. The little humanoid folk tend its homes with patient hands. A village needs both the lookout above and the neighbour below."
    },
    {
      "id": "vl04",
      "title": "The Empty Crown",
      "text": "An old village drawing shows a crown on an empty stool. Underneath, a small hand added: Whoever sits here must listen first."
    },
    {
      "id": "vl05",
      "title": "A Reed Is Enough",
      "text": "The first village flute was one hollow reed. Its maker played only three notes, but every neighbour knew the tune meant come home."
    },
    {
      "id": "vl06",
      "title": "The Robin’s Seat",
      "text": "The smallest seat at the village gathering is kept for a robin. The folk learned long ago that a small bird can have a very large opinion."
    },
    {
      "id": "vl07",
      "title": "The Shared Hammer",
      "text": "The old tool basket has no owner’s name. Instead, its handle bears many little handprints. A useful thing, the folk say, can belong to everyone who returns it."
    },
    {
      "id": "vl08",
      "title": "Smoke Cannot Sew",
      "text": "The shadow flock tore the old pennant. By morning the villagers had stitched it together. The new seam was crooked, bright, and much harder to frighten."
    },
    {
      "id": "vl09",
      "title": "The Long Table",
      "text": "Before the occupation, the folk joined their little supper tables end to end. They kept adding places until the meal bent around a tree."
    },
    {
      "id": "vl10",
      "title": "Merlin’s Muddy Hem",
      "text": "A Peep’s sketch shows Merlin arriving after rain, his robes muddy at the edge. The note says: Even a wizard has to come through the puddles to visit."
    },
    {
      "id": "vl11",
      "title": "The Bell Without a Tower",
      "text": "The first lunch bell hung from a bent branch. A proper tower could wait. Lunch, the villagers agreed, could not."
    },
    {
      "id": "vl12",
      "title": "A Pocket of Home",
      "text": "Travelling folk carry small reminders of home: a button, a painted pebble, a scrap of cloth. None is worth much at market. None is easily replaced."
    },
    {
      "id": "vl13",
      "title": "The Kingfisher’s Bowl",
      "text": "An old supper picture gives every visiting bird a different plate. The folk learned that kindness begins by finding out what a guest actually needs."
    },
    {
      "id": "vl14",
      "title": "The Night of Paper Stars",
      "text": "During a moonless night, the villagers hung paper stars along the paths. They gave no light, but everyone walked a little more bravely beneath them."
    },
    {
      "id": "vl15",
      "title": "The Wren’s Advice",
      "text": "A wren once told the village council to fix the little gaps first. The folk thought she meant their fence. By spring, they understood she meant friendships too."
    },
    {
      "id": "vl16",
      "title": "The Quiet Bench",
      "text": "There is an old custom of leaving room beside you when you rest. The village folk say a tired stranger should never have to ask for half a bench."
    },
    {
      "id": "vl17",
      "title": "The Usurper’s Silence",
      "text": "The evil Burbz leave a strange hush where they gather. Free villages answer with bells, chatter, and the ordinary stubborn business of another day."
    },
    {
      "id": "vl18",
      "title": "The Borrowed Ribbon",
      "text": "Festival ribbons are passed from neighbour to neighbour. When a ribbon comes home, it carries knots from all the people who remembered to return it."
    },
    {
      "id": "vl19",
      "title": "A Map of Kindness",
      "text": "The oldest Peep maps mark safe doors and helpful neighbours more carefully than distances. Getting somewhere matters. Being welcome when you arrive matters too."
    },
    {
      "id": "vl20",
      "title": "The Patient Forge",
      "text": "A village picture shows a bird smith checking a tiny talon blade. Its caption says: Make it fit the fighter. Never ask the fighter to fit the weapon."
    },
    {
      "id": "vl21",
      "title": "The Good Cup",
      "text": "A repaired cup is considered lucky among the folk. Somebody cared enough to make it useful twice."
    },
    {
      "id": "vl22",
      "title": "The Rain Song",
      "text": "The villagers have a special rain song. Nobody remembers all the words, so they hum until someone reaches the part about warm socks."
    },
    {
      "id": "vl23",
      "title": "The First Welcome",
      "text": "An old doorstep carries two carved marks: a wing and a little hand. Neither is placed above the other."
    },
    {
      "id": "vl24",
      "title": "The Small Promise",
      "text": "A promise in Alderwing need not be grand. Bring back the basket. Leave a light. Wait for the slowest. These are promises a village can stand on."
    },
    {
      "id": "vl25",
      "title": "The Rook’s Margins",
      "text": "A rook once corrected every spelling mistake in the village storybook, then drew a funny little face beside each correction so nobody would feel small."
    },
    {
      "id": "vl26",
      "title": "The Last Seat",
      "text": "At village suppers, the last seat remains empty until everyone has checked the path. The missing guest might simply be walking slowly."
    },
    {
      "id": "vl27",
      "title": "A Wind-Worn Sign",
      "text": "The old sign has almost lost its paint. Every generation traces the same simple message again: There is room."
    },
    {
      "id": "vl28",
      "title": "The Blanket Rule",
      "text": "The village’s spare blanket belongs to whoever is cold. The folk consider this a complete system of government for blankets."
    },
    {
      "id": "vl29",
      "title": "The Unfinished Story",
      "text": "Village stories end with a blank page for the next teller. The folk do not think a good story should ever run out of neighbours."
    },
    {
      "id": "vl30",
      "title": "The Returning Light",
      "text": "A rescued lantern is never polished completely clean. A little old soot is left beneath the handle, to remember what the light came through."
    }
  ]
};
// New field stories have their own stable namespace: shipped request/scroll decks never move.
content.activities = [
 {id:'vf01',title:'The Three-Reed Welcome',art:6,reward:{coins:8,materials:{river_reed:1}},memory:'A Tune for the Slowest',outro:'The chime answers in three gentle notes. Its old tune leaves a pause for the slowest traveller; a welcome should never hurry anyone.',steps:[
  {art:2,label:'Read the chime-maker’s note',text:'A pencilled song on old parchment reads: “First the rain, then the river, then the sea.” Beneath it: small, middle, large.',done:'You copy the rain–river–sea order into your journal.'},
  {art:6,label:'Untangle the three reeds',text:'The smallest reed has a rain mark; the middle reed has a river; the largest has a wave. Their cords are knotted together.',done:'You untangle the cords. All three reeds swing freely again.'},
  {art:4,label:'Play the welcome sequence',text:'Three clear notes wait beneath your hand. Which order follows the maker’s song?',choices:[['rain','Small → middle → large'],['sea','Large → middle → small'],['river','Middle → small → large']],answer:'rain',wrong:'Those notes are clear, but the tune is unfinished. The note began with rain, then river, then sea.'}]},
 {id:'vf02',title:'A Lantern for Returning Feet',art:5,reward:{coins:8,materials:{oak_twig:1}},memory:'The Uncovered Lamp',outro:'A warm lantern now faces the path. During the occupation, a hidden lamp waited behind this shutter; its keeper promised to uncover it when the road was free.',steps:[
  {art:13,label:'Inspect the lamplighter’s map',text:'The map marks a little roof beside a long winding path. An arrow points away from the roof: “Let the traveller see us before we see them.”',done:'You trace the homeward path on the lamplighter’s map.'},
  {art:3,label:'Recover the dry lantern wick',text:'A waxed satchel holds one dry wick wrapped in a note: “Keep this for the welcome lamp.”',done:'You carry the dry wick to the old lamp.'},
  {art:5,label:'Set the welcome lantern',text:'The repaired shutter can face the path or face the wall. Where should its light fall?',choices:[['path','Turn the light toward the path'],['wall','Turn the light toward the wall']],answer:'path',wrong:'The wall is bright, but returning feet cannot see it. The map’s arrow points along the path.'}]},
 {id:'vf03',title:'The Patient Casket',art:8,reward:{coins:10},memory:'A Gift Kept Safe',outro:'The little lock clicks open. Its gift has waited through the shadow years beneath a note: “For the next person who takes time to listen.”',steps:[
  {art:7,label:'Trace the rain-worn carving',text:'The carving shows a red dawn above a blue river, then green leaves. Someone has carefully preserved all three colours.',done:'You record the carving: dawn, river, leaves.'},
  {art:14,label:'Inspect the lock-maker’s token',text:'The feather token fits a recess on a nearby casket. Tiny pictures repeat the stone’s message: dawn comes first; leaves come last.',done:'You turn the token in the lock. Three coloured catches become ready.'},
  {art:8,label:'Open the three-colour casket',text:'The catches are red, blue and green. Choose the order left in the carving.',choices:[['dawn','Red → blue → green'],['leaves','Green → red → blue'],['river','Blue → green → red']],answer:'dawn',wrong:'The catches spring back gently. Nothing is used up. The carving starts at red dawn and ends in green leaves.'}]},
 {id:'vf04',title:'The Map That Turned Around',art:13,reward:{coins:8,materials:{river_reed:1}},memory:'The Mapmakers’ Promise',outro:'The little waymark points true again. Alderwing’s oldest maps measured help before miles: a safe door mattered more than a perfectly straight road.',steps:[
  {art:13,label:'Read the traveller’s sketch',text:'A tiny sketch places the feather-marked path on the same side as the rising sun. A smudge labels the opposite route with a moon.',done:'You copy the sun and feather marks.'},
  {art:11,label:'Loosen the crooked sign fitting',text:'The sign’s wooden collar has seized. A waiting mallet and brass washer can free it without breaking the old timber.',done:'You tap the collar loose. The sign can turn again.'},
  {art:12,label:'Align the feather waymark',text:'The collar has a sun notch and a moon notch. Which one belongs beneath the feather?',choices:[['sun','Align feather with the sun notch'],['moon','Align feather with the moon notch']],answer:'sun',wrong:'That points the opposite way. The traveller’s sketch placed the feather beside the rising sun.'}]},
 {id:'vf05',title:'The Cup with a Second Life',art:15,reward:{coins:8,materials:{oak_twig:1}},memory:'The Good Seam',outro:'The mended keepsake sits steady. The folk used to mark repairs in gold so nobody would mistake care for something shameful.',steps:[
  {art:2,label:'Read the potter’s repair card',text:'The card shows a cracked bowl wrapped with red thread. “Match the feather halves. Bind gently; the rim needs room.”',done:'You note the feather alignment and the gentle binding.'},
  {art:10,label:'Unwind a length of repair ribbon',text:'A short red ribbon waits on its wooden spool, left for the damaged keepsake beside it.',done:'You unwind just enough ribbon to hold the repair.'},
  {art:15,label:'Set the keepsake’s broken seam',text:'The feather pattern splits across two pieces. How should the repair be held?',choices:[['gentle','Match the feather and bind gently'],['tight','Pull the rim tight until it bends']],answer:'gentle',wrong:'The rim strains. You loosen it before any damage. The repair card asked for a gentle binding.'}]},
 {id:'vf06',title:'The Ivy’s Hidden Window',art:9,reward:{coins:8,materials:{river_reed:1}},memory:'Room for the Small Light',outro:'The pot’s old painted window is visible again. It remembers a promise to leave a little room for hope even when the whole wall seems dark.',steps:[
  {art:7,label:'Inspect the gardener’s stone',text:'A small stone shows ivy tied to a hoop, with the lowest loop left open. Its carved instruction says: “Lift the vine; keep the root.”',done:'You copy the gardener’s open-loop pattern.'},
  {art:10,label:'Gather the waiting garden tie',text:'A soft ribbon has been left beside the pot. It is long enough to lift the trailing ivy without pulling it out.',done:'You prepare a loose loop for the ivy.'},
  {art:9,label:'Reveal the painted window',text:'A tangle of ivy hides a tiny painted window on the pot. How will you clear it?',choices:[['lift','Lift the trailing vine into the loop'],['pull','Pull the vine out by its stem']],answer:'lift',wrong:'The root begins to move, so you stop. The gardener’s carving said to lift the vine and keep the root.'}]},
 {id:'vf07',title:'The Bell That Listened',art:4,reward:{coins:8,materials:{oak_twig:1}},memory:'One Note for Peace',outro:'A single gentle note settles over the path. This bell once warned of shadows; when the village was freed, the folk taught it a kinder job.',steps:[
  {art:13,label:'Study the old bell diagram',text:'Three clapper marks are drawn beside the bell. Only the middle mark has a feather beside it: “A welcome needs a voice, never a shout.”',done:'You mark the middle clapper setting.'},
  {art:11,label:'Free the bell’s rusted hinge',text:'The hinge has stuck halfway. A brass tool left beneath it fits the square bolt exactly.',done:'You free the hinge and restore its gentle swing.'},
  {art:4,label:'Tune the little welcome bell',text:'The clapper can hang high, middle or low. Which setting matches the feather diagram?',choices:[['middle','Set the clapper at the middle mark'],['high','Set the clapper at the highest mark'],['low','Set the clapper at the lowest mark']],answer:'middle',wrong:'The note rattles. You steady the bell. The feather in the diagram marked the middle setting.'}]},
 {id:'vf08',title:'The Letter Without a Name',art:3,reward:{coins:8,materials:{oak_twig:1}},memory:'The Reply That Waited',outro:'The old reply rests in its feather-marked case, ready for the returning traveller. Some welcomes are written before anyone knows who will need them.',steps:[
  {art:2,label:'Read the rain-spotted letter',text:'Only one sentence remains clear: “Leave my reply beneath the feather, never beneath the crown.” A tiny feather is drawn twice.',done:'You save the letter’s surviving instruction.'},
  {art:3,label:'Retrieve the folded reply',text:'A sealed reply has stayed dry inside a leather satchel. Its unbroken seal asks you to carry it without opening it.',done:'You carry the sealed reply carefully.'},
  {art:8,label:'Place the reply in its case',text:'The case has a feather recess and a crown recess. Where did the writer ask you to leave it?',choices:[['feather','Leave it beneath the feather'],['crown','Leave it beneath the crown']],answer:'feather',wrong:'The crown recess is empty, but it is not the place the writer named. The letter asked for the feather.'}]},
 {id:'vf09',title:'Stones for a Quiet Game',art:15,reward:{coins:10},memory:'The Smallest Victory',outro:'The old game is ready for another pair of patient hands. Its rule was simple: leave the centre free so the next player always has a place to begin.',steps:[
  {art:7,label:'Read the game scratched in stone',text:'A ring of pebbles surrounds an empty centre. Small carved hands point inward, but none covers the middle.',done:'You copy the ring with its empty centre.'},
  {art:15,label:'Sort the loose game pebbles',text:'Smooth pebbles lie mixed with broken chips beside a blue bowl. There are enough whole stones to make the pictured ring.',done:'You set aside the smooth stones for the game.'},
  {art:14,label:'Lay out the quiet game',text:'The feather token marks the playing place. What pattern belongs around it?',choices:[['ring','Make a ring and leave the centre open'],['pile','Pile every stone in the centre']],answer:'ring',wrong:'The pile leaves nowhere to begin. The scratched picture kept the centre open.'}]},
 {id:'vf10',title:'A Ribbon Across the Years',art:10,reward:{coins:8,materials:{river_reed:1}},memory:'The Knot That Comes Home',outro:'The returning ribbon carries one more careful loop. The folk pass this keepsake from hand to hand, with a loose knot for each kindness remembered.',steps:[
  {art:2,label:'Read the festival ribbon’s tag',text:'The tag asks every helper to add a loop, never a cut. “A ribbon that returns should still be long enough for the next hand.”',done:'You remember to add a loop without cutting the ribbon.'},
  {art:10,label:'Free the caught festival ribbon',text:'One long ribbon has caught beneath its own spool. Lifting the spool releases it without tearing the embroidered edge.',done:'You lift the spool and free the whole ribbon.'},
  {art:12,label:'Tie the returning ribbon',text:'The old waypost has a smooth peg for the ribbon. How should you leave it?',choices:[['loop','Add a loose loop for the next helper'],['cut','Cut off the end and tie it tightly']],answer:'loop',wrong:'You set the blade aside. The tag asked for a loop so the ribbon can return whole.'}]},
 {id:'vf11',title:'The Keeper’s Little Mechanism',art:11,reward:{coins:8,materials:{iron_grit:1}},memory:'A Wheel for Every Hand',outro:'The little practice wheel turns freely again. Its maker cut the handle small enough for a Peep’s hands and the marks large enough for a bird to read from above.',steps:[
  {art:13,label:'Read the keeper’s wheel plan',text:'The plan shows a small gear beneath a larger wheel. A feather arrow curls clockwise. “Turn with the feather; force nothing.”',done:'You record the feather’s clockwise turn.'},
  {art:11,label:'Seat the loose practice gear',text:'A brass gear rests beside a wooden mount. The teeth line up when its marked face points out toward the path.',done:'You seat the gear with its marked face outward.'},
  {art:4,label:'Test the keeper’s mechanism',text:'A small bell is linked to the practice wheel. Which way should the handle turn?',choices:[['clockwise','Turn clockwise with the feather'],['reverse','Turn against the feather arrow']],answer:'clockwise',wrong:'The handle resists, so you stop. The plan said to follow the feather clockwise and force nothing.'}]},
 {id:'vf12',title:'The Leaf Beneath the Dust',art:7,reward:{coins:10},memory:'A Mark That Survived',outro:'The feather and little hand shine together on the keepsake. The evil Burbz could darken a road, but they never learned how to erase what neighbours remembered.',steps:[
  {art:7,label:'Brush dust from the old leaf stone',text:'Beneath the dust, a leaf shelters two marks: a wing and a little hand. Neither is drawn higher than the other.',done:'You uncover the two marks at equal height.'},
  {art:14,label:'Inspect the reversible keepsake',text:'A carved medallion has a crown on one face and a wing beside a hand on the other. Its stand can show either face.',done:'You find the wing-and-hand face of the keepsake.'},
  {art:9,label:'Set the keepsake by the ivy',text:'The ivy pot has a shallow stand for the medallion. Which face carries the stone’s message?',choices:[['together','Show the wing beside the little hand'],['crown','Show the crown above everything']],answer:'together',wrong:'The crown tells a different story. The leaf stone placed the wing and the little hand together.'}]}
];

if(typeof module==='object'&&module.exports)module.exports=content;root.BurbzVillageDiscoveryContent=content;})(globalThis);
