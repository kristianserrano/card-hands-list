
/**
 * The UI element which displays the list of Users who are currently playing within the active World.
 * @extends {Application}
 */
class CardHandsList extends Application {
    constructor(options) {
        super(options);
        game.users.apps.push(this);

        /**
         * An internal toggle for whether to show offline players or hide them
         * @type {boolean}
         * @private
         */
        this._showOffline = false;
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: `${handsModule.id}-container`,
            template: `modules/${handsModule.id}/templates/${handsModule.id}-container.hbs`,
            popOut: false
        });
    }

    /* -------------------------------------------- */
    /*  Application Rendering                       */
    /* -------------------------------------------- */

    /**
     * Whether the players list is in a configuration where it is hidden.
     * @returns {boolean}
     */
    get isHidden() {
        if (game.webrtc.mode === AVSettings.AV_MODES.DISABLED) return false;
        const { client, verticalDock } = game.webrtc.settings;
        return verticalDock && client.hidePlayerList && !client.hideDock && !ui.webrtc.hidden;
    }

    /* -------------------------------------------- */

    /** @override */
    render(force, context = {}) {
        this._positionInDOM();
        const { renderContext, renderData } = context;
        if (renderContext) {
            const events = [
                'createCard',
                'createCards',
                'updateCard',
                'updateCards',
                'deleteCard',
                'deleteCards',
            ];
            if (!events.includes(renderContext)) return this;
            const updateKeys = ["name", "face", "ownership", "ownership.default"];
            console.log(`what's this`)
            if (renderContext === "updateCards" && !updateKeys.some(k => renderData.hasOwnProperty(k))) return this;
        }
        return super.render(force, context);
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options = {}) {

        // Process hand data by adding extra characteristics
        const hands = game.cards.filter((c) => c.type === 'hand' && c.testUserPermission(game.user, ownershipLevel)).map(hand => {
            const h = hand.toObject(false);
            return h;
        }).sort((a, b) => {
            if (a.ownership[game.userId] >= CONST.OWNERSHIP.OWNER) return 1;
            return -1;
        });

        // Return the data for rendering
        return {
            hands,
            hidden: this.isHidden,
            moduleId: handsModule.id,
            translationPrefix: handsModule.translationPrefix,
        };
    }

    /* -------------------------------------------- */

    /**
     * Position this Application in the main DOM appropriately.
     * @protected
     */
    _positionInDOM() {
        document.body.classList.toggle("players-hidden", this.isHidden);
        if ((game.webrtc.mode === AVSettings.AV_MODES.DISABLED) || this.isHidden || !this.element.length) return;
        const element = this.element[0];
        const cameraViews = ui.webrtc.element[0];
        const uiTop = document.getElementById("ui-top");
        const uiLeft = document.getElementById("ui-left");
        const { client, verticalDock } = game.webrtc.settings;
        const inDock = verticalDock && !client.hideDock && !ui.webrtc.hidden;

        if (inDock && !cameraViews?.contains(element)) {
            cameraViews.appendChild(element);
            uiTop.classList.remove("offset");
        } else if (!inDock && !uiLeft.contains(element)) {
            uiLeft.appendChild(element);
            uiTop.classList.add("offset");
        }
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers
    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {

        // Toggle online/offline
        html.find("h3").click(this._onToggleOfflinePlayers.bind(this));

        // Context menu
        const contextOptions = this._getUserContextOptions();
        Hooks.call("getUserContextOptions", html, contextOptions);
        new ContextMenu(html, ".player", contextOptions);
    }

    /* -------------------------------------------- */

    /**
     * Return the default context options available for the Players application
     * @returns {object[]}
     * @private
     */
    _getHandContextOptions() {
        return [
            {
                name: game.i18n.localize("CARDS.Shuffle"),
                icon: '<i class="fas fa-cards"></i>',
                condition: li => {
                    const hand = game.cards.get(li[0].dataset.handId)
                    // Check if GM or if user is owner of hand
                    return hand.isOwner;
                },
                callback: li => {
                    const user = game.users.get(li[0].dataset.userId);
                    user?.sheet.render(true);
                }
            },
            {
                name: game.i18n.localize("CARDS.Flip"),
                icon: '<i class="fas fa-cards"></i>',
                condition: li => game.user.isGM || (li[0].dataset.userId === game.user.id),
                callback: li => {
                    const user = game.users.get(li[0].dataset.userId);
                    user?.sheet.render(true);
                }
            },
        ];
    }

    /* -------------------------------------------- */

    /**
     * Toggle display of the Players hud setting for whether to display offline players
     * @param {Event} event   The originating click event
     * @private
     */
    _onToggleOfflinePlayers(event) {
        event.preventDefault();
        this._showOffline = !this._showOffline;
        this.render();
    }

    /* -------------------------------------------- */

    /**
     * Temporarily remove a User from the World by banning and then un-banning them.
     * @param {User} user     The User to kick
     * @returns {Promise<void>}
     */
    async #kickUser(user) {
        const role = user.role;
        await user.update({ role: CONST.USER_ROLES.NONE });
        await user.update({ role }, { diff: false });
        ui.notifications.info(`${user.name} has been <strong>kicked</strong> from the World.`);
    }

    /* -------------------------------------------- */

    /**
     * Ban a User by changing their role to "NONE".
     * @param {User} user     The User to ban
     * @returns {Promise<void>}
     */
    async #banUser(user) {
        if (user.role === CONST.USER_ROLES.NONE) return;
        await user.update({ role: CONST.USER_ROLES.NONE });
        ui.notifications.info(`${user.name} has been <strong>banned</strong> from the World.`);
    }

    /* -------------------------------------------- */

    /**
     * Unban a User by changing their role to "PLAYER".
     * @param {User} user     The User to unban
     * @returns {Promise<void>}
     */
    async #unbanUser(user) {
        if (user.role !== CONST.USER_ROLES.NONE) return;
        await user.update({ role: CONST.USER_ROLES.PLAYER });
        ui.notifications.info(`${user.name} has been <strong>unbanned</strong> from the World.`);
    }
}
