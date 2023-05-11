
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
    const handsWrapperElement = document.getElementById(`${handsModule.id}-hands-wrapper`);
    if (handsWrapperElement) handsModule.scrollPosition = handsWrapperElement.scrollTop;
    const ownershipLevel = game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER';
    const availableHands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel));

    // Get the container for the module UI
    const containerElement = document.getElementById(`${handsModule.id}-container`);

    // Get the hidden state of the container from the settings
    const hidden = game.settings.get(handsModule.id, 'collapseHandsContainer');
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

    // Get all the hands and loop through them
    const handElements = document.querySelectorAll(`.${handsModule.id}-cards`);

    // For each hand...
    for (const handElement of handElements) {
      // Get its hand
      const hand = await game.cards.get(handElement.dataset.handId);
      // Set the Element ID to use for query selectors
      const handElementId = `#${handsModule.id}-${hand.id}`;
      // Add listener for opening the hand sheet when clicking on the hand name
      document.querySelector(`${handElementId} .${handsModule.id}-name`).addEventListener('click', async (e) => await hand.sheet.render(true));
      // Add listener for opening the hand sheet when clicking on the cards container
      document.querySelector(`${handElementId} .${handsModule.id}-cards-container`).addEventListener('click', async (e) => await hand.sheet.render(true));
      // Add listener for drawing a Card
      const drawCardButtonElement = document.querySelector(`${handElementId} .${handsModule.id}-draw`);
      // This button only appears for those with ownership permission, so check if it exists
      if (drawCardButtonElement) {
        drawCardButtonElement.addEventListener('click', async function (e) {
          e.stopImmediatePropagation();
          const handId = e.target.parentElement.dataset.handId;
          const hand = game.cards.get(handId);
          hand.drawDialog();
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
      await game.settings.set(handsModule.id, 'collapseHandsContainer', !game.settings.get(handsModule.id, 'collapseHandsContainer'))
      // Rerender the container
      handsModule.render();
    });
  }
}

Hooks.on('init', function () {
  // Register the collapsed state setting
  game.settings.register(handsModule.id, 'collapseHandsContainer', {
    name: 'Collapse Hands List',
    hint: 'Stores the collapsed state of the hands list.',
    scope: 'client',
    config: false,
    type: Boolean,
    default: true,
  });

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

// Handlebar helper for searching if an array includes a string
Handlebars.registerHelper('includes', function (array, str) {
  if (!array) return false;
  return array.includes(str);
});