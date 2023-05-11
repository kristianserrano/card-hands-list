
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's card hands
 * Developer: Kristian Serrano
 */

const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CARDHANDSLIST',
  scrollPosition: '',
  render: async function () {
    const ownershipLevel = game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER';
    const availableHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel));

    // Get the container for the module UI
    const containerElem = document.getElementById(`${handsModule.id}-container`);

    // Get the hidden state of the container from the settings
    const hidden = game.settings.get(handsModule.id, 'hideBars');
    // Render the template
    const containerHTML = await renderTemplate(`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`, {
      hands: availableHands,
      hidden: hidden,
      isGM: game.user.isGM,
      moduleId: handsModule.id,
      translationPrefix: handsModule.translationPrefix,
      favorites: game.user.getFlag(handsModule.id, 'favorite-hands'),
    });

    // If the container is in the DOM...
    if (containerElem) {
      // Update the HTML (There's a brief moment during dealing when the element doesn't have a parent element)
      if (containerElem.parentElement) containerElem.outerHTML = containerHTML;
    } else {
      // Otherwise insert it
      // Get Foundry VTT's Player List element
      const playersListElement = document.getElementById('players');
      // Insert the module UI element
      playersListElement.insertAdjacentHTML('beforebegin', containerHTML);
    }
    const handsList = document.getElementById(`${handsModule.id}-hands-wrapper`);
    handsList.scrollTop = handsModule.scrollPosition;

    /* Set up listeners for hand bar UI */

    // Get all the bars and loop through them
    const bars = document.querySelectorAll(`.${handsModule.id}-cards`);

    // For each bar...
    for (const b of bars) {
      // Get its hand
      const hand = await game.cards.get(b.dataset.handId);
      // Set the element ID to use for query selectors
      const barElemId = `#${handsModule.id}-${hand.id}`;
      // Add listener for opening the hand sheet when clicking on the hand name
      document.querySelector(`${barElemId} .${handsModule.id}-name`).addEventListener('click', async (e) => await hand.sheet.render(true));
      // Add listener for opening the hand sheet when clicking on the cards container
      document.querySelector(`${barElemId} .${handsModule.id}-cards-container`).addEventListener('click', async (e) => await hand.sheet.render(true));
      /* // Add listener for drawing a Card
      const drawCardButtonElem = document.querySelector(`${barElemId} .${handsModule.id}-draw`);
      // This button only appears for those with ownership permission, so check if it exists
      if (drawCardButtonElem) {
        drawCardButtonElem.addEventListener('click', async function (e) {
          e.stopImmediatePropagation();
          const handId = e.target.parentElement.dataset.handId;
          const hand = game.cards.get(handId);
          const deck = game.cards.getName(game.settings.get(handsModule.deckModule.id, 'deckName'));
          const cardDrawn = await hand.draw(deck);
          // If announce cards is enabled...
          if (game.settings.get(handsModule.deckModule.id, 'announceCards')) {
            // Prerender chat card.
            const message = await renderTemplate(`modules/${handsModule.deckModule.id}/templates/dealtcards-chatcard.hbs`, {
              player: hand.name,
              cards: cardDrawn
            });
            // Print card to chat.
            ChatMessage.create({
              user: game.user.id,
              type: CONST.CHAT_MESSAGE_TYPES.OTHER,
              content: message,
            });
          }
        });
      } */
      // Add listener for favoriting a hand.
      document.querySelector(`${barElemId} .${handsModule.id}-favorite`).addEventListener('click', async function (e) {
        e.stopImmediatePropagation();
        handsModule.scrollPosition = e.target.parentElement.parentElement.parentElement.parentElement.scrollTop;
        const flagKey = 'favorite-hands';
        let favorites = game.user.getFlag(handsModule.id, flagKey);
        const handId = e.target.parentElement.dataset.handId;
        if (!favorites) favorites = [];
        if (favorites.includes(handId)) {
          favorites.splice(favorites.indexOf(handId), 1);
          await game.user.setFlag(handsModule.id, flagKey, favorites);
        } else {
          favorites.push(handId);
          await game.user.setFlag(handsModule.id, flagKey, favorites);
        }
        //handsModule.render();
      });
    }

    // Add listener for hiding and showing the module UI container when the icon is clicked
    document.querySelector(`#${handsModule.id}-container h3`).addEventListener('click', async (e) => {
      e.stopImmediatePropagation();
      const containerElem = document.getElementById(`${handsModule.id}-container`);
      containerElem.classList.toggle('hidden');
      const arrow = document.querySelector(`.${handsModule.id}-mode`);
      arrow.classList.toggle('fa-angle-up');
      arrow.classList.toggle('fa-angle-down');
      await game.settings.set(handsModule.id, 'hideBars', containerElem.classList.contains('hidden'))
    });
  }
}

Hooks.on('init', function () {
  game.settings.register(handsModule.id, 'hideBars', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
  });
  game.settings.register(handsModule.id, 'observerLevel', {
    name: `${handsModule.translationPrefix}.ObserverLevel.Name`,
    hint: `${handsModule.translationPrefix}.ObserverLevel.Hint`,
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
});

Hooks.on('ready', function () {
  // Pre Load templates.
  loadTemplates([`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`]);
  // Get the deck using the stored name in the cards module.
  handsModule.render();
});

/*
 * Hooks to listen to changes in settings and hands data
 * CONFIG.debug.hooks = true
*/
// CONFIG.debug.hooks = true
// or use the Developer Mode module

Hooks.on('renderPlayerList', (data) => {
  if (game.ready) handsModule.render();
});
Hooks.on('updateCard', (data) => {
  if (data.parent.type === 'hand') handsModule.render();
});
Hooks.on('deleteCard', (data) => {
  if (data.parent.type === 'hand') handsModule.render();
});
Hooks.on('createCard', (data) => {
  if (data.parent.type === 'hand') handsModule.render();
});
Hooks.on('updateSetting', (data) => {
  if (data.key === 'card-hands-list.observerLevel') handsModule.render();
});

Handlebars.registerHelper('includes', function (obj, str) {
  if (!obj) return false;
  return obj.includes(str);
});