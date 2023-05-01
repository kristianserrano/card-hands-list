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

    /**
     * current hand object from FoundryVTT (Cards Object)
     */
    this.currentCards = undefined;

    /**
     * current user used to identify they user associated with the hand for GMs
     */
    this.currentUser = undefined;

    /**
     * HTML hook for this hand
     */
    this.html = undefined;

    /**
     * GMs can have multiple hands for each player matching the bar on the players side
     */
    this.playerBarCount = 0;

    let bar = this;
    const handName = !!this.hand ? this.hand.name : undefined;

    //auto register to listen for updates
    if (!AdventureHandBarsModule.AdventureBarsList[bar.barIndex]) {
      AdventureHandBarsModule.AdventureBarsList.push(bar);
    }

    return bar;
  }

  //sets and renders the cards based on users choice
  async setCardsOption(hand) {
    this.hand = hand;
    if (!hand) {
      await this.resetCardsID();
      this.html.find('.empty-hand-message').click(function (e) { this.chooseDialog(e); });
    } else {
      // Add hand to User flags
      await this.storeCardsID(hand);
    }

    await AdventureHandBarsModule.render();
  }

  //sets the user, only available to GMs
  async setUserOption(chosenUser) {
    this.currentUser = chosenUser;
    await this.storeUserID(chosenUser.id);
    //await this.renderHand(this.hand);
    if (game.user.isGM) {
      //check to see if user has a hand selected already
      let handId = user.getFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.playerBarCount}`);
      if (!!handId) {
        await this.storeCardsID(hand);
        await this.setCardsID(hand);
      } else {
        await this.resetCardsID();
      }
      await AdventureHandBarsModule.updatePlayerHands();
    }
  }
  //sets and renders the cards based on the id
  async setCardsID(hand) {
    if (hand != undefined) {
      await game.user.setFlag(AdventureHandBarsModule.moduleName, `Cards-${this.barIndex}`, hand.id);
      await this.renderHand(hand);
    }
  }

  //sets and renders the cards based on the id
  setUserID(user) {
    if (user != undefined) {
      this.currentUser = user;
    }
  }

  async chooseDialog() {
    const bar = this;
    //options based on state and GM status
    let buttons = [];
    const hands = [];
    for (const b of AdventureHandBarsModule.AdventureBarsList) {
      if (b.hand) hands.push(b.hand.id);
    }
    const newHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, "OBSERVER") && !hands.includes(c.id));
    if (newHands.length > 0) {
      buttons.push({
        label: game.i18n.localize("HANDMINIBAR.Hand"),
        callback: async function () {
          await bar.chooseHandDialog();
        }
      });
    }

    if ((bar.hand !== undefined)|| bar.currentUser !== undefined) {
      buttons.push({
        label: game.i18n.localize("HANDMINIBAR.ResetBar"),
        callback: async function () {
          await bar.reset();
        }
      });
    }

      let d = new Dialog({
        title: game.i18n.localize("HANDMINIBAR.ChooseForGMTitle"),
        content: `<p>${game.i18n.localize("HANDMINIBAR.ChooseForGMQuestion")}</p>`,
        buttons: buttons
      });
      d.render(true);
  }

  //Select a hand for this Toolbar
  async chooseHandDialog() {
    const bar = this;
    let userHTML = $("<select class='adventure-hand-bar-hand-selection' name='users'/>");
    const hands = [];
    for (const b of AdventureHandBarsModule.AdventureBarsList){
      if (b.hand) hands.push(b.hand.id);
    }
    const newHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, "OBSERVER") && !hands.includes(c.id));
    for (const hand of newHands) {
      userHTML.append(`<option value="${hand.id}">${hand.name}</option>`);
    };

    userHTML = $("<div class='adventure-hand-bar-option-container'/>").append(userHTML);

    new Dialog({
      title: game.i18n.localize("HANDMINIBAR.DeckList"),
      content: `
        <p>${game.i18n.localize("HANDMINIBAR.ChooseHand")}</p>
        ${userHTML[0].outerHTML}
      `,
      buttons: {
        ok: {
          label: "OK",
          callback: async function (html) {
            let chosenHandId = $(html).find(".adventure-hand-bar-hand-selection").val();
            await bar.setCardsOption(game.cards.get(chosenHandId));
          }
        },
        cancel: {
          label: "Cancel",
          callback: function () { }
        }
      }
    }).render(true);
  }

  //Draws a card into this hand
  async drawCard(e) {
    if (this.hand == undefined) {
      ui.notifications.warn(game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    await this.drawDialog(this.hand);
  }

  async drawDialog(hand) {
    // Assign the Adventure Deck as the default deck
    const adventureDecks = game.cards.filter(c => (c.type === "deck") && c.testUserPermission(game.user, "LIMITED") && c.name === game.settings.get(AdventureHandBarsModule.adventureDeckModuleName, 'deckName'));
    if (!adventureDecks.length) return ui.notifications.warn("CARDS.DrawWarnNoSources", { localize: true });

    // Construct the dialog HTML
    const html = await renderTemplate("templates/cards/dialog-draw.html", {
      decks: adventureDecks,
      modes: {
        [CONST.CARD_DRAW_MODES.TOP]: "CARDS.DrawModeTop",
      }
    });
    // Construct a new form element and add the content and the classes needed
    const newHTML = document.createElement('form');
    newHTML.classList.add('cards-dialog');
    newHTML.innerHTML = html;
    const notes = newHTML.children[0];
    notes.innerText = "Select how many Adventure Cards to draw.";
    // Rip out the unecessary fields. We just need to know how many to draw
    newHTML.removeChild(newHTML.children[4]);
    newHTML.removeChild(newHTML.children[3]);
    newHTML.removeChild(newHTML.children[1]);
    // Display the prompt
    return Dialog.prompt({
      title: game.i18n.localize("CARDS.DrawTitle"),
      label: game.i18n.localize("CARDS.Draw"),
      content: newHTML.outerHTML,
      callback: async html => {
        const form = html.querySelector("form.cards-dialog");
        let fd = new FormDataExtended(form).object;
        if (!fd) {
          fd = new FormDataExtended(form).toObject();
        }
        const deck = game.cards.getName(game.settings.get("adventure-deck", "deckName"));
        const cardsAmount = fd.number;
        const prevDrawn = deck.drawnCards;
        var newlyDrawn = (await deck.deal([hand], cardsAmount)).drawnCards.filter(n => !prevDrawn.includes(n));

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
      },
      rejectClose: false,
      options: { jQuery: false }
    });
  }

  //Only tries to update the player color if GM this may change in the future
  updatePlayerColor() {
    if (!!this.currentUser) {
      let color = this.currentUser.color ? this.currentUser.color : this.currentUser.data.color;
      $(`#adventure-hand-bar-card-container-${this.id}`).css("border-left", `3px solid ${color}`);
    } else {
      $(`#adventure-hand-bar-card-container-${this.id}`).css("border-left", "none");
    }
  }

  //Gets any stored CardsID
  async restore() {
    const handId = this.getStoredCardsID();
    this.setUserID(this.getStoredUserID());
  }

  //stores the current cards ID
  async storeCardsID(hand) {
    await game.user.setFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.barIndex}`, hand.id);
  }

  //reset the current cards ID
  async resetCardsID() {
    const index = parseInt(this.barIndex);
    await game.user.unsetFlag(AdventureHandBarsModule.moduleName, `CardsID-${index}`);
    AdventureHandBarsModule.AdventureBarsList[index] = new AdventureHandBar({ barIndex: index })
    await AdventureHandBarsModule.render();
  }

  //gets the previously selected cards ID
  getStoredCardsID() {
    return game.user.getFlag(AdventureHandBarsModule.moduleName, `CardsID-${this.barIndex}`);
  }

  //Resets the Toolbar
  async reset() {
    await this.resetCardsID();
  }

  //Removes the html element from the screen
  remove() {
    if (this.html) {
      this.html.remove();
    }
  }

  getCards() {
    return this.hand;
  }
}