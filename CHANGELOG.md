# Card Hands List

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
