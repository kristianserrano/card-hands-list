/**
 * Displays a window with all the cards from the hand or pile in a larger view
 */
export class HandMiniBarWindow extends FormApplication {
    constructor(cards) {
      super(cards, {});
      this.cards = cards;
      let t = this;
      
      if(this.cards.cards.size > 3){
        this.position.height = 730;
      }
      /**
       * Hooks to listen to changes in this hand
       * Useful: CONFIG.debug.hooks = true
       */
      Hooks.on("updateCard", function(target, data) {
        if(!!data.drawn || data.sort !== undefined || data.face !== undefined){
          t.render();
        }
      });
      
      Hooks.on("deleteCard", function(target) {
        if(!!target && !!target.parent && (!!t.cards && (target.parent._id ? target.parent._id : target.parent.data._id) == (t.cards._id ? t.cards._id : t.cards.data._id))){
          t.render();
        }
      });
  
      Hooks.on("createCard", function(target) {
        if(!!target && !!target.parent && (!!t.cards && (target.parent._id ? target.parent._id : target.parent.data._id) == (t.cards._id ? t.cards._id : t.cards.data._id))){
          t.render();
        }
      });
    }
  
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
        template: "modules/hand-mini-bar/templates/window-hand.html",
        classes: ["hand-mini-bar-hand-popout"],
        editable: false,
        resizable: true,
        shareable: false,
        uuid: null,
        width:750,
        height:380
      });
    }
  
    /** @override */
    get title() {
      return this.cards.name;
    }
  
    /** @override */
    async getData(options) {
      let cards = this.cards.cards.contents;
      cards.sort(HandMiniBarModule.cardSort);
      return {
        cards: cards,
        cardsid: this.cards._id ? this.cards._id: this.cards.data._id,
        isDeck: this.cards.type === "deck",
        isFaceUpMode: CONFIG.HandMiniBar.options.faceUpMode,
        options: this.options,
        title: this.title
      }
    }
  
    activateListeners(html){
      let t = this;
      html.find('.hand-mini-bar-window-card').click(function(e){
        let id = $(e.target).data("card-id");
        let card = t.cards.cards.get(id);
        HandMiniBarModule.cardClicked(t.cards, card);
      });
      html.find('.hand-mini-bar-window-card').contextmenu(function(e){
        let id = $(e.target).data("card-id");
        let card = t.cards.cards.get(id);
        HandMiniBarModule.flipCard(card)
      });
      html.find('.hand-mini-bar-flip-all-cards').click(function(e){HandMiniBarModule.flipAllCards(t.cards)});
      html.find('.hand-mini-bar-flip-all-deal').click(function(e){t.cards.dealDialog()});
      html.find('.hand-mini-bar-flip-all-pass').click(function(e){t.cards.passDialog()});
      html.find('.hand-mini-bar-flip-all-reset').click(function(e){t.cards.resetDialog()});
      HandMiniBarModule.attachDragDrop.call(this, html[0]);
    }
  
    /** @override */
    _getHeaderButtons() {
      let buttons = super._getHeaderButtons();
      let t = this;
      buttons.unshift({
        label: "HANDMINIBAR.OpenCardStack",
        class: "open-stack",
        icon: "fas fa-cards",
        onclick: ev => HandMiniBarModule.openHand(t.cards)
      });    
      //this feature is only supported in version 10
      if ( game.user.isGM && game.version.match(/^10/)) {
        buttons.unshift({
          label: "HANDMINIBAR.ActionShow",
          class: "share-stack",
          icon: "fas fa-eye",
          onclick: () => t.showStack()
        });
      } 
      
      return buttons
    }

    async showStack() {
      let t = this;
      const users = game.users.filter(u => u.id !== game.userId);
      const ownership = Object.entries(CONST.DOCUMENT_OWNERSHIP_LEVELS);
      const levels = [
        {level: CONST.DOCUMENT_META_OWNERSHIP_LEVELS.NOCHANGE, label: "OWNERSHIP.NOCHANGE"},
        ...ownership.map(([name, level]) => ({level, label: `OWNERSHIP.${name}`}))
      ];
      const html = await renderTemplate("modules/hand-mini-bar/templates/dialog-show.html", {users, levels, isImage:false});
  
      return Dialog.prompt({
        title: game.i18n.format("JOURNAL.ShowEntry", {name: this.cards.title}),
        label: game.i18n.localize("JOURNAL.ActionShow"),
        content: html,
        render: html => {
          const form = html.querySelector("form");
          form.elements.allPlayers.addEventListener("change", event => {
            const checked = event.currentTarget.checked;
            form.querySelectorAll('[name="players"]').forEach(i => {
              i.checked = checked;
              i.disabled = checked;
            });
          });
        },
        callback: async html => {
          const form = html.querySelector("form");
          const fd = new FormDataExtended(form).object;
          const users = fd.allPlayers ? game.users.filter(u => !u.isSelf) : fd.players.reduce((arr, id) => {
            const u = game.users.get(id);
            if ( u && !u.isSelf ) arr.push(u);
            return arr;
          }, []);
          if ( !users.length ) return;
          const userIds = users.map(u => u.id);
          if ( fd.ownership > -2 ) {
            const ownership = this.cards.ownership;
            for ( const id of userIds ) {
              if ( ownership[id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE ) ownership[id] = fd.ownership;
              ownership[id] = Math.max(ownership[id] ?? -Infinity, fd.ownership);
            }
            await doc.update({ownership});
          }
          return t.showStackToPlayers({
            users: userIds,
            all: fd.allPlayers
          });
        },
        rejectClose: false,
        options: {jQuery: false}
      });
    }

    async showStackToPlayers({users=[], ...options}={}) {
      game.socket.emit(HandMiniBarModule.eventName, {action:"showStackWindow",uuid: this.cards.uuid, users, ...options});
      let players = options.all ? game.i18n.format("HANDMINIBAR.allPlayers") : game.i18n.format("HANDMINIBAR.selectedPlayers");
      ui.notifications.info(game.i18n.format("HANDMINIBAR.StackShowSuccess") + players);
    }
     
    drag(event){
      HandMiniBarModule.drag.call(this, event);
    }

    drop(event){
      HandMiniBarModule.drop.call(this, event);
    }

    getCards(){
      return this.cards;
    }
  }

  export default HandMiniBarWindow;