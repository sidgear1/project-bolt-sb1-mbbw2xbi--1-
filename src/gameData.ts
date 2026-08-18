import { HotspotData, GamePhase, DictionaryWord } from './types';

export const ALL_PHASES: GamePhase[] = ['tied', 'has_knife', 'freed', 'has_key', 'escaped', 'flashback', 'paris_street'];

export const HOTSPOTS: HotspotData[] = [
  {
    id: 'tiroir_couteaux',
    region: { x: 22.2, y: 47.3, width: 15.8, height: 7.4 },
    frenchName: 'cassetto',
    article: 'il',
    pronunciation: 'kas-SET-toh',
    english: 'the drawer',
    visiblePhases: ['tied', 'has_knife'],
    commands: [
      {
        verb: 'aprire',
        english: 'open',
        effects: [
          {
            phases: ['tied'],
            narrative:
              'You nudge the drawer open with your knee. Inside, a single serrated kitchen knife. You twist in the chair and close your fingers around the handle. The blade is cold. The knife is yours.',
            transitionTo: 'has_knife',
            inventoryAdd: 'knife',
          },
          {
            phases: ['has_knife', 'freed', 'has_key'],
            narrative: 'Hai già il coltello. (You already have the knife.)',
          },
        ],
        fallback: 'You cannot reach the drawer right now.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ['tied'],
            narrative:
              'A drawer beneath the counter. The label reads "Coltelli". Something glints inside — a knife. You need to open it.',
          },
          {
            phases: ['has_knife'],
            narrative: 'The drawer is empty now. You already took the knife.',
          },
        ],
        fallback: 'You look at the drawer.',
      },
      {
        verb: 'chiudere',
        english: 'close',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'You push the drawer shut. The sound echoes in the empty café.',
          },
        ],
        fallback: 'You close the drawer.',
      },
      {
        verb: 'ignorare',
        english: 'ignore',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'You stare at the drawer labelled "Coltelli". Your hands are tied. If only you could reach it.',
          },
        ],
        fallback: 'You look away from the drawer.',
      },
    ],
  },
  {
    id: 'corde',
    region: { x: 44.8, y: 46.3, width: 14.7, height: 7.6 },
    frenchName: 'corda',
    article: 'la',
    pronunciation: 'KOR-da',
    english: 'the rope',
    visiblePhases: ALL_PHASES,
    commands: [
      {
        verb: 'tagliare',
        english: 'cut',
        effects: [
          {
            phases: ['tied'],
            narrative:
              'You need something sharp first. There is a drawer labelled "Coltelli" within reach — il cassetto dei coltelli.',
          },
          {
            phases: ['has_knife'],
            narrative:
              'You angle the blade against the rope. Back and forth — the fibres snap. Your hands are FREE. You stand up from the chair. Blood rushes back into your fingers like fire.',
            transitionTo: 'freed',
            inventoryRemove: 'knife',
          },
          {
            phases: ['freed', 'has_key', 'escaped'],
            narrative: 'La corda è già tagliata. The rope is already cut. You are standing.',
          },
        ],
        fallback: 'Nothing to cut with.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative:
              'Thick manila rope, wound tight around your wrists. Whoever tied this knew what they were doing. You need to cut it.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'The cut rope lies in a heap by the chair. You are free of it now.',
          },
        ],
        fallback: 'You study the rope.',
      },
      {
        verb: 'tirare',
        english: 'pull',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative:
              'You strain against the rope. Your wrists burn. The knot holds fast. You need to cut it.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'The rope is already cut and on the floor.',
          },
        ],
        fallback: 'You pull hard.',
      },
      {
        verb: 'slegare',
        english: 'untie',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative:
              "Your fingers can't reach the knots. You'll need to cut through it.",
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'Already done.',
          },
        ],
        fallback: 'You try to untie it.',
      },
    ],
  },
  {
    id: 'cadavre',
    region: { x: 29.1, y: 73.4, width: 49.6, height: 13.9 },
    frenchName: 'cadavere',
    article: 'il',
    pronunciation: 'ka-DA-ve-re',
    english: 'the corpse',
    visiblePhases: ALL_PHASES,
    commands: [
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative:
              'A man in his fifties. Expensive shoes. The blood is still wet — this happened recently.',
          },
          {
            phases: ['freed', 'has_key', 'escaped'],
            narrative:
              'No wallet, no phone. Someone cleaned him out. A lily tattoo on his wrist. The white powder near his hand is definitely cocaine.',
          },
        ],
        fallback: 'You look at the body.',
      },
      {
        verb: 'frugare',
        english: 'search',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'Your hands are bound. You cannot search anything.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative:
              'Pockets empty. The jacket lining has been torn open — someone searched him first. A lily tattoo on his wrist.',
          },
        ],
        fallback: 'You search the body.',
      },
      {
        verb: 'toccare',
        english: 'touch',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'You nudge him with your foot. He will not move again.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'Still warm. This was very recent.',
          },
        ],
        fallback: 'You touch the body.',
      },
      {
        verb: 'chiamare',
        english: 'call out',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: '"Hello?" Your voice sounds thin in the empty café. The man does not answer.',
          },
        ],
        fallback: 'You call out.',
      },
    ],
  },
  {
    id: 'indice',
    region: { x: 87.6, y: 61.7, width: 10.2, height: 9.8 },
    frenchName: 'indizio',
    article: 'l\'',
    pronunciation: 'in-DIT-syo',
    english: 'the hint / the clue',
    visiblePhases: ALL_PHASES,
    commands: [
      {
        verb: 'leggere',
        english: 'read',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: `The note reads: "Vieni a trovarmi a mezzanotte, o sei morto." You need to translate this to understand. Type what you think it means to unlock the meaning.`,
          },
        ],
        fallback: 'You read the note.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: `A folded note on the table. Written in Italian: "Vieni a trovarmi a mezzanotte, o sei morto." You need to figure out what this means.`,
          },
        ],
        fallback: 'You examine the note.',
      },
      {
        verb: 'tradurre',
        english: 'translate',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: `Type what you think this means. The literal translation: "Come meet me at midnight, or you are dead." The note is now unlocked in English.`,
          },
        ],
        fallback: 'You try to translate the note.',
      },
      {
        verb: 'ignorare',
        english: 'ignore',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'This feels important. You should read it.',
          },
        ],
        fallback: 'You look away from the note.',
      },
    ],
  },
  {
    id: 'manteau',
    region: { x: 67, y: 43, width: 13, height: 22 },
    frenchName: 'cappotto',
    article: 'il',
    pronunciation: 'kap-POH-toh',
    english: 'the coat',
    visiblePhases: ['freed', 'has_key'],
    commands: [
      {
        verb: 'frugare',
        english: 'search',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'The pockets are empty. Whoever wore this coat is now on the floor — search him instead.',
          },
        ],
        fallback: 'You search the coat.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              "A dark wool coat. Expensive cut. A Florence label inside. The pockets have been turned out already.",
          },
        ],
        fallback: 'You examine the coat.',
      },
      {
        verb: 'prendere',
        english: 'take / wear',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'No time for fashion. Search the man on the floor first.',
          },
        ],
        fallback: 'You consider the coat.',
      },
      {
        verb: 'annusare',
        english: 'sniff',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'Cigarettes. Expensive perfume. Sweat. Fear.',
          },
        ],
        fallback: 'You sniff the coat.',
      },
    ],
  },
  {
    id: 'homme_par_terre',
    region: { x: 2, y: 55, width: 34, height: 40 },
    frenchName: 'uomo a terra',
    article: "l'",
    pronunciation: 'LWO-mo a TER-ra',
    english: 'the man on the floor',
    visiblePhases: ['freed', 'has_key'],
    requiresCombatCleared: true,
    commands: [
      {
        verb: 'frugare',
        english: 'search',
        effects: [
          {
            phases: ['freed'],
            narrative:
              'You kneel over the man in glasses and check his jacket. Inside the breast pocket — una chiave. A key. A small paper tag reads: FINESTRA.',
            transitionTo: 'has_key',
            inventoryAdd: 'key',
          },
          {
            phases: ['has_key'],
            narrative: 'You already took his key.',
          },
        ],
        fallback: 'You search him.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'The man in glasses lies unconscious. He is breathing — barely. An expensive watch. A breast pocket bulges slightly.',
          },
        ],
        fallback: 'You examine him.',
      },
      {
        verb: 'toccare',
        english: 'touch',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'Still warm. He is alive — out cold, but alive.',
          },
        ],
        fallback: 'You touch him.',
      },
      {
        verb: 'chiamare',
        english: 'call out',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'No response. He is deeply unconscious.',
          },
        ],
        fallback: 'You call out to him.',
      },
    ],
  },
  {
    id: 'fenetre',
    region: { x: 86.8, y: 8.3, width: 12.2, height: 40.9 },
    frenchName: 'finestra',
    article: 'la',
    pronunciation: 'fi-NES-tra',
    english: 'the window',
    visiblePhases: ALL_PHASES,
    labelPosition: { x: 87.3, y: 30.2 },
    commands: [
      {
        verb: 'aprire',
        english: 'open',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'Your hands are bound. You cannot reach the window.',
          },
          {
            phases: ['freed'],
            narrative: 'The window is locked. You need a key — una chiave.',
          },
          {
            phases: ['has_key'],
            narrative:
              'The key fits. A soft click. The window swings open. Cold Florence air floods in. You climb out onto the rooftop. You are free.',
            transitionTo: 'escaped',
            inventoryRemove: 'key',
          },
        ],
        fallback: 'You try the window.',
      },
      {
        verb: 'guardare',
        english: 'look',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'Florence at night. The Arno glitters somewhere below. The Duomo rises against the dark. Beautiful — and you are trapped in here.',
          },
        ],
        fallback: 'You look through the window.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'Arched glass, iron latch. Locked from the inside. There must be a key somewhere.',
          },
        ],
        fallback: 'You examine the window.',
      },
      {
        verb: 'rompere',
        english: 'break',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'The noise would bring whoever did this back immediately.',
          },
        ],
        fallback: 'You consider breaking the window.',
      },
    ],
  },
  {
    id: 'verre',
    region: { x: 8.2, y: 51.3, width: 11.1, height: 15.3 },
    frenchName: 'bicchiere di vino',
    article: 'il',
    pronunciation: 'bik-KYEH-re di VEE-no',
    english: 'the glass of wine',
    visiblePhases: ALL_PHASES,
    labelPosition: { x: 13.2, y: 65.7 },
    commands: [
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'A half-full glass of {vino:wine}. Not yet oxidised. Poured in the last hour. Someone left in a hurry. Some {libri:books} sit nearby, pages still open.',
          },
        ],
        fallback: 'You examine the wine glass.',
      },
      {
        verb: 'bere',
        english: 'drink',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: "Your hands are bound. Even now you can smell it — a good Chianti.",
          },
          {
            phases: ['freed', 'has_key', 'escaped'],
            narrative: "You raise the glass. The wine is exceptional — but alcohol on an empty stomach in a crisis is not wise. Your head spins a little.",
          },
        ],
        fallback: 'You consider drinking the wine.',
      },
      {
        verb: 'guardare',
        english: 'look',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'Red wine. Chianti, by the colour. A life interrupted mid-glass.',
          },
        ],
        fallback: 'You look at the glass.',
      },
      {
        verb: 'rovesciare',
        english: 'knock over',
        effects: [
          {
            phases: ALL_PHASES,
            narrative: 'Red wine spreads across the tablecloth like a wound.',
          },
        ],
        fallback: 'You knock over the glass.',
      },
      {
        verb: 'rompere',
        english: 'break',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'Your hands are bound. You cannot grab the glass.',
          },
          {
            phases: ['freed', 'has_key', 'escaped'],
            narrative: 'You smash the glass on the table edge. The stem shatters. A shard slices across your palm. You hiss — it bleeds freely. Foolish.',
          },
        ],
        fallback: 'You consider breaking the glass.',
      },
    ],
  },
  {
    id: 'machine_cafe',
    region: { x: 13.6, y: 32.3, width: 16.5, height: 11.5 },
    frenchName: 'macchina da caffè',
    article: 'la',
    pronunciation: 'mak-KEE-na da kaf-FEH',
    english: 'the coffee machine',
    visiblePhases: ALL_PHASES,
    commands: [
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'A professional Faema espresso machine. Still warm. One small cup of {caffè:coffee} sits cooling on the counter. Someone was here very recently.',
          },
        ],
        fallback: 'You examine the coffee machine.',
      },
      {
        verb: 'usare',
        english: 'use',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'Your hands are tied. You cannot use the machine.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative:
              'You make yourself an espresso. The bitter shot burns going down — but your head clears. You needed that.',
          },
        ],
        fallback: 'You try to use the machine.',
      },
      {
        verb: 'toccare',
        english: 'touch',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'Your hands are bound. You cannot reach the machine.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'The machine is warm to the touch. Recently used.',
          },
        ],
        fallback: 'You touch the machine.',
      },
      {
        verb: 'guardare',
        english: 'look',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'Il caffè — both the drink and the place. Someone was enjoying their coffee before everything went wrong.',
          },
        ],
        fallback: 'You look at the machine.',
      },
    ],
  },
  {
    id: 'cocaine',
    region: { x: 53, y: 76.7, width: 9, height: 9.3 },
    frenchName: 'polvere bianca',
    article: 'la',
    pronunciation: 'pol-VE-re BYAN-ka',
    english: 'the white powder',
    visiblePhases: ALL_PHASES,
    commands: [
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'A spilled bag of white powder. Definitely not flour. Quite a lot of it — this was not a personal supply.',
          },
        ],
        fallback: 'You examine the powder.',
      },
      {
        verb: 'toccare',
        english: 'touch',
        effects: [
          {
            phases: ['tied', 'has_knife'],
            narrative: 'You press your shoe against the powder. It scatters.',
          },
          {
            phases: ['freed', 'has_key'],
            narrative: 'You crouch and examine it closely. Pure white. Refined. Expensive.',
          },
        ],
        fallback: 'You touch the powder.',
      },
      {
        verb: 'annusare',
        english: 'sniff',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'You inhale sharply. A rush hits you immediately — your heart slams against your ribs. Then the nausea follows. Bad idea. Definitely cocaine. You feel dizzy and unwell. (-10 HP)',
            hpChange: -10,
          },
        ],
        fallback: 'You sniff the powder.',
      },
      {
        verb: 'ignorare',
        english: 'ignore',
        effects: [
          {
            phases: ALL_PHASES,
            narrative:
              'You try to ignore the white powder and the dead man and the knife and the rope. It is very difficult.',
          },
        ],
        fallback: 'You look away.',
      },
    ],
  },
];

export const PHASE_NARRATIVES: Record<GamePhase, string> = {
  tied:
    'You open your eyes. Your heart is racing. A Florentine café. Hands bound tight behind your back. A stranger lies dead at your feet — white powder near his hand. You remember nothing. Click on objects to find your way out.',
  has_knife:
    "You grip the knife. The rope around your wrists is right there. Use the blade — type 'tagliare' (cut).",
  freed:
    'You stand up from the chair. Your legs are unsteady. The rope lies in a heap at your feet. Now find a way out — the door will be watched. The man you defeated lies on the floor. Search him.',
  has_key:
    'Una chiave. The tag reads FINESTRA — window. The large window on the right. Use the key and get out of this place.',
  escaped:
    'You pull yourself through the window into the cold Florence night. The city stretches endlessly below. You are free. But your memory is gone — and somewhere in this city, someone knows who you are.',
  flashback:
    'A memory surfaces — unbidden, bright, painful.',
  paris_street:
    'You stand on a cobbled Florence street. The morning light is golden. Somewhere behind you, a café holds secrets you cannot forget. Ahead, the city waits.',
};

const STREET_ALL: GamePhase[] = ['paris_street'];

export const STREET_HOTSPOTS: HotspotData[] = [
  {
    id: 'chat',
    region: { x: 42, y: 54, width: 14, height: 20 },
    frenchName: 'gatto',
    article: 'il',
    pronunciation: 'GAT-toh',
    english: 'the cat',
    visiblePhases: STREET_ALL,
    commands: [
      {
        verb: 'guardare',
        english: 'look',
        effects: [{ phases: STREET_ALL, narrative: 'A black and white cat watches you with amber eyes. Unbothered. Florentine.' }],
        fallback: 'You look at the cat.',
      },
      {
        verb: 'toccare',
        english: 'touch',
        effects: [{ phases: STREET_ALL, narrative: 'The cat permits exactly three strokes, then walks away with dignity. Typical.' }],
        fallback: 'You reach for the cat.',
      },
      {
        verb: 'chiamare',
        english: 'call',
        effects: [{ phases: STREET_ALL, narrative: '"Micio! Micio!" The cat ignores you completely.' }],
        fallback: 'You call out to the cat.',
      },
      {
        verb: 'nutrire',
        english: 'feed',
        effects: [{ phases: STREET_ALL, narrative: 'You have nothing to offer. The cat seems to already know this.' }],
        fallback: 'You consider feeding the cat.',
      },
      {
        verb: 'seguire',
        english: 'follow',
        effects: [{ phases: STREET_ALL, narrative: 'You follow the cat a few steps. It ducks beneath a market stall and disappears.' }],
        fallback: 'You follow the cat.',
      },
    ],
  },
  {
    id: 'femme_marche',
    region: { x: 56, y: 38, width: 18, height: 38 },
    frenchName: 'donna del mercato',
    article: 'la',
    pronunciation: 'DON-na del mer-KAH-toh',
    english: 'the market woman',
    visiblePhases: STREET_ALL,
    commands: [
      {
        verb: 'parlare',
        english: 'speak',
        effects: [{ phases: STREET_ALL, narrative: 'You approach the woman at the market stall. She looks up from her bread and gives you a cautious smile.' }],
        fallback: 'You approach the woman.',
      },
      {
        verb: 'guardare',
        english: 'look',
        effects: [{ phases: STREET_ALL, narrative: 'A woman in her forties, dark apron, quick eyes. She is arranging loaves of bread and rounds of cheese.' }],
        fallback: 'You look at the woman.',
      },
      {
        verb: 'comprare',
        english: 'buy',
        effects: [{ phases: STREET_ALL, narrative: '"Un cornetto?" she offers. You pat your pockets — empty. She waves a hand. "La prossima volta." (Next time.)' }],
        fallback: 'You try to buy something.',
      },
      {
        verb: 'chiedere',
        english: 'ask',
        effects: [{ phases: STREET_ALL, narrative: 'You ask if she has seen anything unusual. She lowers her voice. "Ieri sera... degli uomini. Vestiti neri. Cercavano qualcuno." (Last night... men. Black suits. They were looking for someone.)' }],
        fallback: 'You ask her something.',
      },
    ],
  },
  {
    id: 'librairie',
    region: { x: 78, y: 20, width: 22, height: 68 },
    frenchName: 'libreria',
    article: 'la',
    pronunciation: 'lee-BREH-rya',
    english: 'the bookshop',
    visiblePhases: STREET_ALL,
    commands: [
      {
        verb: 'entrare',
        english: 'enter',
        effects: [{ phases: STREET_ALL, narrative: 'The door is locked. A sign reads: "Solo membri — Livello 5 richiesto." You are not yet ready. Learn more Italian first.' }],
        fallback: 'You try to enter the bookshop.',
      },
      {
        verb: 'guardare',
        english: 'look',
        effects: [{ phases: STREET_ALL, narrative: 'Books stacked in the window: Italian classics, maps of Florence, a worn leather journal. The shop looks like it holds secrets.' }],
        fallback: 'You look at the bookshop.',
      },
      {
        verb: 'esaminare',
        english: 'examine',
        effects: [{ phases: STREET_ALL, narrative: 'A hand-written sign on the door: "La conoscenza è la chiave." — Knowledge is the key. You need level 5 to enter.' }],
        fallback: 'You examine the bookshop.',
      },
    ],
  },
];


export const INITIAL_DICTIONARY: DictionaryWord[] = [];

export const INVENTORY_LABELS: Record<string, { french: string; english: string }> = {
  knife: { french: 'coltello', english: 'knife' },
  key: { french: 'chiave', english: 'key' },
  baguette: { french: 'pagnotta', english: 'bread loaf (+20 HP in combat)' },
};
