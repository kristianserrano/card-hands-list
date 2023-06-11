
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's Card Hands
 * Developer: Kristian Serrano
 */

const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CARDHANDSLIST',
  scrollPosition: '',
  hidden: true,
  render: async function () {
    // Get the hidden state of the container from the settings
    const hidden = handsModule.hidden;
    // If it's available, set the scroll position in case it was rendered after starring a hand.
    const handsWrapperElement = document.getElementById(`${handsModule.id}-hands-wrapper`);
    if (handsWrapperElement) handsModule.scrollPosition = handsWrapperElement.scrollTop;
    const ownershipLevel = game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER';
    const availableHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel));

    // Get the container for the module UI
    const containerElement = document.getElementById(`${handsModule.id}-container`);
    // If the container is in the DOM...
    if (containerElement) {
      // Remove it
      containerElement.remove();
    }
    // Render the template
    const containerHTML = await renderTemplate(`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`, {
      hands: availableHands,
      hidden: hidden,
      isGM: game.user.isGM,
      moduleId: handsModule.id,
      translationPrefix: handsModule.translationPrefix,
      favorites: game.user.getFlag(handsModule.id, 'favorite-hands'),
    });

    // Get the Players List Element
    const playersListElement = document.getElementById('players');
    // Insert the module UI Element
    const containers = document.querySelectorAll(`#${handsModule.id}-container`);
    if (!containers.length) {
      playersListElement.insertAdjacentHTML('beforebegin', containerHTML);


      // Set the wrapper's scroll position to the previous position.
      document.getElementById(`${handsModule.id}-hands-wrapper`).scrollTop = handsModule.scrollPosition;

      /* Set up listeners for Card Hands List UI */
      // Get all the Card Hands and loop through them
      const handElements = document.querySelectorAll(`.${handsModule.id}-hand`);

      // For each Hand...
      for (const handElement of handElements) {
        // Get its Hand
        const hand = await game.cards.get(handElement.dataset.handId);
        // Set the Element ID to use for query selectors
        const handElementId = `#${handsModule.id}-${hand.id}`;
        // Add listener for opening the Card Hand sheet when clicking on the Card Hand name
        document.querySelector(`${handElementId} .${handsModule.id}-name`).addEventListener('click', async (e) => await hand.sheet.render(true));
        // Get the Card Hands list element
        const cardsListElement = document.querySelector(`${handElementId} .${handsModule.id}-cards`);
        // Add listener for opening the Card Hand sheet when clicking on the Cards container
        cardsListElement.addEventListener('click', async (e) => await hand.sheet.render(true));
        // Add listener for dropping a Card within the Cards list element.
        cardsListElement.addEventListener('drop', async (e) => {
          // Prevent multiple executions
          e.stopImmediatePropagation();
          // Get the data transfer text value
          const textDataTransfer = e.dataTransfer.getData('text/plain');
          if (textDataTransfer) {
            // If there's a value, parse it
            const parsedDataTransfer = JSON.parse(textDataTransfer);
            if (parsedDataTransfer && parsedDataTransfer.type === 'Card') {
              // If there is parsed data, get the document from the UUI
              const cardDragged = await fromUuid(parsedDataTransfer.uuid);
              if (cardDragged) {
                // If there's an actual document
                const dropTarget = await fromUuid(e.target.dataset.uuid);
                let hand = undefined;
                if (dropTarget.documentName === 'Card') {
                  // If the target is a Card, get its Hand
                  hand = await fromUuid(dropTarget.parent.uuid);
                } else if (dropTarget.documentName === 'Cards' && dropTarget.type === 'hand') {
                  // If the target is a Hand, set the Hand.
                  hand = dropTarget;
                }

                if (cardDragged.parent.id !== hand.id) {
                  // If the Card's parent and the target Card Hand are not the same, pass the Card
                  await cardDragged.parent.pass(hand, [cardDragged.id]);
                } else {
                  // If they are the same, order the Cards.
                  const otherCards = hand.cards.filter((c) => c.id !== cardDragged.id);
                  const data = SortingHelpers.performIntegerSort(cardDragged, { target: dropTarget, siblings: otherCards });
                  const target = data[0].target;
                  const sort = data[0].update.sort;
                  await target.update({ sort: sort });
                }
              }
            }
          }
        });

        const cardsListItemElements = handElement.querySelectorAll('li');
        for (const li of cardsListItemElements) {
          // On right click
          li.children[0].addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            const card = await fromUuid(e.target.dataset.uuid);
            await card.flip();
          });

          // On dragStart
          li.children[0].addEventListener('dragstart', async (e) => {
            const data = {
              type: "Card",
              uuid: e.target.dataset.uuid
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
          });
        }

        // Add listener for favoriting a Hand.
        document.querySelector(`${handElementId} .${handsModule.id}-favorite`).addEventListener('click', async function (e) {
          // Prevent multiple executions
          e.stopImmediatePropagation();
          // Set the user flag key
          const flagKey = 'favorite-hands';
          // Get the ID of the Card Hand that's being favorited or unfavorited.
          const handId = e.target.parentElement.dataset.handId;
          // Get the current list of favorited Card Hand IDs from the user flag
          let favorites = game.user.getFlag(handsModule.id, flagKey);
          // A quick catch for an empty favorites flag
          if (!favorites) favorites = [];
          // If the list of favorites includes this Card Hand already...
          if (favorites.includes(handId)) {
            // Unfavorite it by remove the Card Hand from the array and updating the user flag
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
            const swadeAdventureDeckModule = game.modules.find((m) => m.id === 'adventure-deck');
            if (
              swadeAdventureDeckModule?.active &&
              cardsDrawn.some((c) => c.type === 'adventure') &&
              game.settings.get('adventure-deck', 'announceCards')
            ) {
              // If Adventure Cards and Announce Cards is enabled in that module...
              // Prerender Chat Card.
              const message = await renderTemplate(`modules/adventure-deck/templates/dealtcards-chatcard.hbs`, {
                player: hand.name,
                cards: cardsDrawn
              });
              // Print Card to chat.
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
};

Hooks.on('init', function () {
  // Register the ownership level option
  game.settings.register(handsModule.id, 'observerLevel', {
    name: `${handsModule.translationPrefix}.ObserverLevel.Name`,
    hint: `${handsModule.translationPrefix}.ObserverLevel.Hint`,
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: async () => await handsModule.render()
  });
});

Hooks.on('ready', function () {
  // Preload the template and render the UI
  loadTemplates([`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`]);
  handsModule.render();
});

/* Hooks to listen to changes in settings and Card Hands data */
// Array of Card Hooks
const cardHandsListCardHooksArray = [
  'createCard',
  'updateCard',
  'deleteCard',
];

// Array of Cards (i.e., Stacks) Hooks
const cardHandsListCardsHooksArray = [
  'createCards',
  'updateCards',
  'deleteCards',
];

// Hooks for Card events
for (const hook of cardHandsListCardHooksArray) {
  Hooks.on(hook, (data) => {
    if (data.parent.type === 'hand') handsModule.render();
  });
}

// Hooks for Card Stack events
for (const hook of cardHandsListCardsHooksArray) {
  Hooks.on(hook, (data) => {
    if (data.type === 'hand') handsModule.render();
  });
}

// When the Player List is rendered, render the module UI
Hooks.on('renderPlayerList', (data) => {
  if (game.ready) handsModule.render();
});

// When a Cards sheet is rendered, add the drop event listener.
Hooks.on('renderCardsHand', (data) => {
  document.getElementById(data.id).addEventListener('drop', async (e) => {
    const card = await fromUuid(e.dataTransfer.getData('text/plain'));
    card?.parent.pass(data.document, [card.id]);
  });
});

/* Handlebar Helpers */

// Handlebar helper for concat but with a namespaced helper name so as not to override the default concat helper
Handlebars.registerHelper('cardHandsList_Concat', function (string1, string2) {
  return string1 + string2;
});

// Handlebar helper for determining if the use is a GM
Handlebars.registerHelper('cardHandsList_IsGM', function () {
  return game.user.isGM;
});

// Handlebar helper for searching if an array includes a string
Handlebars.registerHelper('cardHandsList_Includes', function (array, str) {
  //if (!array) return false;
  return array?.includes(str);
});

// Handlebar helper for sorting Cards in the Card Hands list.
Handlebars.registerHelper('cardHandsList_SortCards', (objects, property) => {
  return Array.from(objects).sort((a, b) => {
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
    };
  });
});