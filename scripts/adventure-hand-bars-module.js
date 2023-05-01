
import AdventureHandBar from './adventure-hand-bars.js';

/**
 * Card Hand Toolbar to show cards on the main display
 * Author: pengrath
 */

window.AdventureHandBarsModule = {
  AdventureBarsList: new Array(),
  moduleName: "adventure-hand-bars",
  adventureDeckModuleName: "adventure-deck",
  handMax: 10,
  createBars: async function () {
    // Create bar data.
    let count = game.settings.get(AdventureHandBarsModule.moduleName, "HandCount");
    count = count ? count : 0;
    if (count > AdventureHandBarsModule.handMax) {
      count = AdventureHandBarsModule.handMax;
    }
    for (let i = 0; i < count; i++) {
      const key = `CardsID-${i}`;
      const handId = game.user.getFlag(AdventureHandBarsModule.moduleName, key);
      const hand = game.cards.get(handId);
      new AdventureHandBar({ barIndex: i, hand: hand });
    }
    await AdventureHandBarsModule.render();

  },
  render: async function () {
    let shortcutHand = game.cards.getName(game.settings.get(AdventureHandBarsModule.adventureDeckModuleName, 'dumpPileName'));
    if (game.user.isGM && shortcutHand && shortcutHand.ownership.default !== CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
      shortcutHand.update({
        'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      });
    }

    // Creates the outer container
    const handMiniBar = await renderTemplate('modules/adventure-hand-bars/templates/adventure-hand-bars-container.hbs', { numBars: game.settings.get(AdventureHandBarsModule.moduleName, 'HandCount'), bars: AdventureHandBarsModule.AdventureBarsList, shortcut: shortcutHand });
    const handMiniBarElem = document.getElementById('adventure-hand-bars-container');
    const uiBottom = document.getElementById('ui-bottom');
    if (!handMiniBarElem) {
      uiBottom.insertAdjacentHTML("beforeEnd", handMiniBar);
    } else {
      handMiniBarElem.outerHTML = handMiniBar;
    }

    // Update the bar's placement in the UI
    AdventureHandBarsModule.updatePosition();
    // Set up listeners for hand bar UI
    const bars = document.querySelectorAll('.adventure-hand-bar-hand-inner');
    for (const b of bars) {
      const barIndex = b.dataset.barIndex;
      const bar = AdventureHandBarsModule.AdventureBarsList[barIndex];
      const barSelectorId = `#adventure-hand-bar-hand-${barIndex}`;

      // Open Hand Sheet
      const handContainer = document.querySelector(`${barSelectorId} .adventure-hand-bar-card-container`);
      if (handContainer && bar.hand) {
        handContainer.addEventListener('click', async (e) => {
          await bar.hand.sheet.render(true);
        });
      }

      //
      const emptyHandMessage = document.querySelector(`${barSelectorId} .empty-hand-message`);
      if (!!emptyHandMessage) {
        emptyHandMessage.addEventListener('click', async (e) => {
          await bar.chooseDialog(e);
        });
      }

      // Choose Hand
      const chooseHandButton = document.querySelector(`${barSelectorId} .adventure-hand-bar-settings-choose`);
      if (chooseHandButton) {
        chooseHandButton.addEventListener('click', async (e) => {
          bar.barIndex = barIndex;
          await bar.chooseDialog(e);
        });
      }

      const drawCardButton = document.querySelector(`${barSelectorId} .adventure-hand-bar-draw`);
      if (drawCardButton) {
        drawCardButton.addEventListener('click', async (e) => {
          await bar.drawCard(e);
        });
      }
    }

    // Show/Hide hand bars
    const hideShowBarElem = document.querySelector('.adventure-hand-bar-hide-show');
    hideShowBarElem.addEventListener('click', () =>  document.getElementById('adventure-hand-bars-container').classList.toggle('hidden'));

    // Display Discard Pile Sheet
    document.querySelector('.adventure-hand-bar-pile-shortcut').addEventListener('click', async function (e) {
      let cardsId = $(e.target).data("cards");
      const cardStack = game.cards.get(cardsId);
      await cardStack.sheet.render(true);
    });

    // Add a hand bar
    document.querySelector('.adventure-hand-bar-add-bar').addEventListener('click', async () => {
      let newHandCount = game.settings.get(AdventureHandBarsModule.moduleName, 'HandCount') + 1;
      if (newHandCount < AdventureHandBarsModule.handMax + 1) {
        const index = newHandCount - 1;
        game.settings.set(AdventureHandBarsModule.moduleName, 'HandCount', newHandCount);
      }
    });

    // Remove a hand bar
    document.querySelector('.adventure-hand-bar-subtract-bar').addEventListener('click', async () => {
      let newHandCount = game.settings.get(AdventureHandBarsModule.moduleName, 'HandCount') - 1;
      if (newHandCount > 0) {
        game.settings.set(AdventureHandBarsModule.moduleName, 'HandCount', newHandCount);
      }
    });

    //initialize Options from saved settings
    AdventureHandBarsModule.updatePosition();
  },

  updatePosition: function () {
    let position = game.settings.get(AdventureHandBarsModule.moduleName, "BarPosition");
    let content = document.getElementById("adventure-hand-bars-container");
    const playersElement = document.getElementById("players");
    const uiBottomElement = document.getElementById("ui-bottom");
    let target = undefined;
    if (content) {
      if (position === 'above_players') {
        target = playersElement;
        content.classList.add('app');
      } else {
        target = document.querySelector("#ui-bottom > div");
        content.classList.remove('app');
        uiBottomElement.classList.add('adventure-hand-bar');
      }
      uiBottomElement.classList.remove("adventure-hand-bar-left");
      uiBottomElement.classList.remove("adventure-hand-bar-right");
      content.classList.remove("adventure-hand-bar-above-players");
      if (position === "left_bar") {
        uiBottomElement.classList.add("adventure-hand-bar-left");
        target.append(content);
      } else if (position === "right_bar") {
        uiBottomElement.classList.add("adventure-hand-bar-right");
        target.append(content);
      } else {
        content.classList.add("adventure-hand-bar-above-players");
        target.before(content);
      }
    }
  },

  updateHandCount: function (newHandCount) { // value is the new value of the setting
    if (newHandCount > AdventureHandBarsModule.handMax) {
      newHandCount = AdventureHandBarsModule.handMax;
    }
    let difference = 0;
    //add more
    if (newHandCount > AdventureHandBarsModule.AdventureBarsList.length) {
      difference = newHandCount - AdventureHandBarsModule.AdventureBarsList.length;
      for (let i = 0; i < difference; i++) {
        const handId = game.user.getFlag(AdventureHandBarsModule.moduleName, `CardsID-${AdventureHandBarsModule.AdventureBarsList.length}`);
        const hand = game.cards.get(handId);
        new AdventureHandBar({ barIndex: AdventureHandBarsModule.AdventureBarsList.length, hand: hand });
      }
    } else if (newHandCount < AdventureHandBarsModule.AdventureBarsList.length) {
      //remove some may need additional cleanup
      difference = AdventureHandBarsModule.AdventureBarsList.length - newHandCount;
      for (let i = 0; i < difference; i++) {
        const barElem = AdventureHandBarsModule.AdventureBarsList.pop();
        barElem.remove();
      }
    }
    AdventureHandBarsModule.render();
  },

  restore: async function () {
    for (const h of AdventureHandBarsModule.AdventureBarsList) {
      await h.restore();
    }
  },

  //Opens the hand for any additional options
  openHand: async function (hand) {
    if (hand == undefined) {
      ui.notifications.warn(game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    if (hand.sheet.rendered) {
      hand.sheet.close();
    } else {
      hand.sheet.render(true);
    }
  },

  cardSort(a, b) {
    if (a.sort < b.sort) return 1;
    if (a.sort > b.sort) return -1;
    return 0;
  }
};

Hooks.on("init", function () {
  game.settings.register(AdventureHandBarsModule.moduleName, 'HandCount', {
    name: game.i18n.localize("HANDMINIBAR.HandCountSetting"),
    hint: game.i18n.localize("HANDMINIBAR.HandCountSettingHint"),
    scope: 'client',     // "world" = sync to db, "client" = local storage
    config: false,       // false if you dont want it to show in module config
    type: Number,       // Number, Boolean, String,
    default: 1,
    range: {             // If range is specified, the resulting setting will be a range slider
      min: 0,
      max: 10,
      step: 1
    },
    onChange: (value) => AdventureHandBarsModule.updateHandCount(value),
  });
  game.settings.register(AdventureHandBarsModule.moduleName, 'BarPosition', {
    name: game.i18n.localize("HANDMINIBAR.BarPositionSetting"),
    hint: game.i18n.localize("HANDMINIBAR.BarPositionSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: String,       // Number, Boolean, String,
    choices: {
      "right_bar": game.i18n.localize("HANDMINIBAR.BarPositionRightMacroSetting"),
      "left_bar": game.i18n.localize("HANDMINIBAR.BarPositionLeftMacroSetting"),
      "above_players": game.i18n.localize("HANDMINIBAR.BarPositionAbovePlayersSetting")
    },
    default: "right_bar",
  });
});

Hooks.on("ready", function () {
  // Pre Load templates.
  loadTemplates(['modules/adventure-hand-bars/templates/adventure-hand-bars-container.hbs']);
  // Get the adventure deck using the stored name in the adventure cards module.
  const adventureDeck = game.cards.getName(game.settings.get(AdventureHandBarsModule.adventureDeckModuleName, 'deckName'));
  // Check if default ownership is Limited for card draws. If it's not, set it.
  if (game.user.isGM && adventureDeck && adventureDeck.ownership.default < CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED) {
    adventureDeck.update({ 'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED });
  }
  AdventureHandBarsModule.createBars();
});

/*
 * Hooks to listen to changes in settings and hands data
 * Useful: CONFIG.debug.hooks = true
*/

// Hook for rendering the hands container if the name of the Adventure Deck Discard Pile is changed.
Hooks.on("updateSetting", (data) => {
  const keys = ['adventure-deck.dumpPileName', `${AdventureHandBarsModule.moduleName}.BarPosition`]
  if (keys.includes(data.key)) {
    AdventureHandBarsModule.render();
  }
});

// Hook for rendering hands when cards are dealt.
Hooks.on("createCard", (data) => {
  AdventureHandBarsModule.render();
});

// Hook for rendering hands when cards are dealt.
Hooks.on("deleteCard", (data) => {
  AdventureHandBarsModule.render();
});

// Hook for rendering hands when cards are recalled.
Hooks.on("createChatMessage", (data) => {
  // Get the Adventure Deck
  const deck = game.cards.getName(game.settings.get("adventure-deck", "deckName"));
  // If the message includes the UUID of the deck, render the hands.
  if (data.content.includes(deck.uuid)) AdventureHandBarsModule.render();
});