/**
 * Each instance of a Mini Bar
 */
export default class AdventureHandBar {
  constructor(data) {
    /**
     * an integer to identify this hand so we can have multiple on the screen
     */
    this.barIndex = data.barIndex;
    this.hand = data.hand;

    // If this bar doesn't already exist in the list, push it to the list.
    if (!AdventureHandBarsModule.AdventureBarsList[this.barIndex]) {
      AdventureHandBarsModule.AdventureBarsList.push(this);
    }

    return this;
  }

  //sets and renders the cards based on users choice
  async setCardsOption(hand) {
    this.hand = hand;
    if (!hand) {
      await this.resetCardsID();
    } else {
      // Add hand to User flags
      await this.storeCardsID(hand.id);
    }
    await AdventureHandBarsModule.render();
  }

  async chooseDialog() {
    const bar = this;
    //options based on state and GM status
    let buttons = [];
    let message = '';
    const hands = [];
    for (const b of AdventureHandBarsModule.AdventureBarsList) {
      if (b.hand) hands.push(b.hand.id);
    }
    game.cards.filter(c => c.type === 'hand')
    const newHands = game.cards.filter((c) => c.type === 'hand' && c.getFlag(AdventureHandBarsModule.adventureDeckModuleId, 'group') === 'adventure hands' && c.testUserPermission(game.user, "OBSERVER") && !hands.includes(c.id));
    if (newHands.length > 0) {
      buttons.push({
        label: game.i18n.localize("ADVENTUREHANDBARS.Hand"),
        callback: async function () {
          await bar.chooseHandDialog();
        }
      });
    }

    if ((bar.hand !== undefined)|| bar.currentUser !== undefined) {
      buttons.push({
        label: game.i18n.localize("ADVENTUREHANDBARS.ResetBar"),
        callback: async function () {
          await bar.resetCardsID();
        }
      });
      message = game.i18n.localize("ADVENTUREHANDBARS.ResetToolbar");
    }

    if (buttons.length > 1) message = game.i18n.localize("ADVENTUREHANDBARS.ChooseOrReset");

    new Dialog({
      title: game.i18n.localize("ADVENTUREHANDBARS.ReconfigureToolbarTitle"),
      content: `<p>${message}</p>`,
      buttons: buttons
    }).render(true);
  }

  //Select a hand for this Toolbar
  async chooseHandDialog() {
    const bar = this;
    let select = '<select class="adventure-hand-bar-hand-selection" name="hands">';
    const hands = [];
    for (const b of AdventureHandBarsModule.AdventureBarsList){
      if (b.hand) hands.push(b.hand.id);
    }
    const newHands = game.cards.filter((c) => c.type === 'hand' && c.getFlag(AdventureHandBarsModule.adventureDeckModuleId, 'group') === 'adventure hands' && c.testUserPermission(game.user, "OBSERVER") && !hands.includes(c.id));
    if (newHands.length > 0) {
      for (const hand of newHands) {
        select += `<option value="${hand.id}">${hand.name}</option>`;
      };
      select += '</select>';

      new Dialog({
        title: game.i18n.localize("ADVENTUREHANDBARS.DeckList"),
        content: `
        <p>${game.i18n.localize("ADVENTUREHANDBARS.ChooseHand")}</p>
        ${select}
      `,
        buttons: {
          ok: {
            label: "OK",
            callback: async function (html) {
              const chosenHandId = document.querySelector(".adventure-hand-bar-hand-selection").value;
              await bar.setCardsOption(game.cards.get(chosenHandId));
            }
          },
          cancel: {
            label: "Cancel",
            callback: function () { }
          }
        }
      }, {
        classes: ['dialog', 'adventure-hand-bar-option-dialog']
      }).render(true);
    } else {
      ui.notifications.warn(game.i18n.localize("ADVENTUREHANDBARS.NoOtherHandsAvailable"));
    }
  }

  //Draws a card into this hand
  async drawCard(e) {
    const hand = this.hand;
    if (hand === undefined) {
      ui.notifications.warn(game.i18n.localize("ADVENTUREHANDBARS.NoHandSelected"));
    } else {
      const deck = game.cards.getName(game.settings.get("adventure-deck", "deckName"));
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
  }

  //stores the current cards ID
  async storeCardsID(handId) {
    await game.user.setFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.barIndex}`, handId);
  }

  //reset the current cards ID
  async resetCardsID() {
    await game.user.unsetFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.barIndex}`);
    AdventureHandBarsModule.AdventureBarsList[this.barIndex] = new AdventureHandBar({ barIndex: this.barIndex })
    await AdventureHandBarsModule.render();
  }

  //gets the previously selected cards ID
  getStoredCardsID() {
    return game.user.getFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.barIndex}`);
  }
}