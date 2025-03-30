# Card Hands List

![Screenshot of Card Hands List showing the UI and context menu](https://immaterialplane.s3.amazonaws.com/foundryvtt/card-hands-list-expanded.png)

Card Hands List is a system-agnostic module for Foundry VTT that provides quick access to Card Hands the user owns. The module adds a collapsible list of Card Hands placed above the Players List, blending in with the core Foundry VTT UI.

## Features

- Automatic population of all hands the user owns.
- Hand Buttons:
  - Pin a Card Hand to always display it when the Card Hands List UI is collapsed.
  - Directly draw Cards to the respective Card Hand.
  - Favorite a hand when using the Savage Worlds Adventure Edition system to configure it with the keyboard shortcut <kbd>H</kbd>.
- Drag and drop Cards:
  - From Card Hand to Card Hand in the Card Hands List.
  - Between a Cards sheet and a Hand in the list.
  - To a scene, which works really well with [Complete Card Management](https://foundryvtt.com/packages/complete-card-management) by [MetaMorphic Digital Studio](https://metamorphic-digital.com/).
- Hand/Card Actions App: Clicking on a Hand or Card will open it in the Card Actions App which allows you to see the current face as well as perform a collection of common actions. Developers can either add or remove actions `CONFIG.CardHandsList.menuItems.cardContextOptions` or `CONFIG.CardHandsList.menuItems.handContextOptions` in the `renderCardActionsSheet` or `renderHandActionsSheet` hook events or modify `options.buttonActions` in those same hook events. For consistency these actions use the same identical structure as Foundry VTT's [ContextMenuEntry](https://foundryvtt.com/api/interfaces/client.ContextMenuEntry.html), which means they could also be referenced for an actual ContextMenu use case. Example:

```js
Hooks.on('renderHandActionsSheet', (sheet, html) => {
  // If Complete Card Management (CCM) is installed and active, add the scry button.
  if (game.modules.get('complete-card-management')?.active) {
    // Get the button actions from options if available, otherwise get the defaults.
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
```

- Settings:
  - Include Card Hands with Observer-level ownership.
  - Use explicit user ownership levels preventing viewability based on user role instead (i.e., a GM won't see every hand by default).
