
/**
 * Savage Worlds Adventure Deck Hand Toolbar
 * A Foundry VTT module to display and provide quick access to a player's Adventure Cards in a small toolbar
 * Developer: Kristian Serrano
 * Based on Card Hands Mini Toolbar by pengrath
 */

const ADVENTURE_DECK_MODULE = {
  id: "adventure-deck"
};

const ADVENTURE_HAND_BARS_MODULE = {
  adventureBarsList: new Array(),
  id: "adventure-hand-bars",
  translationPrefix: 'ADVENTURE_HAND_BARS',
  render: async function () {
    const availableAdventureHands = game.cards.filter((c) => c.type === 'hand' && c.getFlag(ADVENTURE_DECK_MODULE.id, 'group') === 'adventure hands' && c.testUserPermission(game.user, "OBSERVER"));
    let discardPile = game.cards.getName(game.settings.get(ADVENTURE_DECK_MODULE.id, 'dumpPileName'));
    if (game.user.isGM && discardPile && discardPile.ownership.default !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
      discardPile.update({
        'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      });
    }

    // Get the container for the module UI
    const adventureHandBarElem = document.getElementById(`${this.id}-container`);

    // Get the hidden state of the container from the settings
    const hidden = game.settings.get(this.id, 'hideBars');
    // Render the template
    const templatePath = `modules/${this.id}/templates/${this.id}-container.hbs`;
    const adventureHandBar = await renderTemplate(templatePath, {
      hands: availableAdventureHands,
      discardPile: discardPile,
      hidden: hidden,
      isGM: game.user.isGM,
      moduleId: this.id,
      translationPrefix: this.translationPrefix,
    });

    // If the container is in the DOM...
    if (adventureHandBarElem) {
      // Update the HTML (There's a brief moment during dealing when the element doesn't have a parent element)
      if (adventureHandBarElem.parentElement) adventureHandBarElem.outerHTML = adventureHandBar;
    } else{
      // Otherwise insert it
      // Get Foundry VTT's Player List element
      const playersListElement = document.getElementById("players");
      // Insert the module UI element
      playersListElement.insertAdjacentHTML("beforebegin", adventureHandBar);
    }

    /* Set up listeners for hand bar UI */

    // Get all the bars and loop through them
    const bars = document.querySelectorAll(`.${this.id}-cards`);

    // For each bar...
    for (const b of bars) {
      // Get its hand
      const hand = await game.cards.get(b.dataset.handId);

      // Set the element ID to use for query selectors
      const barElemId = `#${this.id}-${hand.id}`;

      // Add listener for opening the hand sheet when clicking on the hand name
      const handNameElem = document.querySelector(`${barElemId} .${this.id}-name`);
      handNameElem.addEventListener('click', async (e) => {
        await hand.sheet.render(true);
      });

      // Add listener for opening the hand sheet when clicking on the cards container
      const handContainer = document.querySelector(`${barElemId} .${this.id}-cards-container`);
      handContainer.addEventListener('click', async (e) => {
        await hand.sheet.render(true);
      });

      // Add listener for drawing an Adventure Card
      const drawCardButton = document.querySelector(`${barElemId} .${this.id}-draw`);
      // This button only appears for those with ownership permission, so check if it exists
      if (drawCardButton) {
        drawCardButton.addEventListener('click', async (e) => {
          await this.drawCard(e);
        });
      }
    }

    // Add listener for hiding and showing the module UI container when the icon is clicked
    document.querySelector(`#${this.id}-container h3`).addEventListener('click', async () => {
      const adventureHandBarElem = document.getElementById(`${this.id}-container`);
      adventureHandBarElem.classList.toggle('hidden');
      const arrow = document.querySelector(`.${this.id}-mode`);
      arrow.classList.toggle('fa-angle-up');
      arrow.classList.toggle('fa-angle-down');
      await game.settings.set(this.id, 'hideBars', adventureHandBarElem.classList.contains('hidden'))
    });
  },
  //Opens the hand for any additional options
  openHand: async function (hand) {
    if (hand.sheet.rendered) {
      hand.sheet.close();
    } else {
      hand.sheet.render(true);
    }
  },
  //Draws a card into this hand
  drawCard: async function (e) {
    const handId = e.target.parentElement.dataset.handId;
    const hand = game.cards.get(handId);
    const deck = game.cards.getName(game.settings.get(ADVENTURE_DECK_MODULE.id, "deckName"));
    const prevDrawn = deck.drawnCards;
    var newlyDrawn = (await deck.deal([hand], 1)).drawnCards.filter(n => !prevDrawn.includes(n));

    // Use adventure deck chat templates.
    if (game.settings.get(ADVENTURE_DECK_MODULE.id, "announceCards")) { //AnnounceCards?
      // Prerender chatcard.
      const message = await renderTemplate(`modules/${ADVENTURE_DECK_MODULE.id}/templates/dealtcards-chatcard.hbs`, {
        player: hand.name,
        cards: newlyDrawn
      });

      // Print card to chat.
      await ChatMessage.create({
        user: game.user.id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: message,
      });
    }
  }
};

Hooks.on("init", function () {
  game.settings.register(ADVENTURE_HAND_BARS_MODULE.id, 'hideBars', {
    scope: 'client',     // "world" = sync to db, "client" = local storage
    config: false,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: true,
  });
});

Hooks.on("ready", function () {
  // Pre Load templates.
  loadTemplates([`modules/${ADVENTURE_HAND_BARS_MODULE.id}/templates/${ADVENTURE_HAND_BARS_MODULE.id}-container.hbs`]);
  // Get the adventure deck using the stored name in the adventure cards module.
  const adventureDeck = game.cards.getName(game.settings.get(ADVENTURE_DECK_MODULE.id, 'deckName'));
  // Check if default ownership is Limited for card draws. If it's not, set it.
  if (game.user.isGM && adventureDeck && adventureDeck.ownership.default < CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED) {
    adventureDeck.update({ 'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED });
  }
  ADVENTURE_HAND_BARS_MODULE.render();
});

/*
 * Hooks to listen to changes in settings and hands data
 * CONFIG.debug.hooks = true
*/

// CONFIG.debug.hooks = true
// or use the Developer Mode module

Hooks.on("renderPlayerList", (data) => {
  if (game.ready) {
    ADVENTURE_HAND_BARS_MODULE.render();
  }
});
Hooks.on("updateCard", (data) => {
  if (data.parent.type === 'hand') {
    ADVENTURE_HAND_BARS_MODULE.render();
  }
});
Hooks.on("deleteCard", (data) => {
  if (data.parent.type === 'hand') {
    ADVENTURE_HAND_BARS_MODULE.render();
  }
});
Hooks.on("passCards", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});
Hooks.on("createCard", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});
Hooks.on("returnCards", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});