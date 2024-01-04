import { handsModule } from "./card-hands-list.js";
/**
 * The UI element which displays the list of Hands available to the User.
 * @extends {ContextMenu}
 */
export class CardHandContextMenu extends ContextMenu {
    /** @override */
    _setPosition(html, target) {
        const container = target[0].parentElement;

        // Append to target and get the context bounds
        target.css("position", "relative");
        html.css("visibility", "hidden");
        target.append(html);
        const contextRect = html[0].getBoundingClientRect();
        const parentRect = target[0].getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Determine whether to expand upwards
        const contextTop = parentRect.top - contextRect.height;
        const contextBottom = parentRect.bottom + contextRect.height;
        const canOverflowUp = (contextTop > containerRect.top) || (getComputedStyle(container).overflowY === "visible");

        // If it overflows the container bottom, but not the container top
        const containerUp = (contextBottom > containerRect.bottom) && (contextTop >= containerRect.top);
        const windowUp = (contextBottom > window.innerHeight) && (contextTop > 0) && canOverflowUp;

        this._expandUp = containerUp || windowUp;

        if (target[0].classList.contains(`${handsModule.id}-context-menu-link`)) {
            html[0].classList.add('card-hands-list-negative-margin');
            const contextMenuLinks = document.querySelectorAll('.card-hands-list-context-menu-link');

            if (document.querySelectorAll('.card-hands-list-hand').length === 1 || target[0] === contextMenuLinks[0]) {
                this._expandUp = false;
            }
        }

        // Display the menu
        html.toggleClass("expand-up", this._expandUp);
        html.toggleClass("expand-down", !this._expandUp);
        html.css("visibility", "");
        target.addClass("context");
    }

}