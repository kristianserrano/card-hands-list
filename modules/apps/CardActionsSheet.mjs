import { handsModule } from "../card-hands-list.mjs";
const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CardActionsSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        form: {
            submitOnChange: false,
            closeOnSubmit: false
        },
        actions: {
            viewFace: CardActionsSheet.#onViewFace,
        },
        window: {
            resizable: false,
        },
        position: {
            top: 80,
        },
        classes: ['card-hands-list-CardActions'],
    };

    static PARTS = {
        form: {
            template: 'modules/card-hands-list/templates/card-actions-sheet.hbs',
        },
    }

    get document() {
        return this.options.document;
    }

    get title() {
        return this.options.document.name;
    }

    async _prepareContext(options = {}) {
        context.object = this.document;
        context.buttonActions = this.options.buttonActions;

        for (const action of context.buttonActions) {
            action.button = document.createElement('button');
            action.button.classList.add('card-action');
            action.button.type = 'button';
            action.button.dataset.name = action.name;
            action.button.dataset.id = context.object.id;
            action.button.dataset.uuid = context.object.uuid;
            action.button.innerHTML = `${action.icon} ${action.name}`;
            action.display = (action.condition instanceof Function) ? action.condition($(action.button)) : action.condition;
        }

        context.actions = context.buttonActions.filter(a => a.name !== game.i18n.localize(`${handsModule.translationPrefix}.View`));
        return context;
    }

    async _onRender(context, options) {
        const actionButtons = this.element.querySelectorAll('.card-action');

        for (const button of actionButtons) {
            const actionCallback = context.actions.find(a => a.name === button.dataset.name).callback;
            const form = this.element.querySelector('.document-wrapper');
            button.addEventListener('click', (event) => actionCallback($(form)));
        }
    }

    static async #onViewFace(event, target) {
        new foundry.applications.apps.ImagePopout({
            src: this.options.document.img,
            'window.title': this.options.document.name,
            uuid: this.options.document.uuid,
        }).render({ force: true });
    };
}
