/**
 * Displays a window with all the cards from the hand or pile in a larger view
 */
export class HandWindow extends FormApplication {
    constructor(cards) {
      super(cards, {});
      this.cards = cards;
      let t = this;
      
      if(this.cards.cards.size > 3){
        this.position.height = 700;
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
        height:350
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
        options: this.options,
        title: this.title
      }
    }
  
    activateListeners(html){
      html.find('.hand-mini-bar-window-card').click(function(e){HandMiniBarModule.cardClicked(e)});
      html.find('.hand-mini-bar-window-card').contextmenu(function(e){HandMiniBarModule.flipCard(e)});
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
      return buttons
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

  export default HandWindow;