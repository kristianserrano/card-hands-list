import { handsModule } from "./card-hands-list.js";
import { CardHandContextMenu } from "./CardHandContextMenu.mjs";
/**
 * The UI element which displays the list of Hands available to the User.
 * @extends {Application}
 */
export class CardHandsList extends Application {
    constructor(options) {
        super(options);
        this.appid = handsModule.id;

        // Toggle for whether to show all Cards Hands or hide them
        this._showAllHands = false;
        // Current inner Card Hands List scroll position
        this._scrollPosition = 0;
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: handsModule.id,
            template: `modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`,
            popOut: false
        });
    }

    /** @override */
    async _render(force = false, options = {}) {
        await super._render(force, options);

        // If both exist, move the Card Hands List element to be placed above the Player List element
        if (this.rendered) {
            ui.players.element[0]?.before(this.element[0]);
        }

        // Set the wrapper's scroll position to the previous position.
        document.querySelector(`#${handsModule.id}-hands-wrapper`)?.scrollTo({ top: this._scrollPosition });

        if (game.modules.get('minimal-ui')?.active) {
            const foundryLogo = document.querySelector('#logo');
            foundryLogo.addEventListener('click', changeCardHandsListDisplay, 'once');
        }
    }

    /** @override */
    getData(options = {}) {
        // Process hand data by adding extra characteristics
        const ownershipLevel = game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER';
        const hands = game?.cards?.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel)).sort((a, b) => {
            if (a.ownership[game.userId] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return 1;
            return -1;
        });
        // If it's available, set the scroll position in case it was rendered after starring a hand.
        this._scrollPosition = document.querySelector(`#${handsModule.id}-hands-wrapper`)?.scrollTop ?? 0;
        // Return the data for rendering
        const data = {
            hands,
            collapsed: !this._showAllHands,
            isGM: game?.user?.isGM,
            moduleId: handsModule.id,
            translationPrefix: handsModule.translationPrefix,
            pinned: game?.user?.getFlag(handsModule.id, 'pinned-hands'),
            system: game.system.id,
            favorite: '',
        };

        if (game.system.id === 'swade') {
            data.favorite = game?.user?.getFlag('swade', 'favoriteCardsDoc');
        }

        data.minimalUi = { active: game.modules.get('minimal-ui')?.active };

        if (data.minimalUi.active) {
            data.minimalUi.listBehavior = game.settings.get(handsModule.id, 'minimal-ui-behavior');
        }

        return data;
    }

    /** @override */
    activateListeners(html) {
        // Toggle collapsed state
        html.find(`.${handsModule.id}-title`).click(this._onToggleAllHands.bind(this));
        // Scroll horizontally through cards in hand
        html.find('.horizontal-scroll').click(this._onHorizontalScroll.bind(this));
        // Open the Cards Hand
        html.find(`.${handsModule.id}-name a`)?.click(this._onOpenCardsHand.bind(this));
        // Favorite the Cards Hand
        html.find(`.${handsModule.id}-favorite a`)?.click(this._onFavoriteHand.bind(this));
        // Pin the Cards Hand
        html.find(`.${handsModule.id}-pin a`)?.click(this._onPinHand.bind(this));
        // Draw a Card
        html.find(`.${handsModule.id}-draw a`)?.click(this._onDrawCard.bind(this));
        // Open the Card Card
        html.find(`.${handsModule.id}-card`)?.click(this._onOpenCard.bind(this));
        // Get a collection of card images
        const cardImages = html.find(`.${handsModule.id}-card-image`);
        // Flip a Card
        cardImages?.on('contextmenu', this._onFlipCard.bind(this));
        // Drag a Card
        cardImages?.on('dragstart', this._onDragCard.bind(this));
        // Drop a Card
        html.find(`.${handsModule.id}-cards`)?.on('drop', this._onDropCard.bind(this));
        // Context menu
        const contextOptions = this._getHandContextOptions();
        // Pull up menu options from link
        new CardHandContextMenu(html, `.${handsModule.id}-context-menu-link`, contextOptions, { eventName: 'click' });
    }

    // Toggle display of the Card Hands hud setting for whether or not to display all Card Hands available
    _onToggleAllHands(e) {
        // Prevent multiple executions
        e.preventDefault();
        // Toggle the collapsed setting boolean
        this._showAllHands = !this._showAllHands;
        // Rerender the container
        this.render(true);
    }

    _onHorizontalScroll(e) {
        const arrow = e.currentTarget;
        const card = arrow.parentElement.querySelector(`.${handsModule.id}-card`);
        const hand = card.parentElement;
        const cardWidth = card.offsetWidth;
        const handWidth = hand.offsetWidth;

        if (arrow.classList.contains('--right')) {
            //hand.scrollLeft += cardWidth * (handWidth / (cardWidth * 2));
            hand.scrollLeft += handWidth - cardWidth;
        } else if (arrow.classList.contains('--left')) {
            //hand.scrollLeft -= cardWidth * (handWidth / (cardWidth * 2));
            hand.scrollLeft -= handWidth - cardWidth;
        }
    }

    // Open the Cards Hand
    async _onOpenCardsHand(e) {
        // Prevent multiple executions
        e.preventDefault();
        const hand = game.cards.get(e.target.closest(`.${handsModule.id}-hand`)?.dataset.handId);
        await hand?.sheet.render(true);
    }

    // Open the Card
    async _onOpenCard(e) {
        // Prevent multiple executions
        e.preventDefault();
        const card = await fromUuid(e.target.dataset.uuid);
        // Render the image popout
        if (card) {
            const imgPopout = new ImagePopout(card.img, {
                title: card.name,
                uuid: card.uuid
            });
            await imgPopout.render(true);
        }
    }

    // Favorite Cards Hand
    async _onFavoriteHand(e) {
        // Prevent multiple executions
        e.stopImmediatePropagation();
        const favoriteId = e.target.parentElement.parentElement.dataset.handId;
        const currentFavorite = game.user.getFlag('swade', 'favoriteCardsDoc');

        if (favoriteId === currentFavorite) {
            await game.user.unsetFlag('swade', 'favoriteCardsDoc');
        } else {
            // Favorite the Hand based on its ID.
            await game.user.setFlag('swade', 'favoriteCardsDoc', e.target.parentElement.parentElement.dataset.handId);
        }
    }

    // Pin Cards Hand
    async _onPinHand(e) {
        // Prevent multiple executions
        e.stopImmediatePropagation();
        const handId = e.target.parentElement.parentElement.dataset.handId;
        // Pin the Hand based on its ID.
        // Set the user flag key
        const flagKey = 'pinned-hands';
        // Get the current list of favorited Card Hand IDs from the user flag
        let pinned = game?.user?.getFlag(handsModule.id, flagKey);

        // A quick catch for an empty pinned flag
        if (!pinned) {
            pinned = [];
        }

        // If the list of favorites includes this Card Hand already...
        if (pinned.includes(handId)) {
            // Unfavorite it by remove the Card Hand from the array and updating the user flag
            pinned.splice(pinned.indexOf(handId), 1);
        } else {
            // Otherwise, add it to the list and update the user flag
            pinned.push(handId);
        }

        await game?.user?.setFlag(handsModule.id, flagKey, pinned);
        this.render(false)
    }

    // Draw a Card from a Cards Stack
    async _onDrawCard(e) {
        e.stopImmediatePropagation();
        const hand = game.cards.get(e.target.parentElement.parentElement.dataset.handId);
        const defaultDeck = hand.getFlag(handsModule.id, 'default-deck');
        const defaultMode = hand.getFlag(handsModule.id, 'default-draw-mode');
        let cardsDrawn = undefined;
        if (defaultDeck && defaultMode) {
            const deck = game.cards.get(defaultDeck);
            cardsDrawn = await hand.draw(deck, 1, {how: Number(defaultMode)});
        } else {
            cardsDrawn = await hand.drawDialog();
        }
    };

    // Flip a Card in a Cards Hand
    async _onFlipCard(e) {
        const card = await fromUuid(e.target.dataset.uuid);
        await card.flip();
    }

    // Drag a Card in a Cards Hand
    async _onDragCard(e) {
        const jsonData = JSON.stringify({ type: "Card", uuid: e.target.dataset.uuid });
        e.originalEvent.dataTransfer.setData('text/plain', jsonData);
    }

    // Drag a Card in a Cards Hand
    async _onDropCard(e) {
        // Prevent multiple executions
        //e.stopImmediatePropagation();
        // Get the data transfer text value
        const textDataTransfer = e.originalEvent ? e.originalEvent.dataTransfer.getData('text/plain') : e.dataTransfer.getData('text/plain');
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
    }

    // Return the default context options available for the Card Hands List application
    _getHandContextOptions() {
        return [
            {
                name: game.i18n.localize('OWNERSHIP.Configure'),
                icon: '<i class="fas fa-lock"></i>',
                condition: el => {
                    // Return whether or not the user is a GM.
                    return game.user.isGM;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    new DocumentOwnershipConfig(hand).render(true);
                }
            },
            {
                name: game.i18n.localize("CARDHANDSLIST.Defaults"),
                icon: '<i class="fas fa-gears"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM
                    return game?.user.isGM && !hand?.getFlag(handsModule.id, 'default-deck');
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    const decks = game?.cards?.filter(c => c.type === 'deck');
                    const deckOptions = [];

                    for (const deck of decks) {
                        deckOptions.push(
                            `<option value="${deck.id}">${deck.name}</option>`
                        );
                    }

                    const deckSelect = `
                        <div class="form-group">
                            <label for="deck-select">${game.i18n.localize('CARDS.CardsDeck')}</label>
                            <div class="form-fields">
                                <select id="deck-select">${deckOptions.join('')}}</select>
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

                    const modeOptions = [];

                    for (const drawMode of drawModes) {
                        modeOptions.push(
                            `<option value="${drawMode.value}">${drawMode.label}</option>`
                        );
                    }

                    const modeSelect = `
                        <div class="form-group">
                            <label for="draw-mode" >${game.i18n.localize('CARDS.DrawMode')}</label>
                            <div class="form-fields">
                                <select id="draw-mode">${modeOptions.join('')}</select>
                            </div>
                        </div>
                    `;
                    const content = `
                        <p>${game.i18n.format('CARDHANDSLIST.DefaultsMessage', {name: hand.name})}</p>
                        <form class="cards-defaults">
                            ${deckSelect + modeSelect}
                        </form>
                    `;
                    new Dialog({
                        title: game.i18n.localize("CARDHANDSLIST.Defaults"),
                        content: content,
                        buttons: {
                            save: {
                                icon: '<i class="fas fa-save"></i>',
                                label: game.i18n.localize('Save'),
                                callback: async (html) => {
                                    await hand.setFlag(handsModule.id, 'default-deck', html.find('#deck-select').val());
                                    await hand.setFlag(handsModule.id, 'default-draw-mode', html.find('#draw-mode').val());
                                }
                            }
                        },
                        default: "save",
                    }).render(true);
                }
            },
            {
                name: game.i18n.localize("CARDHANDSLIST.UnsetDefaults"),
                icon: '<i class="fas fa-gears"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM
                    return game?.user.isGM && hand?.getFlag(handsModule.id, 'default-deck');
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    await hand.unsetFlag(handsModule.id, 'default-deck');
                    await hand.unsetFlag(handsModule.id, 'default-draw-mode');
                }
            },
            {
                name: game.i18n.localize("CARDHANDSLIST.FlipAll"),
                icon: '<i class="fas fa-rotate"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    const someFaceUp = hand.cards.some(c => c.face !== null);
                    const updates = hand.cards.map(c => {
                        return {
                            _id: c.id,
                            face: someFaceUp ? null : 0
                        }
                    });

                    await Card.updateDocuments(updates, { parent: hand });
                }
            },
            {
                name: game.i18n.localize("CARDS.Shuffle"),
                icon: '<i class="fas fa-shuffle"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    await hand?.shuffle();
                }
            },
            {
                name: game.i18n.localize("CARDS.Pass"),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    await hand?.passDialog();
                }
            },
            {
                name: game.i18n.localize("CARDS.Reset"),
                icon: '<i class="fas fa-undo"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.handId);
                    await hand?.resetDialog();
                }
            },
        ];
    }
};

function changeCardHandsListDisplay() {
    const cardHandsListElement = document.querySelector('#card-hands-list');

    if (cardHandsListElement) {
        cardHandsListElement.style.display = cardHandsListElement.style.display === 'none' ? 'revert' : 'none';
    }
};