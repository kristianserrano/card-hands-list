import { handsModule } from "../card-hands-list.mjs";
import { CardActionsSheet } from "./CardActionsSheet.mjs";
import { HandActionsSheet } from "./HandActionsSheet.mjs";

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
            openCardActions: CardHandsList.#onOpenCardActions,
            scrollArrow: CardHandsList.#onScrollArrow,
        },
    };

    static PARTS = {
        cardHands: {
            root: true,
            template: "modules/card-hands-list/templates/container.hbs",
            scrollable: [
                '#pinned-hands-list',
                '#available-hands',
                '#pinned-hands',
            ],
            scrollableX: [
                '.cards-list',
            ],
        }
    };

    async _prepareContext(options = {}) {
        // Process hand data by adding extra characteristics
        function determineOwnership(hand, permittedOwnershipLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS[game.settings.get(handsModule.id, "observerLevel") ? 'OBSERVER' : 'OWNER']) {
            // If explicit ownership is enabled, check the user's ownership level or the default level unless set to none.
            if (game.settings.get(handsModule.id, "explicitOwnership")) {
                // If the user has only default permissions, set to -1; otherwise, set to the user's level.
                const userOwnershipLevel = hand.getUserLevel() ?? -1;
                // If the user's ownership level is set to None, return false as they should not be able to see the hand.
                if (userOwnershipLevel === CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE) return false;
                // If the default ownership level is higher than the user's, use the default level; otherwise, use the user's level since it is explicitly set.
                const hasAccess = userOwnershipLevel >= permittedOwnershipLevel;
                // Return whether the resulting permission level is at or above the permitted level.
                return hasAccess;
            } else {
                // Generically test the user permission. GM's will always have access.
                return hand.testUserPermission(game.user, permittedOwnershipLevel);
            }
        }

        const hands = game?.cards?.filter((c) => c.type === 'hand' && determineOwnership(c));
        hands.sort((a, b) => a.ownership[game.userId] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);

        for (const hand of hands) {
            const playerOwnerIDs = Object.keys(hand.ownership).filter((k) => k !== 'default' && !game.users.get(k)?.isGM);
            // If the user is an owner, set as owner.
            hand.owner = hand.getUserLevel() === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER ? game.user : game.users.get(playerOwnerIDs[0]);
            hand.isExplicitOwner = hand.getUserLevel() === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

            // Enrich the cards' texts
            for (const card of hand.cards) {
                for (const face of card.faces) {
                    face.enrichedText = await TextEditor.enrichHTML(face.text);
                }

                card.enrichedDescription = await TextEditor.enrichHTML(card.description);
                card.back.enrichedText = await TextEditor.enrichHTML(card.back.text);
            }

            // Sort the cards by sort values
            hand.sortedCards = hand.cards.contents.sort((a, b) => a.sort - b.sort);
            // Check if this hand is pinned
            hand.isPinned = game?.user?.getFlag(handsModule.id, 'pinned-hands')?.includes(hand.id);
            hand.isFavorite = false;
            // Handle Favorite hand
            hand.allowFavorite = hand.getUserLevel() === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && (game.system.id === 'swade' || game.modules.get('complete-card-management')?.active);

            if (hand.allowFavorite) {
                const favoriteSWADEHandId = game.system.id === 'swade' ? game.user.getFlag('swade', 'favoriteCardsDoc') : null;
                const favoriteCCMHandId = game.modules.get('complete-card-management')?.active ? game.user.getFlag('complete-card-management', 'playerHand') : null;
                const favoriteHand = favoriteSWADEHandId ? favoriteSWADEHandId : favoriteCCMHandId;
                hand.isFavorite = hand.id === favoriteHand;
            }
        }

        // Categorize the hands.
        const ownedHands = hands.filter(hand => determineOwnership(hand, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
        const observableHands = hands.filter(hand => !ownedHands.some(owned => owned.id === hand.id) && determineOwnership(hand, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER));
        const favoriteHand = hands.find(hand => hand.isFavorite);
        const pinnedHandsObservable = observableHands.filter(hand => hand.isPinned);
        const pinnedHandsOwned = ownedHands.filter(hand => hand.isPinned);
        // Return the data for rendering
        const context = {
            title: this.title,
            hands,
            ownedHands,
            observableHands,
            favoriteHand,
            pinnedHandsObservable,
            pinnedHandsOwned,
            stats: {
                owner: ownedHands.length,
                observer: observableHands.length,
            },
            showObservable: game.settings.get(handsModule.id, "observerLevel"),
            expanded: this.element?.classList.contains('expanded'),
            isGM: game?.user?.role === 4,
            userColor: game?.user?.color,
            moduleId: handsModule.id,
            system: game.system.id,
        };

        return context;
    }

    async _onFirstRender(_context, _options) {
        this.scrollLeftPositions = this.scrollLeftPositions ?? {};
        game.cards.apps.push(this);
        // Append app to UI
        ui.players.element.parentElement.insertBefore(this.element, ui.players.element);
    }

    _onRender(context, options) {
        this.element.classList.toggle("expanded", this.expanded);

        // Capture horizontal scroll position
        for (const cardsList of this.element.querySelectorAll(`.cards-list`)) {
            cardsList.addEventListener('wheel', CardHandsList.#onHorizontalScroll.bind(this));
        }

        // Get a collection of card images
        for (const cardImage of this.element.querySelectorAll(`.card-image`)) {
            cardImage.addEventListener('dragstart', CardHandsList.#onDragCard.bind(this));
        }

        // Drop a Card
        for (const cards of this.element.querySelectorAll(`.cards`)) {
            cards.addEventListener('drop', CardHandsList.#onDropCard.bind(this));
            cards.addEventListener('contextmenu', CardHandsList.#onFlipCard.bind(this));
        }

        if (!foundry.utils.isEmpty(this.scrollLeftPositions)) {
            this._restoreScrollXPositions();
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

    _saveScrollXPositions(element = null) {
        if (element) {
            this.scrollLeftPositions[element.dataset.id] = element.scrollLeft;
        } else {
            const selector = CardHandsList.PARTS?.cardHands?.scrollableX;
            const elements = this.element.querySelectorAll(selector);
            for (const el of elements) {
                this.scrollLeftPositions[el.dataset.id] = el.scrollLeft;
            }
        }
    }

    async _restoreScrollXPositions(element = null) {
        if (element) {
            await CardHandsList.waitForImages(element);
            element.scrollLeft = this.scrollLeftPositions[element.dataset.id];
        } else {
            const selector = CardHandsList.PARTS.cardHands.scrollableX;
            const elements = this.element.querySelectorAll(selector);

            for (const el of elements) {
                await CardHandsList.waitForImages(el);
                el.scrollTo({
                    left: this.scrollLeftPositions[el.dataset.id],
                    behavior: 'instant',
                });
            }
        }
    }

    static #onScrollArrow(event, target) {
        const arrow = target;
        const cardElement = arrow.parentElement.querySelector(`.card`);
        const handElement = cardElement.parentElement;
        let number = handElement.scrollLeft;

        if (arrow.classList.contains('--right')) {
            number += cardElement.offsetWidth;
        } else if (arrow.classList.contains('--left')) {
            number -= cardElement.offsetWidth;
        }

        handElement.scroll({ left: number, behavior: 'smooth' });

        // Store scroll positions
        this._saveScrollXPositions(handElement);
    }

    static #onHorizontalScroll(event) {
        this._saveScrollXPositions(event.currentTarget);
    }

    // Open the Card
    static async #onOpenCardActions(event, target) {
        // Prevent multiple executions
        event.preventDefault();
        const document = fromUuidSync(target.dataset.uuid);

        if (document) {
            new CardActionsSheet({
                document,
                buttonActions: CONFIG.CardHandsList.menuItems.cardContextOptions,
            }).render(true);
        }
    }

    // Open the Cards Hand
    static async #onOpenHand(event, target) {
        // Prevent multiple executions
        event.preventDefault();
        const document = game.cards.get(target.dataset.id);

        if (document) {
            new HandActionsSheet({
                document,
                buttonActions: CONFIG.CardHandsList.menuItems.handContextOptions,
            }).render({ force: true });
        }
    }

    // Favorite Cards Hand
    static async #onFavoriteHand(event, target) {
        // Prevent multiple executions
        event.stopImmediatePropagation();
        const systemIsSwade = game.system.id === 'swade';
        const ccmIsActive = game.modules.get('complete-card-management')?.active;
        const favoriteId = target.closest('.hand-button.favorite')?.dataset.id;
        const currentSWADEFavorite = systemIsSwade ? game.user.getFlag('swade', 'favoriteCardsDoc') : null;
        const currentCCMFavorite = ccmIsActive ? game.user.getFlag('complete-card-management', 'playerHand') : null;

        if (systemIsSwade) {
            if (favoriteId === currentSWADEFavorite) {
                await game.user.unsetFlag('swade', 'favoriteCardsDoc');
            } else {
                await game.user.setFlag('swade', 'favoriteCardsDoc', favoriteId);
            }
        }
        if (ccmIsActive) {
            if (favoriteId === currentCCMFavorite) {
                await game.user.unsetFlag('complete-card-management', 'playerHand');
            } else {
                await game.user.setFlag('complete-card-management', 'playerHand', favoriteId);
            }
        }

        await this.render(false);
    }

    // Pin Cards Hand
    static async #onPinHand(event, target) {
        // Prevent multiple executions
        event.stopImmediatePropagation();
        const handId = target.dataset.id;
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
    static async #onFlipCard(event) {
        const card = await fromUuid(event.target.dataset.uuid);
        await card.flip();
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
                    const dropTarget = fromUuidSync(event.target.dataset.uuid);
                    const hand = dropTarget.documentName === 'Cards' && dropTarget.type === 'hand' ? dropTarget : fromUuidSync(dropTarget.parent.uuid);

                    if (cardDragged.parent.id !== hand.id) {
                        // If the Card's parent and the target Card Hand are not the same, pass the Card
                        await cardDragged.parent.pass(hand, [cardDragged.id]);
                    } else {
                        // If they are the same, order the Cards.
                        const otherCards = hand.cards.filter((c) => c.id !== cardDragged.id);
                        const data = foundry.utils.SortingHelpers.performIntegerSort(cardDragged, { target: dropTarget, siblings: otherCards });
                        const target = data[0].target;
                        const sort = data[0].update.sort;
                        await target.update({ sort: sort });
                    }
                }
            }
        }
    }

    static #sort(array, propertyName) {
        return array.sort((a, b) => a[propertyName].localeCompare(b[propertyName]));
    }
};
