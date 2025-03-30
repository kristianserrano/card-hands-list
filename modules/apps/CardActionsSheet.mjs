import { handsModule } from "../card-hands-list.mjs";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CardActionsSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
    static DEFAULT_OPTIONS = {
        tag: "div",
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            viewFace: CardActionsSheet.#onViewFace,
        },
        window: {
            resizable: true,
        },
        position: {
            width: 350,
            top: 80,
        },
        classes: ['card-hands-list-actions'],
    };

    static PARTS = {
        card: {
            template: 'modules/card-hands-list/templates/card-actions-sheet.hbs',
            classes: ['card-image'],
            scrollable: ['.document-wrapper'],
        },
        actions: {
            template: 'modules/card-hands-list/templates/actions-footer.hbs',
            classes: ['sheet-footer'],
        }
    }

    get title() {
        return this.options.document.name;
    }

    get id() {
        return `CardActionsSheet-${this.document.id}`;
    }

    async _preparePartContext(partId, context) {
        switch (partId) {
            case 'card':
                context.card = this.options.document;
                break;
            case 'actions':
                for (const action of this.options.buttonActions) {
                    action.button = document.createElement('button');
                    action.button.classList.add('card-action');
                    action.button.type = 'button';
                    action.button.dataset.name = action.name;
                    action.button.dataset.id = context.card.id;
                    action.button.dataset.uuid = context.card.uuid;
                    action.button.innerHTML = `${action.icon} ${action.name}`;
                    action.display = (action.condition instanceof Function) ? action.condition($(action.button)) : action.condition;
                }

                context.actionButtons = this.options.buttonActions?.filter(a => a.name !== game.i18n.localize(`${handsModule.translationPrefix}.View`));
                break;
        }
        return context;
    }

    async _onRender(context, options) {
        const actionButtons = this.element.querySelectorAll('.card-action');

        for (const button of actionButtons) {
            const contextButton = context.actionButtons.find(a => a.name === button.dataset.name);
            button.addEventListener('click', (event) => contextButton.callback($(button)));
        }

        // Drag a Card
        this.element.querySelector('.card-image')?.addEventListener('dragstart', this.#onDragCard.bind(this));
    }

    static async #onViewFace(event, target) {
        const card = fromUuidSync(target.dataset.uuid);
        new ImagePopout(card.img, {
            title: card.name,
            uuid: card.uuid,
        }).render(true);
    }

    // Drag a Card in a Cards Hand
    #onDragCard(event) {
        const jsonData = JSON.stringify({ type: "Card", uuid: event.target.dataset.uuid });
        event.dataTransfer.setData('text/plain', jsonData);
    }
}
