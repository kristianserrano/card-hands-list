
import { CardHandsList } from './apps/CardHandsList.mjs';
import { CardActionsSheet } from './apps/CardActionsSheet.mjs';
import { HandActionsSheet } from './apps/HandActionsSheet.mjs';

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
    `modules/${handsModule.id}/templates/card-actions-sheet.hbs`,
    `modules/${handsModule.id}/templates/hand-actions-sheet.hbs`,
    `modules/${handsModule.id}/templates/hand.hbs`
  ]);

  // Register the card actions sheet
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Card, "card-hands-list", CardActionsSheet, {
    label: 'Card Hands List Card Actions',
    makeDefault: false
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Cards, "card-hands-list", HandActionsSheet, {
    label: 'Card Hands List Hand Actions',
    makeDefault: false
  });
  ui.cardHands = new CardHandsList();

  CONFIG.CardHandsList = {
    menuItems: {
      cardContextOptions: [
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.OpenCard`),
          icon: '<i class="fas fa-card-spade"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card?.isOwner;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            await card.sheet.render(true);
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.PlayAdventureCard`),
          icon: '<i class="far fa-circle-play"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card.isOwner && game.system.id === 'swade' && card.origin._stats.compendiumSource?.startsWith('Compendium.adventure-deck') && game.modules.get('adventure-deck')?.active;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            const content = await renderTemplate("modules/adventure-deck/templates/adventurecard-chatcard.hbs", card);
            ChatMessage.create({
              user: game.user.id,
              type: CONST.CHAT_MESSAGE_STYLES.OTHER,
              content: content,
              sound: game.settings.get("adventure-deck", "toggleSoundOnPlayCard") ? "systems/swade/assets/card-flip.wav" : ""
            });
            const discardPile = await game.cards.getName(game.settings.get("adventure-deck", "dumpPileName"));

            if (discardPile) {
              card?.parent?.pass(discardPile, [card.id], { chatNotification: false });
            }
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.Flip`),
          icon: '<i class="fas fa-rotate"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card?.isOwner;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            await card.flip();
          }
        },
        {
          name: game.i18n.localize('CardHandsList.Pass'),
          icon: '<i class="fas fa-share-square"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card?.isOwner;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            await card.parent.playDialog(card);
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.Discard`),
          icon: '<i class="fas fa-cards-blank fa-flip-horizontal"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card?.isOwner;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            const defaultDiscardPile = game.cards.get(card.parent.getFlag(handsModule.id, 'default-discard-pile'));

            if (defaultDiscardPile) {
              await card.pass(defaultDiscardPile);
            } else {
              await card.parent.playDialog(card);
            }
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.ReturnToDeck`),
          icon: '<i class="fas fa-undo"></i>',
          condition: el => {
            const card = fromUuidSync(el.dataset.uuid);
            return card?.isOwner;
          },
          callback: async el => {
            const card = fromUuidSync(el.dataset.uuid);
            await card.recall();
          }
        },
      ],
      handContextOptions: [
        {
          name: game.i18n.localize('CardHandsList.OpenHand'),
          icon: '<i class="far fa-cards-blank"></i>',
          condition: true,
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            hand.sheet.render(true);
          }
        },
        {
          name: game.i18n.localize('CARDS.Draw'),
          icon: '<i class="far fa-cards"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner;
          },
          callback: async el => {
            const hand = game.cards.get(el[0].dataset.id);
            const defaultDeck = hand.getFlag(handsModule.id, 'default-deck');
            const defaultMode = hand.getFlag(handsModule.id, 'default-draw-mode');
            const faceDown = hand.getFlag(handsModule.id, 'face-down');

            if (defaultDeck) {
              const deck = game.cards.get(defaultDeck);
              const cardsInHand = hand.cards.contents;
              const sort = cardsInHand.length ? cardsInHand.reverse()[0].sort + 10 : 0;
              await hand.draw(deck, 1, {
                how: Number(defaultMode),
                updateData: faceDown ? {
                  face: null,
                  sort,
                } : {
                  sort,
                },
              });
            } else {
              await hand.drawDialog();
            }
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.FlipAll`),
          icon: '<i class="fas fa-rotate"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner;
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            const updates = hand.cards.map(c => {
              return {
                _id: c.id,
                face: c.face === null ? 0 : null
              };
            });
            await hand.updateEmbeddedDocuments('Card', updates);
          }
        },
        {
          name: game.i18n.localize("CARDS.ACTIONS.Shuffle"),
          icon: '<i class="fas fa-shuffle"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner && hand.cards.size;
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            await hand?.shuffle();
          }
        },
        {
          name: game.i18n.localize("CARDS.ACTIONS.Pass"),
          icon: '<i class="fas fa-share-square"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner && hand.cards.size;
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            await hand?.passDialog();
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.DiscardAll`),
          icon: '<i class="fas fa-cards-blank fa-flip-horizontal"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner && hand.cards.size && game.cards.get(hand?.getFlag(handsModule.id, 'default-discard-pile'));
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            const defaultDiscardPile = game.cards.get(hand?.getFlag(handsModule.id, 'default-discard-pile'));

            if (defaultDiscardPile) {
              const handIds = hand.cards.map(c => c._id);
              await hand.pass(defaultDiscardPile, handIds);
            } else {
              await hand.playDialog(card);
            }
          }
        },
        {
          name: game.i18n.localize("CARDS.ACTIONS.Reset"),
          icon: '<i class="fas fa-undo"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if GM or if user is owner of hand
            return hand?.isOwner && hand.cards.size;
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            await hand?.resetDialog();
          }
        },
        {
          name: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`),
          icon: '<i class="fas fa-gears"></i>',
          condition: el => {
            const hand = game.cards.get(el.dataset.id);
            // Check if owner
            return hand?.isOwner;
          },
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            const decks = game?.cards?.filter(c => c.type === 'deck');
            const piles = game?.cards?.filter(c => c.type === 'pile');
            const deckOptions = [
              `<option value="none" ${!hand?.getFlag(handsModule.id, 'default-deck') ? 'selected' : ''}>${game.i18n.localize(`${handsModule.translationPrefix}.None`)}</option>`
            ];
            const pileOptions = [
              `<option value="none" ${!hand?.getFlag(handsModule.id, 'default-discard-pile') ? 'selected' : ''}>${game.i18n.localize(`${handsModule.translationPrefix}.None`)}</option>`
            ];
            const drawFaceDown = hand.getFlag(handsModule.id, 'face-down');

            for (const deck of decks) {
              deckOptions.push(
                `<option value="${deck.id}" ${deck.id === hand?.getFlag(handsModule.id, 'default-deck') ? 'selected' : ''}>${deck.name}</option>`
              );
            }

            for (const pile of piles) {
              pileOptions.push(
                `<option value="${pile.id}" ${pile.id === hand?.getFlag(handsModule.id, 'default-discard-pile') ? 'selected' : ''}>${pile.name}</option>`
              );
            }

            const deckSelect = `
                        <div class="form-group">
                            <label for="deck-select">${game.i18n.localize(`${handsModule.translationPrefix}.DefaultDrawDeck`)}</label>
                            <div class="form-fields">
                                <select id="deck-select">${deckOptions.join('')}}</select>
                            </div>
                        </div>
                    `;
            const pileSelect = `
                        <div class="form-group">
                            <label for="pile-select">${game.i18n.localize(`${handsModule.translationPrefix}.DefaultDiscardPile`)}</label>
                            <div class="form-fields">
                                <select id="pile-select">${pileOptions.join('')}}</select>
                            </div>
                        </div>
                    `;

            const drawModes = [
              {
                label: game.i18n.localize('CARDS.DrawModeRandom'),
                value: CONST.CARD_DRAW_MODES.RANDOM,
              },
              {
                label: game.i18n.localize('CARDS.DrawModeTop'),
                value: CONST.CARD_DRAW_MODES.TOP,
              },
              {
                label: game.i18n.localize('CARDS.DrawModeBottom'),
                value: CONST.CARD_DRAW_MODES.BOTTOM,
              },
            ];

            let modeOptions = '';

            for (const drawMode of drawModes) {
              modeOptions += `<option value="${drawMode.value}">${drawMode.label}</option>`;
            }

            const modeSelect = `
                        <div class="form-group">
                            <label for="draw-mode" >${game.i18n.localize('CARDS.DrawMode')}</label>
                            <div class="form-fields">
                                <select id="draw-mode">${modeOptions}</select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="face-down">${game.i18n.localize('CARDS.Facedown')}</label>
                            <div class="form-fields">
                                <input type="checkbox" id="face-down" name="face-down" ${drawFaceDown ? 'checked' : ''}>
                            </div>
                        </div>
                     `;
            const content = `
                        <p>${game.i18n.format(`${handsModule.translationPrefix}.DefaultsMessage`, { name: hand.name })}</p>
                        <form class="cards-defaults">
                            ${deckSelect}
                            ${modeSelect}
                            ${pileSelect}
                        </form>
                    `;

            new foundry.applications.api.DialogV2({
              window: {
                title: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`),
              },
              content,
              buttons: [{
                action: 'save',
                icon: '<i class="fas fa-save"></i>',
                label: game.i18n.localize('Save'),
                default: true,
                callback: async (event) => {
                  const deckId = event.target.closest('.dialog-form').querySelector('#deck-select').value;
                  const pileId = event.target.closest('.dialog-form').querySelector('#pile-select').value;
                  const mode = Number(event.target.closest('.dialog-form').querySelector('#draw-mode').value);
                  const faceDown = event.target.closest('.dialog-form').querySelector('#face-down').checked;

                  if (deckId === 'none' && pileId === 'none') {
                    await hand.unsetFlag(handsModule.id, 'default-deck');
                    await hand.unsetFlag(handsModule.id, 'default-draw-mode');
                    await hand.unsetFlag(handsModule.id, 'face-down');
                    await hand.unsetFlag(handsModule.id, 'default-discard-pile');
                  } else {
                    await hand.setFlag(handsModule.id, 'default-deck', deckId);
                    await hand.setFlag(handsModule.id, 'default-draw-mode', mode);
                    await hand.setFlag(handsModule.id, 'face-down', faceDown);
                    await hand.setFlag(handsModule.id, 'default-discard-pile', pileId);
                  }
                }
              }],
            }).render({ force: true });
          }
        },
        {
          name: game.i18n.localize('OWNERSHIP.Configure'),
          icon: '<i class="fas fa-lock"></i>',
          condition: game.user.isGM,
          callback: async el => {
            const hand = game.cards.get(el.dataset.id);
            new foundry.applications.apps.DocumentOwnershipConfig(hand).render(true);
          }
        },
      ]
    }
  };
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
for (const hook of ['createCard', 'updateCard', 'deleteCard', 'createCards', 'updateCards', 'deleteCards']) {
  Hooks.on(hook, async (data) => {
    if (data.parent?.type === 'hand' || data.type === 'hand') {
      ui.cardHands._saveScrollXPositions(ui.cardHands.element);
      await ui.cardHands.render(false);

      const handActionSheets = Array.from(foundry.applications.instances.values()).filter(h => h.id.includes('HandActionsSheet'));

      for (const handActionSheet of handActionSheets) {
        await handActionSheet.render({ part: 'hand', force: true });
      }
    }
  });
}

Hooks.on('renderHandActionsSheet', (sheet, html) => {
  // If Complete Card Management (CCM) is installed and active, add the scry button.
  if (game.modules.get('complete-card-management')?.active) {
    // If the sheet did not have options passed in already, get the actions from CONFIG.
    const buttonActions = sheet.options.buttonActions ?? CONFIG.CardHandsList.menuItems.handContextOptions;
    // Create a CCM Scry Context Menu Item
    const newButton = {
      name: game.i18n.localize('CardHandsList.ScryDeck'),
      icon: "<i class='fa-solid fa-eye'></i>",
      condition: (el) => {
        // If the hand has a default deck configured, display the scry button
        const hand = game.cards.get(el[0].dataset.id);
        return game.cards.get(hand.getFlag(handsModule.id, 'default-deck'));
      },
      callback: async (el) => {
        const hand = game.cards.get(el[0].dataset.id);
        const deck = game.cards.get(hand.getFlag(handsModule.id, 'default-deck'));
        // Call CCM's scry function.
        ccm.api.scry(deck);
      }
    };

    // If the new button hasn't already been added during a previous render, add it.
    if (!buttonActions.some(a => a.name === newButton.name)) {
      buttonActions.splice(2, 0, newButton);
      sheet.render();
    }
  }
});
