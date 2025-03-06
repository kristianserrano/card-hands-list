import { handsModule } from "./card-hands-list.mjs";
/**
 * The UI element which displays the list of Hands available to the User.
 * @extends {ContextMenu}
 */
export class CardHandContextMenu extends ContextMenu {
    /** @override */

    #expandUp = false;

    _setPosition(contextMenuElement, target) {
        const handElement = target.closest(`.${handsModule.id}-hand`);
        const containerElement = target.closest(`.${handsModule.id}-wrapper`);

        // Append to target and get the context bounds
        handElement.style.position = "relative";
        contextMenuElement.style.visibility = "hidden";
        handElement.prepend(contextMenuElement);
        const contextRect = contextMenuElement.getBoundingClientRect();
        const handRect = handElement.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();

        // Determine whether to expand upwards
        const contextTop = handRect.top;
        const contextBottom = handRect.bottom + contextRect.height;
        const canOverflowUp = (contextTop > containerRect.top) || (getComputedStyle(containerElement).overflowY === "visible");

        // If it overflows the container bottom, but not the container top
        const containerUp = (contextBottom > containerRect.bottom) && (contextTop >= containerRect.top);
        const windowUp = (contextBottom > window.innerHeight) && (contextTop > 0) && canOverflowUp;
        this.#expandUp = containerUp || windowUp;

        if (target.classList.contains(`${handsModule.id}-context-menu-link`)) {
            contextMenuElement.classList.add('card-hands-list-negative-margin');
            const contextMenuLinks = containerElement.querySelectorAll('.card-hands-list-context-menu-link');

            if (containerElement.querySelectorAll('.card-hands-list-hand').length <= 2 || target === contextMenuLinks[0]) {
                this.#expandUp = false;
            }
        }

        // Display the menu
        contextMenuElement.classList.toggle('expand-up', this.#expandUp);
        contextMenuElement.classList.toggle('expand-down', !this.#expandUp);
        contextMenuElement.style.visibility = '';
        target.classList.add('context');
    }

}
