
import { CardHandsList } from './CardHandsList.mjs';
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's Card Hands
 * Developer: Kristian Serrano
 */

export const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CardHandsList',
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
    onChange: () => ui.cardHands.render(true)
  });

  if (game.modules.get('minimal-ui')?.active) {
    game.settings.register(handsModule.id, 'minimal-ui-behavior', {
      name: `${handsModule.translationPrefix}.MinimalUIBehavior.Name`,
      hint: `${handsModule.translationPrefix}.MinimalUIBehavior.Hint`,
      scope: 'world',
      config: true,
      type: String,
      choices: {
        "always": game.i18n.localize("MinimalUI.SettingsAlwaysVisible"),
        "autohide": game.i18n.localize("MinimalUI.SettingsAutoHide"),
      },
      default: "always",
      requiresReload: true,
    });
  }
});

Hooks.on('setup', async function () {
  // Preload the template and render the UI
  loadTemplates([
    `modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`,
    `modules/${handsModule.id}/templates/hand.hbs`
  ]);

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
  Handlebars.registerHelper('cardHandsList_Sort', (objects, property) => {
    return Array.from(objects).sort((a, b) => {
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

  // Enrich HTML.
  Handlebars.registerHelper('CardHandsList_enrichHTML', (text) => {
    return TextEditor.enrichHTML(text, { async: false });
  });

  ui.cardHands = new CardHandsList;
});

Hooks.on('ready', async function () {
  if (game.ready) {
    await ui.cardHands.render(true);
  }

  // Migrate favorites flag to pinned flag.
  const favoritedHands = game.user.getFlag(handsModule.id, 'favorite-hands');

  if (favoritedHands?.length) {
    await game.user.setFlag(handsModule.id, 'pinned-hands', favoritedHands);
    await game.user.unsetFlag(handsModule.id, 'favorite-hands');
  }
});

Hooks.on('renderCardHandsList', (cardHandsList, html, data) => {
  // Move the Card Hands List element to be placed above the Player List element
  if (ui.players.element[0].previousElementSibling.id !== html[0]?.id) {
    ui.players.element[0]?.before(html[0]);
  }

  // Restore horizontal scroll positions
  setTimeout(() => {
    for (const handElement of html[0].querySelectorAll(`.${handsModule.id}-cards-list`)) {
      const positionToSet = cardHandsList._handScrollPositions.get(handElement.dataset.id) ?? 0;
      handElement.scrollLeft = positionToSet;
    }
  }, "1");
});

// When the Player List is rendered, render the module UI
Hooks.on('renderPlayerList', async (data) => {
  // Move the Card Hands List element to be placed above the Player List element
  if (ui.players.element[0].previousElementSibling !== ui.cardHands.element[0]) {
    ui.players.element[0]?.before(ui.cardHands.element[0]);
  }
});

/* Hooks to listen to changes in settings and Card Hands data */
// Array of Card Hooks
const cardHandsListCardHooksArray = [
  'createCard',
  'updateCard',
  'deleteCard',
];

// Hooks for Card events
for (const hook of cardHandsListCardHooksArray) {
  Hooks.on(hook, async (data) => {
    if (data.parent.type === 'hand') {
      const handElement = document.querySelector(`.${handsModule.id}-cards-list[data-id="${data.parent.id}"]`);
      ui.cardHands._handScrollPositions.set(data.parent.id, handElement.scrollLeft);
      await ui.cardHands.render(false);
    }
  });
}

// Array of Cards (i.e., Stacks) Hooks
const cardHandsListCardsHooksArray = [
  'createCards',
  'updateCards',
  'deleteCards',
];

// Hooks for Card Stack events
for (const hook of cardHandsListCardsHooksArray) {
  Hooks.on(hook, async (data) => {
    if (data.type === 'hand') {
      const handElement = document.querySelector(`.${handsModule.id}-cards-list[data-id="${data.id}"]`);
      ui.cardHands._handScrollPositions.set(data.id, handElement?.scrollLeft ?? 0);
      await ui.cardHands.render(true);
    }
  });
}
