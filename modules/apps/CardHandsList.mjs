import { handsModule } from "../card-hands-list.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class CardHandsList extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'card-hands-list',
        classes: ['faded-ui', 'flexcol'],
        tag: 'aside',
        window: {
            frame: false,
            positioned: false,
        },
        actions: {
            expand: CardHandsList.#onExpand,
            openHand: CardHandsList.#onOpenHand,
            favoriteHand: CardHandsList.#onFavoriteHand,
            pinHand: CardHandsList.#onPinHand,
            drawCard: CardHandsList.#onDrawCard,
            openCard: CardHandsList.#onOpenCard,
            scrollArrow: CardHandsList.#onScrollArrow,
            getHandContextOptions: CardHandsList.#onGetHandContextOptions,

        },
    };

    static PARTS = {
        cardHands: {
            root: true,
            template: "modules/card-hands-list/templates/card-hands-list-container.hbs",
            scrollable: ['#card-hands-observable-hands', '#card-hands-owned-hands', '.card-hands-list-cards-list']
        }
    };

    async _prepareContext(options = {}) {
        // Process hand data by adding extra characteristics
        const permittedOwnershipLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS[game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER'];

        function determineOwnership(hand) {
            // If explicit ownership is enabled, check the user's ownership level or the default level unless set to none.
            if (game.settings.get(handsModule.id, "explicitOwnership")) {
                // If the user has only default permissions, set to -1; otherwise, set to the user's level.
                const userOwnershipLevel = hand.ownership[game.userId] ?? -1;
                const defaultOwnershipLevel = hand.ownership.default;

                // If the user's ownership level is set to None, return false as they should not be able to see the hand.
                if (userOwnershipLevel === CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) return false;
                // If the default ownership level is higher than the user's, use the default level; otherwise, use the user's level since it is explicitly set.
                const higherOwnershipLevel = defaultOwnershipLevel > userOwnershipLevel ? defaultOwnershipLevel : userOwnershipLevel;
                // Return whether the resulting permission level is at or above the permitted level.
                return higherOwnershipLevel >= permittedOwnershipLevel;
            } else {
                // Generically test the user permission. GM's will always have access.
                return hand.testUserPermission(game.user, permittedOwnershipLevel);
            }
        }

        const hands = game?.cards?.filter((c) => c.type === 'hand' && determineOwnership(c));
        hands.sort((a, b) => {
            return a.ownership[game.userId] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        });

        const gmUser = game.users.find((u) => u.role === 4);
        // Get the user's pinned hands
        const pinnedHands = game?.user?.getFlag(handsModule.id, 'pinned-hands');

        for (const hand of hands) {
            if (hand.hasPlayerOwner) {
                const playerOwnerIDs = Object.keys(hand.ownership).filter((k) => k !== 'default' && !game.users.get(k)?.isGM);
                // Check if user is an owner by default or specifically set as owner.
                const userIsOwner = Object.keys(hand.ownership).some((k) => (k === 'default' || k === game.user.id) && hand.ownership[k] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
                // If the user is an owner, set as owner.
                hand.owner = userIsOwner ? game.user : game.users.get(playerOwnerIDs[0]);
            } else {
                // If the hand does not have an owner, set the active GM as the owner. If there is not an active GM, assign the GM user.
                hand.owner = game?.users?.activeGM ?? gmUser;
            }

            // Enrich the cards' texts
            for (const card of hand.cards) {
                for (const face of card.faces) {
                    face.enrichedText = await TextEditor.enrichHTML(face.text);
                }

                card.enrichedDescription = await TextEditor.enrichHTML(card.description);
                card.back.enrichedText = await TextEditor.enrichHTML(card.back.text);
            }

            // Sort the cards by sort values
            hand.sortedCards = hand.cards.contents.sort((a, b) => {
                // Compare the values
                if (a.sort < b.sort) {
                    return -1;
                } else if (a.sort > b.sort) {
                    return 1;
                } else {
                    return 0;
                };
            });
            // Check if this hand is pinned
            hand.isPinned = pinnedHands?.includes(hand.id);
            const favoriteHand = game.system.id === 'swade' ? game?.user?.getFlag('swade', 'favoriteCardsDoc') : null;
            hand.isFavorite = hand.id === favoriteHand;
        }

        // Return the data for rendering
        const context = {
            title: this.title,
            hands,
            ownedHands: CardHandsList._sort(hands.filter(h => h.owner.id === game.user.id), 'name'),
            observableHands: CardHandsList._sort(hands.filter(h => h.ownership[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER || (!h.ownership[game.user.id] && h.ownership.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)), 'name'),
            favoriteHand: hands.find(h => h.isFavorite),
            pinnedHands: CardHandsList._sort(hands.filter(h => h.isPinned && !h.isFavorite), 'name'),
            showObservable: game.settings.get(handsModule.id, "observerLevel"),
            expanded: this.element?.classList.contains('expanded'),
            isGM: game?.user?.role === 4,
            userColor: game?.user?.color,
            moduleId: handsModule.id,
            translationPrefix: handsModule.translationPrefix,
            system: game.system.id,
        };

        context.minimalUi = { active: game.modules.get('minimal-ui')?.active };

        if (context.minimalUi.active) {
            context.minimalUi.listBehavior = game.settings.get(handsModule.id, 'minimal-ui-behavior');
        }

        return context;
    }

    async _onFirstRender(_context, _options) {
        game.cards.apps.push(this);
        // Append app to UI
        ui.players.element.parentElement.insertBefore(this.element, ui.players.element);
    }

    _onRender(context, options) {
        this.element.classList.toggle("expanded", this.expanded);
        // Capture horizontal scroll position
        for (const cardsList of this.element.querySelectorAll(`.${handsModule.id}-cards-list`)) {
            cardsList.addEventListener('wheel', CardHandsList.#onHorizontalScroll.bind(this));
        }

        // Get a collection of card images
        for (const cardImage of this.element.querySelectorAll(`.${handsModule.id}-card-image`)) {
            cardImage.addEventListener('contextmenu', CardHandsList.#onFlipCard.bind(this));
            cardImage.addEventListener('dragstart', CardHandsList.#onDragCard.bind(this));
        }
        // Drop a Card
        for (const cards of this.element.querySelectorAll(`.${handsModule.id}-cards`)) {
            cards.addEventListener('drop', CardHandsList.#onDropCard.bind(this));
        }
    }

    get expanded() {
        return this.element.classList.contains("expanded");
    }

    toggleExpanded(expanded) {
        expanded ??= !this.expanded;
        this.element.classList.toggle("expanded", expanded);
    }

    static #onExpand() {
        this.toggleExpanded();
    }

    collapse() {
        this.toggleExpanded(false);
    }

    expand() {
        this.toggleExpanded(true);
    }

    _saveScrollXPositions() {
        const selectors = this.options.scrollX || [];
        this._scrollXPositions = selectors.reduce((pos, sel) => {
            const el = this.element.querySelectorAll(sel);
            pos[sel] = Array.from(el).map(el => el.scrollLeft);
            return pos;
        }, {});
    }

    _restoreScrollXPositions() {
        const selectors = this.options.scrollX || [];
        const positions = this._scrollXPositions || {};

        for (let sel of selectors) {
            const el = this.element.querySelectorAll(sel);
            el.each((i, el) => el.scrollLeft = positions[sel]?.[i] || 0);
        }
    }

    static #onScrollArrow(event, target) {
        const arrow = target;
        const cardElement = arrow.parentElement.querySelector(`.${handsModule.id}-card`);
        const handElement = cardElement.parentElement;
        let number = handElement.scrollLeft;

        if (arrow.classList.contains('--right')) {
            number += cardElement.offsetWidth;
        } else if (arrow.classList.contains('--left')) {
            number -= cardElement.offsetWidth;
        }

        handElement.scroll({ left: number, behavior: 'smooth' });

        // Store scroll positions
        this._saveScrollXPositions(this.element);
    }

    static #onHorizontalScroll(event) {
        if (event.deltaX !== 0) {
            this._saveScrollXPositions();
        }
    }

    // Open the Cards Hand
    static async #onOpenHand(event, target) {
        // Prevent multiple executions
        event.preventDefault();
        const hand = game.cards.get(target.closest(`.${handsModule.id}-hand`)?.dataset.id);
        await hand?.sheet.render(true);
    }

    // Open the Card
    static async #onOpenCard(event, target) {
        // Prevent multiple executions
        event.preventDefault();
        const card = await fromUuid(target.dataset.uuid);
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
    static async #onFavoriteHand(event, target) {
        // Prevent multiple executions
        event.stopImmediatePropagation();
        const favoriteId = target.parentElement.parentElement.dataset.id;
        const currentFavorite = game.user.getFlag('swade', 'favoriteCardsDoc');

        if (favoriteId === currentFavorite) {
            await game.user.unsetFlag('swade', 'favoriteCardsDoc');
        } else {
            // Favorite the Hand based on its ID.
            await game.user.setFlag('swade', 'favoriteCardsDoc', target.parentElement.parentElement.dataset.id);
        }

        await this.render(false);
    }

    // Pin Cards Hand
    static async #onPinHand(event, target) {
        // Prevent multiple executions
        event.stopImmediatePropagation();
        const handId = target.parentElement.dataset.id;
        // Pin the Hand based on its ID.
        // Set the user flag key
        const flagKey = 'pinned-hands';
        // Get the current list of favorited Card Hand IDs from the user flag
        let pinned = game?.user?.getFlag(handsModule.id, flagKey);

        // A quick catch for an empty pinned flag
        if (!pinned?.length) {
            pinned = [];
        }

        // Get the icon to replace the FA classes
        const icon = target.querySelector('i');

        // If the list of favorites includes this Card Hand already...
        if (pinned.includes(handId)) {
            // Unfavorite it by remove the Card Hand from the array and updating the user flag
            pinned.splice(pinned.indexOf(handId), 1);
            icon.classList.remove('fas');
            icon.classList.add('far');
        } else {
            // Otherwise, add it to the list and update the user flag
            pinned.push(handId);
            icon.classList.remove('far');
            icon.classList.add('fas');
        }

        await game?.user?.setFlag(handsModule.id, flagKey, pinned);
        await this.render(false);
    }

    // Draw a Card from a Cards Stack
    static async #onDrawCard(event, target) {
        event.stopImmediatePropagation();
        const hand = game.cards.get(target.parentElement.parentElement.dataset.id);
        const defaultDeck = hand.getFlag(handsModule.id, 'default-deck');
        const defaultMode = hand.getFlag(handsModule.id, 'default-draw-mode');
        let cardsDrawn = null;

        if (defaultDeck && defaultMode) {
            const deck = game.cards.get(defaultDeck);
            cardsDrawn = await hand.draw(deck, 1, { how: Number(defaultMode) });
        } else {
            cardsDrawn = await hand.drawDialog();
        }
    };

    // Flip a Card in a Cards Hand
    static async #onFlipCard(event) {
        const card = await fromUuid(event.target.dataset.uuid);

        if (card.isOwner) {
            await card.flip();
        } else {
            ui.notifications.error(game.i18n.localize(`${handsModule.translationPrefix}.FlipWarning`));
        }
    }

    // Drag a Card in a Cards Hand
    static async #onDragCard(event) {
        const jsonData = JSON.stringify({ type: "Card", uuid: event.target.dataset.uuid });
        event.dataTransfer.setData('text/plain', jsonData);
    }

    // Drag a Card in a Cards Hand
    static async #onDropCard(event) {
        // Get the data transfer text value
        const textDataTransfer = event.originalEvent ? event.originalEvent.dataTransfer.getData('text/plain') : event.dataTransfer.getData('text/plain');

        if (textDataTransfer) {
            // If there's a value, parse it
            const parsedDataTransfer = JSON.parse(textDataTransfer);

            if (parsedDataTransfer?.type === 'Card') {
                // If there is parsed data, get the document from the UUI
                const cardDragged = await fromUuid(parsedDataTransfer.uuid);

                if (cardDragged) {
                    // If there's an actual document
                    const dropTarget = await fromUuid(event.target.dataset.uuid);
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
    static #onGetHandContextOptions(event, target) {
        const options = [
            {
                name: game.i18n.localize('OWNERSHIP.Configure'),
                icon: '<i class="fas fa-lock"></i>',
                condition: el => {
                    // Return whether or not the user is a GM.
                    return game.user.isGM;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    new foundry.applications.apps.DocumentOwnershipConfig({ document: hand }).render({ force: true });
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`),
                icon: '<i class="fas fa-gears"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    // Check if owner
                    return hand.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    const decks = game?.cards?.filter(c => c.type === 'deck');
                    const deckOptions = [
                        `<option value="none" ${!hand?.getFlag(handsModule.id, 'default-deck') ? 'selected' : ''}>${game.i18n.localize(`${handsModule.translationPrefix}.None`)}</option>`
                    ];

                    for (const deck of decks) {
                        deckOptions.push(
                            `<option value="${deck.id}" ${deck.id === hand?.getFlag(handsModule.id, 'default-deck') ? 'selected' : ''}>${deck.name}</option>`
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
                        <p>${game.i18n.format(`${handsModule.translationPrefix}.DefaultsMessage`, { name: hand.name })}</p>
                        <form class="cards-defaults">
                            ${deckSelect + modeSelect}
                        </form>
                    `;

                    await foundry.applications.api.DialogV2.prompt({
                        window: { title: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`) },
                        content: content,
                        ok: {
                            label: game.i18n.localize('Save'),
                            icon: 'fas fa-save',
                            callback: async (event, target) => {
                                const deckId = target.closest('form').querySelector('#deck-select').value;
                                const mode = Number(target.closest('form').querySelector('#draw-mode').value);

                                if (deckId === 'none') {
                                    await hand.unsetFlag(handsModule.id, 'default-deck');
                                    await hand.unsetFlag(handsModule.id, 'default-draw-mode');
                                } else {
                                    await hand.setFlag(handsModule.id, 'default-deck', deckId);
                                    await hand.setFlag(handsModule.id, 'default-draw-mode', mode);
                                }
                            }
                        }
                    });
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.FlipAll`),
                icon: '<i class="fas fa-rotate"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    const someFaceUp = hand.cards.some(c => c.face !== null);
                    const updates = hand.cards.map(c => {
                        return {
                            _id: c.id,
                            face: someFaceUp ? null : 0
                        };
                    });

                    await Card.updateDocuments(updates, { parent: hand });
                }
            },
            {
                name: game.i18n.localize("CARDS.ACTIONS.Shuffle"),
                icon: '<i class="fas fa-shuffle"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    await hand?.shuffle();
                }
            },
            {
                name: game.i18n.localize("CARDS.ACTIONS.Pass"),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    await hand?.passDialog();
                }
            },
            {
                name: game.i18n.localize("CARDS.ACTIONS.Reset"),
                icon: '<i class="fas fa-undo"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0].dataset.id);
                    await hand?.resetDialog();
                }
            },
        ];

        // Pull up menu options from link
        new ContextMenu(this.element, `.${handsModule.id}-context-menu-link`, options, { fixed: true, eventName: 'click' });
    }

    static _sort(array, propertyName) {
        return array.sort((a, b) => {
            // Compare the values
            if (a[propertyName] < b[propertyName]) {
                return -1;
            } else if (a[propertyName] > b[propertyName]) {
                return 1;
            } else {
                return 0;
            };
        });
    }
}
