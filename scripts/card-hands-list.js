
import { CardHandsList } from './CardHandsList.js';
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's Card Hands
 * Developer: Kristian Serrano
 */

export const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CARDHANDSLIST',
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
    onChange: () => CONFIG.CardHandsList.render(true)
  });
});

Hooks.on('setup', async function () {
  // Preload the template and render the UI
  loadTemplates([`modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`]);
  CONFIG.CardHandsList = new CardHandsList;
});

Hooks.on('ready', async function () {
  if (game.ready) CONFIG.CardHandsList.render(true);
});

// When the Player List is rendered, render the module UI
Hooks.on('renderPlayerList', async (data) => {
  if (game.ready) CONFIG.CardHandsList.render(true);
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
    if (data.parent.type === 'hand') CONFIG.CardHandsList.render(true);
  });
}

// Hooks for Card Stack events
for (const hook of cardHandsListCardsHooksArray) {
  Hooks.on(hook, (data) => {
    if (data.type === 'hand') CONFIG.CardHandsList.render(true);
  });
}

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