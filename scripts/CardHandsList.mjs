import { handsModule } from "./card-hands-list.js";
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
        // Current inner Card Hands horizontal scroll positions
        this._scrollXPositions = {};
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize(`${handsModule.translationPrefix}.Heading`),
            id: handsModule.id,
            template: `modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`,
            popOut: false,
            scrollY: [`#${handsModule.id}-hands-wrapper`],
            scrollX: [`.${handsModule.id}-cards-list`],
        });
    }

    /** @override */
    async getData(options = {}) {
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

        const pinnedHands = game?.user?.getFlag(handsModule.id, 'pinned-hands');

        for (const hand of hands) {
            for (const card of hand.cards) {
                for (const face of card.faces) {
                    face.enrichedText = await TextEditor.enrichHTML(face.text);
                }

                card.enrichedDescription = await TextEditor.enrichHTML(card.description);
                card.back.enrichedText = await TextEditor.enrichHTML(card.back.text);
            }

            hand.isPinned = pinnedHands?.includes(hand.id);
            const favoriteHand = game.system.id === 'swade' ? game?.user?.getFlag('swade', 'favoriteCardsDoc') : null;
            hand.isFavorite = hand.id === favoriteHand;
        }

        // Return the data for rendering
        const data = {
            title: this.title,
            hands,
            collapsed: !this._showAllHands,
            isGM: game?.user?.isGM,
            moduleId: handsModule.id,
            translationPrefix: handsModule.translationPrefix,
            system: game.system.id,
        };

        data.minimalUi = { active: game.modules.get('minimal-ui')?.active };

        if (data.minimalUi.active) {
            data.minimalUi.listBehavior = game.settings.get(handsModule.id, 'minimal-ui-behavior');
        }

        return data;
    }

    /** @override */
    async _render(force = false, options = {}) {
        await super._render(force, options);

        if (this.element.length &&
            Object.keys(this._scrollXPositions).length === 0 &&
            this._scrollXPositions['.card-hands-list-cards-list']?.[0] &&
            this.element.filter('.card-hands-list-cards-list').every(el => el.width() > 0)
        ) {
            // Store scroll positions
            this._saveScrollXPositions(this.element);
        }

        // Render the inner content
        const data = await this.getData(this.options);
        const html = await this._renderInner(data);

        if (ui.players.element[0].previousElementSibling.id !== this.id) {
            ui.players.element[0]?.before(html[0]);
            await ui.cardHands.render(true);
        }
    }

    _saveScrollXPositions(html) {
        const selectors = this.options.scrollX || [];
        this._scrollXPositions = selectors.reduce((pos, sel) => {
            const el = html.find(sel);
            pos[sel] = Array.from(el).map(el => el.scrollLeft);
            return pos;
        }, {});
    }

    _restoreScrollXPositions(html) {
        const selectors = this.options.scrollX || [];
        const positions = this._scrollXPositions || {};

        for (let sel of selectors) {
            const el = html.find(sel);
            el.each((i, el) => el.scrollLeft = positions[sel]?.[i] || 0);
        }
    }

    /** @override */
    activateListeners(html) {
        // Toggle collapsed state
        html.find(`.${handsModule.id}-title`).click(this._onToggleAllHands.bind(this));
        // Scroll horizontally through cards in hand
        html.find('.horizontal-scroll').click(this._onScrollArrow.bind(this));
        html.find(`.${handsModule.id}-cards-list`).on('wheel', this._onHorizontalScroll.bind(this));
        // Open the Cards Hand
        html.find(`.${handsModule.id}-name a`)?.click(this._onOpenCardsHand.bind(this));
        // Favorite the Cards Hand
        html.find(`.${handsModule.id}-favorite a`)?.click(this._onFavoriteHand.bind(this));
        // Pin the Cards Hand
        html.find(`.${handsModule.id}-pin a`)?.click(this._onPinHand.bind(this));
        // Draw a Card
        html.find(`.${handsModule.id}-draw a`)?.click(this._onDrawCard.bind(this));
        // Open the Card Card
        //html.find(`.${handsModule.id}-card`)?.click(this._onOpenCard.bind(this));
        // Get a collection of card images
        const cardImages = html.find(`.${handsModule.id}-card`);
        // Flip a Card
        //cardImages?.on('contextmenu', this._onFlipCard.bind(this));
        // Drag a Card
        cardImages?.on('dragstart', this._onDragCard.bind(this));
        // Drop a Card
        html.find(`.${handsModule.id}-cards`)?.on('drop', this._onDropCard.bind(this));
        // Card Context menu
        const cardContextMenuItems = this._getCardContextOptions();
        // Pull up menu options from card
        new ContextMenu(html, `.${handsModule.id}-card`, cardContextMenuItems, { eventName: 'click' });
        new ContextMenu(html, `.${handsModule.id}-card`, cardContextMenuItems, { eventName: 'contextmenu' });
        // Pull up menu options from link
        new ContextMenu(html, `.${handsModule.id}-context-menu-link`, this._getHandContextOptions(), { eventName: 'click' });

        if (game.modules.get('minimal-ui')?.active) {
            const foundryLogo = document.querySelector('#logo');

            foundryLogo.addEventListener('click', () => {
                const cardHandsListElement = document.querySelector('#card-hands-list');

                if (cardHandsListElement) {
                    cardHandsListElement.style.display = cardHandsListElement.style.display === 'none' ? '' : 'none';
                }
            }, 'once');
        }
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

    _onScrollArrow(e) {
        const arrow = e.currentTarget;
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

    _onHorizontalScroll(e) {
        this._saveScrollXPositions(this.element);
    }

    // Open the Cards Hand
    async _onOpenCardsHand(e) {
        // Prevent multiple executions
        e.preventDefault();
        const hand = game.cards.get(e.target.closest(`.${handsModule.id}-hand`)?.dataset.id);
        await hand?.sheet.render(true);
    }

    // Open the Card
    async _onOpenCard(e) {
        // Prevent multiple executions
        e.preventDefault();
        const card = fromUuidSync(e.target.dataset.uuid);
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
        const favoriteId = e.target.parentElement.parentElement.dataset.id;
        const currentFavorite = game.user.getFlag('swade', 'favoriteCardsDoc');

        if (favoriteId === currentFavorite) {
            await game.user.unsetFlag('swade', 'favoriteCardsDoc');
        } else {
            // Favorite the Hand based on its ID.
            await game.user.setFlag('swade', 'favoriteCardsDoc', e.target.parentElement.parentElement.dataset.id);
        }

        await this.render(false);
    }

    // Pin Cards Hand
    async _onPinHand(e) {
        // Prevent multiple executions
        e.stopImmediatePropagation();
        const handId = e.target.parentElement.parentElement.dataset.id;
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
        this.render(false);
    }

    // Draw a Card from a Cards Stack
    async _onDrawCard(e) {
        e.stopImmediatePropagation();
        const hand = game.cards.get(e.target.parentElement.parentElement.dataset.id);
        const defaultDeck = hand.getFlag(handsModule.id, 'default-deck');
        const defaultMode = hand.getFlag(handsModule.id, 'default-draw-mode');
        const faceDown = hand.getFlag(handsModule.id, 'face-down');

        if (defaultDeck || defaultMode) {
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
        // Get the data transfer text value
        const textDataTransfer = e.originalEvent ? e.originalEvent.dataTransfer.getData('text/plain') : e.dataTransfer.getData('text/plain');

        if (textDataTransfer) {
            // If there's a value, parse it
            const parsedDataTransfer = JSON.parse(textDataTransfer);

            if (parsedDataTransfer?.type === 'Card') {
                // If there is parsed data, get the document from the UUI
                const cardDragged = fromUuidSync(parsedDataTransfer.uuid);

                if (cardDragged) {
                    // If there's an actual document
                    const dropTarget = fromUuidSync(e.target.dataset.uuid);
                    let hand = undefined;

                    if (dropTarget.documentName === 'Card') {
                        // If the target is a Card, get its Hand
                        hand = fromUuidSync(dropTarget.parent.uuid);
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

    _getCardContextOptions() {
        return [
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.PlayAdventureCard`),
                icon: '<i class="far fa-circle-play"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner && game.system.id === 'swade' && card.type === 'adventure' && game.modules.get('adventure-deck')?.active;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    const content = await renderTemplate("modules/adventure-deck/templates/adventurecard-chatcard.hbs", card);
                    ChatMessage.create({
                        user: game.user.id,
                        type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                        content: content,
                        sound: game.settings.get("adventure-deck", "toggleSoundOnPlayCard") ? "systems/swade/assets/card-flip.wav" : ""
                    });
                    const discardPile = await game.cards.getName(game.settings.get("adventure-deck", "dumpPileName"));
                    card.parent.pass(discardPile, [card.id], { chatNotification: false });
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.View`),
                icon: '<i class="far fa-eye"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    await new ImagePopout(card.img, {
                        title: card.name,
                        uuid: card.uuid
                    }).render(true);
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.Flip`),
                icon: '<i class="fas fa-rotate"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    await card.flip();
                }
            },
            {
                name: game.i18n.localize('CardHandsList.Pass'),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    await card.parent.playDialog(card);
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.Discard`),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    await card.parent.playDialog(card);
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.ReturnToDeck`),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const card = fromUuidSync(el[0].dataset.uuid);
                    return card.isOwner;
                },
                callback: async el => {
                    const card = await fromUuid(el[0].dataset.uuid);
                    await card.recall();
                }
            },
        ];
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
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    new DocumentOwnershipConfig(hand).render(true);
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`),
                icon: '<i class="fas fa-gears"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    // Check if owner
                    return hand.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    const decks = game?.cards?.filter(c => c.type === 'deck');
                    const deckOptions = [
                        `<option value="none" ${!hand?.getFlag(handsModule.id, 'default-deck') ? 'selected' : ''}>${game.i18n.localize(`${handsModule.translationPrefix}.None`)}</option>`
                    ];
                    const drawFaceDown = hand.getFlag(handsModule.id, 'face-down');

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
                        </form>
                    `;

                    new Dialog({
                        title: game.i18n.localize(`${handsModule.translationPrefix}.Defaults`),
                        content: content,
                        buttons: {
                            save: {
                                icon: '<i class="fas fa-save"></i>',
                                label: game.i18n.localize('Save'),
                                callback: async (html) => {
                                    const deckId = html.find('#deck-select').val();
                                    const mode = Number(html.find('#draw-mode').val());
                                    const faceDown = html.find('#face-down').is(':checked');

                                    if (deckId === 'none') {
                                        await hand.unsetFlag(handsModule.id, 'default-deck');
                                        await hand.unsetFlag(handsModule.id, 'default-draw-mode');
                                        await hand.unsetFlag(handsModule.id, 'face-down');
                                    } else {
                                        await hand.setFlag(handsModule.id, 'default-deck', deckId);
                                        await hand.setFlag(handsModule.id, 'default-draw-mode', mode);
                                        await hand.setFlag(handsModule.id, 'face-down', faceDown);
                                    }
                                }
                            }
                        },
                        default: "save",
                    }).render(true);
                }
            },
            {
                name: game.i18n.localize(`${handsModule.translationPrefix}.FlipAll`),
                icon: '<i class="fas fa-rotate"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    const updates = hand.cards.map(c => {
                        return {
                            _id: c.id,
                            face: c.face === null ? 0 : null
                        };
                    });
                    await Card.updateDocuments(updates, { parent: hand });
                }
            },
            {
                name: game.i18n.localize("CARDS.Shuffle"),
                icon: '<i class="fas fa-shuffle"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    await hand?.shuffle();
                }
            },
            {
                name: game.i18n.localize("CARDS.Pass"),
                icon: '<i class="fas fa-share-square"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    await hand?.passDialog();
                }
            },
            {
                name: game.i18n.localize("CARDS.Reset"),
                icon: '<i class="fas fa-undo"></i>',
                condition: el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    // Check if GM or if user is owner of hand
                    return hand?.isOwner;
                },
                callback: async el => {
                    const hand = game?.cards?.get(el[0]?.parentElement?.dataset?.id);
                    await hand?.resetDialog();
                }
            },
        ];
    }
};
