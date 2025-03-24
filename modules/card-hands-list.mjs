
import { CardHandsList } from './apps/CardHandsList.mjs';
/**
 * Card Hands List
 * A Foundry VTT module to display and provide quick access to a player's Card Hands
 * Developer: Kristian Serrano
 */
export const handsModule = {
  id: 'card-hands-list',
  translationPrefix: 'CardHandsList',
};

//CONFIG.debug.hooks = true;

Hooks.on('init', function () {
  // Register the ownership level option
  game.settings.register(handsModule.id, 'observerLevel', {
    name: `${handsModule.translationPrefix}.Settings.ObserverLevel.Name`,
    hint: `${handsModule.translationPrefix}.Settings.ObserverLevel.Hint`,
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => ui.cardHands.render(true)
  });

  game.settings.register(handsModule.id, 'explicitOwnership', {
    name: `${handsModule.translationPrefix}.Settings.ExplicitOwnership.Name`,
    hint: `${handsModule.translationPrefix}.Settings.ExplicitOwnership.Hint`,
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
  foundry.applications.handlebars.loadTemplates([
    `modules/${handsModule.id}/templates/container.hbs`,
    `modules/${handsModule.id}/templates/hand.hbs`
  ]);

  ui.cardHands = new CardHandsList();
});

Hooks.on('ready', async function () {
  if (game.ready) {
    await ui.cardHands.render({ force: true });
  }

  // Migrate favorites flag to pinned flag.
  const favoritedHands = game.user.getFlag(handsModule.id, 'favorite-hands');

  if (favoritedHands?.length) {
    await game.user.setFlag(handsModule.id, 'pinned-hands', favoritedHands);
    await game.user.unsetFlag(handsModule.id, 'favorite-hands');
  }
});

Hooks.on('renderCardHandsList', (cardHandsList, element, context, options) => {
  // Set up observer for knowing when the last card image has been rendered.
  const handsObserver = new ResizeObserver(entries => {
    if (entries.toReversed()[0].contentRect.width > 0) {
      // Restore prior scroll positions
      cardHandsList._restoreScrollXPositions();

      for (const handElement of element.querySelectorAll(`.${handsModule.id}-cards-list`)) {
        for (const arrowButton of handElement.parentElement.querySelectorAll(`.horizontal-scroll`)) {
          if (handElement.scrollWidth > handElement.offsetWidth) {
            arrowButton.style.display = 'flex';
          } else {
            arrowButton.style.removeProperty('display');
          }
        }
      }
    }
  });

  for (const cardElement of element.querySelectorAll(`.${handsModule.id}-card`)) {
    handsObserver.observe(cardElement);
  }
});

// Hooks for Card(s) events
for (const hook of ['createCard', 'updateCard', 'deleteCard']) {
  Hooks.on(hook, async (data) => {
    if (data.parent?.type === 'hand' || data.type === 'hand') {
      await ui.cardHands.render({ force: false });
    }
  });
}
