# Card Hands List

## v1.10.3

- Minor CSS adjustments for context menu and height of cards.

## v1.10.2

- Overhauls Minimal UI support with new setting to select display behavior modes (autohide and always show).

## v1.10.1

- Fixes heights in both collapsed and expanded states.

## v1.10.0

- Adds Hand menu option for setting default deck to draw from and draw method.
- Changes "Flip All" to set all cards in the hand to the same face up/down state.

## v1.9.5

- Changes wrapper height to tightly fit 3 hands without scrolling.
- Fixes width when docked in camera dock.
- Fixes borders and shadows for non-rectangular cards.
- Removes forced aspect ratio.

## v1.9.4

- Adds a menu to each hand for Hand actions.
- Changes collapsed max-height to view one Hand at a time and expanded to three at a time.
- Adds scroll snap while scrolling through the list of Hands.
- Other minor UI improvements.

## v1.9.3

- Fixes display bug when Minimal UI is active but camera dock is present in left or right.
- Adds support for Minimal UI's display toggle (clicking the logo).

## v1.9.2

- Limits favorite option to owned Hands.

## v1.9.1

- Minor bug fix.

## v1.9.0

- Adds support for setting, changing, and unsetting the Favorite Cards Hand in the Savage Worlds Adventure Edition (SWADE) system, which allows you to press `h` to open your favorite hand.

## v1.8.4

- Fixes error when Minimal UI _isn't_ active.

## v1.8.3

- Fixes styles for all Minimal UI player list behavior options.

## v1.8.2

- Adds support for Minimal UI.

## v1.8.1

- Minor CSS bug fixes and tweaks.

## v1.8.0

- Adds context menu to hands (right-click on hand name).
  - Configure Ownership
  - Shuffle
  - Flip all cards
  - Pass (pass cards to another pile)
  - Reset (sends all cards in hand back to original decks)
- Fixes previous version number in this changelog.
- Replaces solid cards icon with regular version.

## v1.7.0

- Favorited Hands are now pinned to the top of the expanded list.
- Favorites icon changed from star to pin.
- Removes recommendation of Monarch. (Foundry VTT's UX for this could use some improvement.)

## v1.6.1

- Updates this changelog to include the previous version's changes. (That's so meta.)

## v1.6.0

- Foundry VTT v10 is no longer supported.
- Lists owned Card Hands at top followed by observed hands.
- Uses state data for Card Documents (supported in v11 only) to for name, img, and text values.
- Changes to Card interactions:
  - Left-click now opens the card image in an Image Popout.
  - Right-click is now used to flip an individual card.

## v1.5.1

- Updates image used for Setup Screen Module Page and Compendium Folder banner.

## v1.5.0

- Rewrites module as a Foundry VTT Application.
- Adds Flip All Cards button for each Hand.
- Adds Shuffle Hand button for each Hand.
- Removes clicking on Cards to open the Hand.
- Changes right-click to flip a Card to left-click.

## v1.4.10

- Fixes mutliple UIs added when multiple Card Documents are updated at the same time.

## v1.4.9

- Fixes double insertion of UI in Foundry VTT v11 when the camera view is docked to the left or right.

## v1.4.8

- Adds thumbnail image for setup screen.

## v1.4.7

- Fixes UI getting added twice on renderCameraViews hook.

## v1.4.6

- Adds more conditionals for card tool tips to allow an Owner to see a value of a card while it's face down, but prevents Observers from seeing the value.

## v1.4.5

- Fixes bad manifest URL.

## v1.4.4

- Migrates repo  and releases to GitHub.

## v1.4.3

- Adds template conditionals for displaying Card face and back content in the tooltip.

## v1.4.2

- Just some minor tweaks, simplifications, and optimizations behind the scenes.

## v1.4.1

- Fixes Card Hands List UI not being re-added to the camera dock if it's position was changed from top or bottom to left or right.

## v1.4.0

- Changes the color of the Card Hand name if the user owns it. The color changes for a GM Card Hand only if the Card Hand doesn't have player owners.

## v1.3.4

- Formal release

## v1.3.3

- Adds support for dragging and dropping to and from Cards sheets.

## v1.3.2

- Refreshes Cards Hands List when Card Hands are created or deleted.

## v1.3.1

Fixes issue with Alien RPG's override of the core `concat` Handlebars helper breaking the translations in the template.

## v1.3.0

- Cards are now draggable for sorting and passing in the hands list
- Hidden state is reset on client reload
- Draw Card button added to each hand
- Hands now respect card sort order

## v1.2.0

- Adds card draw button to hands.
- A ton of cleanup and optimizations behind the scenes.

## v1.1.2

- Fixes favorites flag.

## v1.1.1

- Removes SWADE system requirement.

## v1.1.0

- Adds support for multiple favorites.
- Adds world setting to include hands with Observer-level ownership.
- Makes hands list scrollable to restrict height.

## v1.0.0

- Initial release
