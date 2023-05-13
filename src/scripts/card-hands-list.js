
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's card hands
 * Developer: Kristian Serrano
 */

const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CARDHANDSLIST',
  scrollPosition: '',
  hidden: true,
  sortCards: function (a, b) {
    const property = 'sort';
    // Get the value of the property from each object
    const valueA = a[property];
    const valueB = b[property];

    // Compare the values
    if (valueA < valueB) {
      return -1;
    } else if (valueA > valueB) {
      return 1;
    } else {
      return 0;
    }
  },
  render: async function () {
    const handsWrapperElement = document.getElementById(`${handsModule.id}-hands-wrapper`);
    if (handsWrapperElement) handsModule.scrollPosition =  handsWrapperElement.scrollTop;
    const ownershipLevel = game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER';
    const availableHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel));

    // Get the container for the module UI
    const containerElement = document.getElementById(`${handsModule.id}-container`);

    // Get the hidden state of the container from the settings
    const hidden = handsModule.hidden;
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
    if (containerElement) {
      // Update the HTML (There's a brief moment during dealing when the Element doesn't have a parent Element)
      if (containerElement.parentElement) containerElement.outerHTML = containerHTML;
    } else {
      // Otherwise insert it
      // Get Foundry VTT's Player List Element
      const playersListElement = document.getElementById('players');
      // Insert the module UI Element
      playersListElement.insertAdjacentHTML('beforebegin', containerHTML);
    }
    // Set the wrapper's scroll position to the previous position.
    document.getElementById(`${handsModule.id}-hands-wrapper`).scrollTop = handsModule.scrollPosition;

    /* Set up listeners for hands list UI */
    const canvas = document.getElementById("board");
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const cardUuid = e.dataTransfer.getData('text/plain');
      console.log(cardUuid);
    });

    // Get all the hands and loop through them
    const handElements = document.querySelectorAll(`.${handsModule.id}-hand`);

    // For each hand...
    for (const handElement of handElements) {
      // Get its hand
      const hand = await game.cards.get(handElement.dataset.handId);
      // Set the Element ID to use for query selectors
      const handElementId = `#${handsModule.id}-${hand.id}`;
      // Add listener for opening the hand sheet when clicking on the hand name
      document.querySelector(`${handElementId} .${handsModule.id}-name`).addEventListener('click', async (e) => await hand.sheet.render(true));
      // Get the cards list element
      const cardsListElement = document.querySelector(`${handElementId} .${handsModule.id}-cards`);
      // Add listener for opening the hand sheet when clicking on the cards container
      cardsListElement.addEventListener('click', async (e) => await hand.sheet.render(true));
      // Add listener for dropping a card within the cards list element.
      cardsListElement.addEventListener('drop', async (e) => {
        // Prevent multiple executions
        e.stopImmediatePropagation();

        const cardDragged = await fromUuid(e.dataTransfer.getData('text/plain'));
        const dropTarget = await fromUuid(e.target.dataset.uuid);
        let hand = undefined;
        if (dropTarget.documentName === 'Card') {
          // If the target is a card, set the hand
          hand = await fromUuid(dropTarget.parent.uuid);
        } else if (dropTarget.documentName === 'Cards' && dropTarget.type === 'hand') {
          // If the target is a hand, set the hand.
          hand = dropTarget;
        }

        if (cardDragged.parent.id !== hand.id) {
          // If the card's parent and the target hand are not the same, pass the card
          await cardDragged.parent.pass(hand, [cardDragged.id]);
        } else {
          // If they are the same, order the cards.
          const otherCards = hand.cards.filter((c) => c.id !== cardDragged.id);
          const data = SortingHelpers.performIntegerSort(cardDragged, { target: dropTarget, siblings: otherCards });
          const target = data[0].target;
          const sort = data[0].update.sort;
          await target.update({ sort: sort });
        }
      });

      const cardsListItemElements = handElement.querySelectorAll('li');
      for (const li of cardsListItemElements) {
        // On right click
        li.children[0].addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          const card = await fromUuid(e.target.dataset.uuid);
          card.flip();
        });

        // On dragStart
        li.children[0].addEventListener('dragstart', async (e) => {
          e.dataTransfer.setData('text/plain', e.target.dataset.uuid);
        });
      }

      // Add listener for favoriting a hand.
      document.querySelector(`${handElementId} .${handsModule.id}-favorite`).addEventListener('click', async function (e) {
        // Prevent multiple executions
        e.stopImmediatePropagation();
        // Set the user flag key
        const flagKey = 'favorite-hands';
        // Get the ID of the hand that's being favorited or unfavorited.
        const handId = e.target.parentElement.dataset.handId;
        // Get the current list of favorited hand IDs from the user flag
        let favorites = game.user.getFlag(handsModule.id, flagKey);
        // A quick catch for an empty favorites flag
        if (!favorites) favorites = [];
        // If the list of favorites includes this hand already...
        if (favorites.includes(handId)) {
          // Unfavorite it by remove the hand from the array and updating the user flag
          favorites.splice(favorites.indexOf(handId), 1);
          await game.user.setFlag(handsModule.id, flagKey, favorites);
        } else {
          // Otherwise, add it to the list and update the user flag
          favorites.push(handId);
          await game.user.setFlag(handsModule.id, flagKey, favorites);
        }
      });

      // Add listener for drawing a Card
      const drawCardButtonElement = document.querySelector(`${handElementId} .${handsModule.id}-draw`);
      // This button only appears for those with ownership permission, so check if it exists
      if (drawCardButtonElement) {
        drawCardButtonElement.addEventListener('click', async function (e) {
          e.stopImmediatePropagation();
          const handId = e.target.parentElement.dataset.handId;
          const hand = game.cards.get(handId);
          const cardsDrawn = await hand.drawDialog();
          // If Adventure Cards and announce cards is enabled in that module...
          if (cardsDrawn.some((c) => c.type === 'adventure') && game.settings.get('adventure-deck', 'announceCards')) {
            // Prerender chat card.
            const message = await renderTemplate(`modules/adventure-deck/templates/dealtcards-chatcard.hbs`, {
              player: hand.name,
              cards: cardsDrawn
            });
            // Print card to chat.
            ChatMessage.create({
              user: game.user.id,
              type: CONST.CHAT_MESSAGE_TYPES.OTHER,
              content: message,
            });
          }
        });
      }
    }

    // Add listener for hiding and showing the module UI container when the icon is clicked
    document.querySelector(`.${handsModule.id}-title`).addEventListener('click', async (e) => {
      // Prevent multiple executions
      e.stopImmediatePropagation();
      // Get the angle icon element
      const angleIconElement = document.querySelector(`.${handsModule.id}-mode`);
      // Toggle the angle classes
      angleIconElement.classList.toggle('fa-angle-up');
      angleIconElement.classList.toggle('fa-angle-down');
      // Toggle the collapsed setting boolean
      handsModule.hidden = !handsModule.hidden;
      // Rerender the container
      handsModule.render();
    });
  }
}

Hooks.on('init', function () {
  // Register the ownership level option
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
  // Preload the template
  loadTemplates([`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`]);
  // Render the card hands list
  handsModule.render();
});

/* Hooks to listen to changes in settings and hands data */
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
// Hook for dropping cards on a canvas
Hooks.on('dropCanvasData', (data) => {
  console.log(data);
});

// Handlebar helper for searching if an array includes a string
Handlebars.registerHelper('includes', function (array, str) {
  if (!array) return false;
  return array.includes(str);
});

// Handlebar helper for sorting cards in the hands list.
Handlebars.registerHelper('sortCards', (objects, property) => {
  return Array.from(objects).sort(handsModule.sortCards);
});
