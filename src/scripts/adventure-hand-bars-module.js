
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
  render: async function () {
    const availableAdventureHands = game.cards.filter((c) => c.type === 'hand' && c.getFlag(ADVENTURE_DECK_MODULE.id, 'group') === 'adventure hands' && c.testUserPermission(game.user, "OBSERVER"));
    let discardPile = game.cards.getName(game.settings.get(ADVENTURE_DECK_MODULE.id, 'dumpPileName'));
    if (game.user.isGM && discardPile && discardPile.ownership.default !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
      discardPile.update({
        'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      });
    }

    // Get the container for the module UI
    const adventureHandBarElem = document.getElementById('adventure-hand-bars-container');

    // Creates the outer container
    const adventureHandBar = await renderTemplate('modules/adventure-hand-bars/templates/adventure-hand-bars-container.hbs', {
      hands: availableAdventureHands,
      discardPile: discardPile,
      hidden: adventureHandBarElem ? adventureHandBarElem.classList.contains('hidden') : true
    });

    if (adventureHandBarElem) {
      // Update the HTML (There's a brief moment during dealing when the element doesn't have a parent element)
      if (adventureHandBarElem.parentElement) adventureHandBarElem.outerHTML = adventureHandBar;
    } else {
      // If there is not an existing element, create it
      // Get Foundry VTT's Player List element
      const playersListElement = document.getElementById("players");
      // Insert the module UI element
      playersListElement.insertAdjacentHTML("beforebegin", adventureHandBar);
    }

    // Set up listeners for hand bar UI
    // Get all the bars and loop through them
    const bars = document.querySelectorAll('.adventure-hand-bar-cards');
    // For each bar...
    for (const b of bars) {
      const hand = await game.cards.get(b.dataset.handId);
      // Set the element ID to use for query selectors.
      const barElemId = `#adventure-hand-bar-hand-${hand.id}`;

      // Add listener for opening the hand sheet when clicking on the hand name
      const handNameElem = document.querySelector(`${barElemId} .adventure-hand-bar-hand-name`);
      if (handNameElem) {
        handNameElem.addEventListener('click', async (e) => {
          await hand.sheet.render(true);
        });
      }

      // Add listener for opening the hand sheet when clicking on the cards container
      const handContainer = document.querySelector(`${barElemId} .adventure-hand-bar-cards-container`);
      if (handContainer) {
        handContainer.addEventListener('click', async (e) => {
          await hand.sheet.render(true);
        });
      }

      // Draw an Adventure Card
      const drawCardButton = document.querySelector(`${barElemId} .adventure-hand-bar-draw`);
      if (drawCardButton) {
        drawCardButton.addEventListener('click', async (e) => {
          await ADVENTURE_HAND_BARS_MODULE.drawCard(e);
        });
      }
    }

    // Add listener for hiding and showing the module UI container when the icon is clicked
    document.querySelector('.adventure-hand-bar-hide-show').addEventListener('click', () => {
      document.getElementById('adventure-hand-bars-container').classList.toggle('hidden');
      const arrow = document.querySelector('.adventure-hands-mode');
      arrow.classList.toggle('fa-angle-up');
      arrow.classList.toggle('fa-angle-down');
    });
  },
  //Opens the hand for any additional options
  openHand: async function (hand) {
    if (hand == undefined) {
      ui.notifications.warn(game.i18n.localize("ADVENTUREHANDBARS.NoHandSelected"));
      return;
    }
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
    if (game.settings.get("adventure-deck", "announceCards")) { //AnnounceCards?
      // Prerender chatcard.
      const message = await renderTemplate("modules/adventure-deck/templates/dealtcards-chatcard.hbs", {
        player: hand.name,
        cards: newlyDrawn
      });

      // Print card to chat.
      ChatMessage.create({
        user: game.user.id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: message,
      });
    }
  }
};

Hooks.on("init", function () {
  Handlebars.registerHelper("isGM", function () {
    return game.user.isGM;
  });
});

Hooks.on("ready", function () {
  // Pre Load templates.
  loadTemplates(['modules/adventure-hand-bars/templates/adventure-hand-bars-container.hbs']);
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

// Hook for rendering hands when cards are dealt.
Hooks.on("createCard", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});

// Hook for rendering hands when a card is deleted.
Hooks.on("deleteCard", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});

// Hook for clearing a bar that has a hand that has been deleted.
Hooks.on("deleteCards", (data) => {
  ADVENTURE_HAND_BARS_MODULE.render();
});

