# Card Hands List

![Screenshot of Card Hands List showing the UI and context menu](https://raw.githubusercontent.com/kristianserrano/card-hands-list/main/assets/images/card-hands-ui.webp)

Card Hands List is a system-agnostic module for Foundry VTT that provides quick access to Card Hands the user owns. The module adds a collapsible list of Card Hands placed above the Players List, blending in with the core Foundry VTT UI.

## Features

- Automatic population of all hands the user owns.
- Settings:
  - Include Card Hands with Observer-level ownership.
  - Use explicit user ownership levels preventing viewability based on user role instead (i.e., a GM won't see every hand by default).
- Hand Buttons:
  - Pin a Card Hand to always display it when the Card Hands List UI is collapsed.
  - Directly draw Cards to the respective Card Hand.
  - Favorite a hand when using the Savage Worlds Adventure Edition system to configure it with the keyboard shortcut <kbd>C</kbd>.
- Hand/Card Actions App: Clicking on a Hand or Card will open it in the Card Actions App which allows you to see the current face as well as perform a collection of common actions. Developers can add or remove actions in the `renderCardActionsSheet` hook event in which they are stored in `options.buttonActions`. These actions use the same identical structure as Foundry VTT's [ContextMenuEntry](https://foundryvtt.com/api/interfaces/client.ContextMenuEntry.html). Example:

```js
Hooks.on('renderCardActionsSheet', (sheet, html) => {
  if (sheet.document.documentName === 'Card') {
    const buttonActions = sheet.options.buttonActions;
    const buttonsToRemove = ['Return to Deck', 'Discard']
    const removeThese = buttonActions.filter(a => buttonsToRemove.includes(a.name));
    const newButton = {
      name: 'Log Me',
      icon: '<i class="fas fa-terminal"></i>',
      condition: true,
      callback: async el => {
        const card = await fromUuid(el[0].dataset.uuid);
        console.log(card);
      }
    };

    if (!buttonActions.some(a => a.name === newButton.name)){
      buttonActions.push(newButton);
      sheet.render();
    } else if (removeThese.length) {
      for (const button of removeThese) {
        buttonActions.splice(buttonActions.indexOf(button), 1);
      }
      sheet.render();
    }
  }
});
```

- Drag and drop Cards:
  - From Card Hand to Card Hand in the Card Hands List.
  - Between a Cards sheet and a Hand in the list.
  - To a scene, which works really well with [Complete Card Management](https://foundryvtt.com/packages/complete-card-management) by [MetaMorphic Digital Studio](https://metamorphic-digital.com/).
