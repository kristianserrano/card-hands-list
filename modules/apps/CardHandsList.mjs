import { handsModule } from "../card-hands-list.mjs";
import { CardActionsSheet } from "./CardActionsSheet.mjs";
import { HandActionsSheet } from "./HandActionsSheet.mjs";
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
            template: `modules/${handsModule.id}/templates/container.hbs`,
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
        html.find(`.${handsModule.id}-card`)?.click(this._onOpenCard.bind(this));
        // Get a collection of card images
        const cardImages = html.find(`.${handsModule.id}-card`);
        // Drag a Card
        cardImages?.on('dragstart', this._onDragCard.bind(this));
        cardImages?.on('contextmenu', this._onFlipCard.bind(this));
        // Drop a Card
        html.find(`.${handsModule.id}-cards`)?.on('drop', this._onDropCard.bind(this));

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
        const document = game.cards.get(e.target.closest(`.${handsModule.id}-hand`)?.dataset.id);

        if (document) {
            new HandActionsSheet({
                document,
                buttonActions: CONFIG.CardHandsList.menuItems.handContextOptions,
            }).render(true);
        }
    }

    // Open the Card
    async _onOpenCard(e) {
        // Prevent multiple executions
        e.preventDefault();
        const document = fromUuidSync(e.target.dataset.uuid);

        if (document) {
            new CardActionsSheet({
                document,
                buttonActions: CONFIG.CardHandsList.menuItems.cardContextOptions,
            }).render(true);
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
                    const dropTarget = game.cards.get(e.currentTarget.parentElement.dataset.id);
                    const hand = dropTarget.documentName === 'Cards' && dropTarget.type === 'hand' ? dropTarget : fromUuidSync(dropTarget.parent.uuid);

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
};
