import { handsModule } from "../card-hands-list.mjs";
import { CardActionsSheet } from "./CardActionsSheet.mjs";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class HandActionsSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
    static DEFAULT_OPTIONS = {
        tag: "div",
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            openCard: HandActionsSheet.#onOpenCard,
        },
        window: {
            resizable: true,
        },
        position: {
            width: 724,
            height: 352,
            top: 80,
        },
        classes: ['card-hands-list-actions'],
    };

    static PARTS = {
        hand: {
            template: 'modules/card-hands-list/templates/hand-actions-sheet.hbs',
            classes: ['card-actions-sheet-hand-cards', 'scrollable'],
            scrollable: [''],
        },
        actions: {
            template: 'modules/card-hands-list/templates/actions-footer.hbs',
            classes: ['sheet-footer'],
        }
    };

    get title() {
        return this.document.name;
    }

    get id() {
        return `HandActionsSheet-${this.document.id}`;
    }

    async _preparePartContext(partId, context) {
        switch (partId) {
            case 'hand':
                context.hand = this.document;
                context.hand.sortedCards = this.document.cards.contents.sort((a, b) => a.sort - b.sort);
                break;
            case 'actions':
                const buttonActions = this.options.buttonActions ?? CONFIG.CardHandsList.menuItems.handContextOptions;

                for (const action of buttonActions) {
                    action.button = document.createElement('button');
                    action.button.classList.add('card-action');
                    action.button.type = 'button';
                    action.button.dataset.name = action.name;
                    action.button.dataset.id = context.hand.id;
                    action.button.dataset.uuid = context.hand.uuid;
                    action.button.innerHTML = `${action.icon} ${action.name}`;
                    action.display = (action.condition instanceof Function) ? action.condition(action.button) : action.condition;
                }

                if (this.document.getFlag('core', 'sheetClass') === "card-hands-list.HandActionsSheet") {
                    context.actionButtons = buttonActions?.filter(a => a.name !== game.i18n.localize(`${handsModule.translationPrefix}.OpenHand`));
                } else {
                    context.actionButtons = buttonActions;
                }

                break;
        }
        return context;
    }

    async _onRender(context, options) {
        const actionButtons = this.element.querySelectorAll('.card-action');

        for (const button of actionButtons) {
            const contextButton = context.actionButtons.find(a => a.name === button.dataset.name);
            button.addEventListener('click', (event) => contextButton.callback(button));
        }

        // Drag a Card
        for (const cardImage of this.element.querySelectorAll('.card-actions-sheet-card img')) {
            cardImage.addEventListener('dragstart', this.#onDragCard.bind(this));
        }

        // Drop a Card
        this.element.querySelectorAll('.card-actions-sheet-hand-cards .card-actions-sheet-card img').forEach(c => {
            c.addEventListener('drop', this.#onDropCard.bind(this));
            c.addEventListener('contextmenu', (event) => {
                const card = fromUuidSync(event.currentTarget.dataset.uuid);
                card.flip();
            });
        });
        this.element.querySelector('.card-actions-sheet-hand-cards').addEventListener('drop', this.#onDropCard.bind(this));
    }

    static async #onOpenCard(event, target) {
        const card = fromUuidSync(target.dataset.uuid);
        new CardActionsSheet({
            document: card,
            buttonActions: CONFIG.CardHandsList.menuItems.cardContextOptions,
        }).render({ force: true });
    }

    // Drag a Card in a Cards Hand
    #onDragCard(event) {
        const jsonData = JSON.stringify({ type: "Card", uuid: event.target.dataset.uuid });
        event.dataTransfer.setData('text/plain', jsonData);
    }

    // Drag a Card in a Cards Hand
    async #onDropCard(event) {
        event.preventDefault();

        // Get the data transfer text value
        const textDataTransfer = event.dataTransfer.getData('text/plain');

        if (textDataTransfer) {
            // If there's a value, parse it
            const parsedDataTransfer = JSON.parse(textDataTransfer);

            if (parsedDataTransfer?.type === 'Card') {
                // If there is parsed data, get the document from the UUI
                const cardDragged = fromUuidSync(parsedDataTransfer.uuid);

                if (cardDragged) {
                    // If there's an actual document
                    const dropTarget = fromUuidSync(event.currentTarget.dataset.uuid);
                    const hand = dropTarget.documentName === 'Cards' && dropTarget.type === 'hand' ? dropTarget : dropTarget.documentName === 'Card' ? fromUuidSync(dropTarget.parent.uuid) : null;

                    if (dropTarget.id === hand.id && cardDragged.parent.id !== hand.id) {
                        // If the Card's parent and the target Card Hand are not the same, pass the Card
                        await cardDragged.parent.pass(hand, [cardDragged.id]);
                    } else if (dropTarget.documentName === 'Card' && cardDragged.parent.id === dropTarget.parent.id) {
                        // If they are the same, order the Cards.
                        const otherCards = hand.cards.filter((c) => c.id !== cardDragged.id);
                        const results = SortingHelpers.performIntegerSort(cardDragged, {
                            target: dropTarget,
                            siblings: otherCards,
                            sortBefore: true,
                        });
                        const updateData = results.map(r => {
                            r.update._id = r.target._id;
                            return r.update;
                        });
                        await hand.updateEmbeddedDocuments('Card', updateData);
                    }
                }
            }
        }
    }
}
