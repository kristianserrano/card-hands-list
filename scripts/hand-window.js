
import CardListeners from './card-listener.js';

export class HandWindow extends FormApplication {
    constructor(minibar) {
      super(cards, {});
      this.cards = minibar.currentCards;
      this.currentCards = minibar.currentCards;
      this.minibar = minibar;
      let t = this;
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
        if(!!target && !!target.parent && (!!t.currentCards && target.parent.data._id == t.currentCards.data._id)){
          t.render();
        }
      });
  
      Hooks.on("createCard", function(target) {
        if(!!target && !!target.parent && (!!t.currentCards && target.parent.data._id == t.currentCards.data._id)){
          t.render();
        }
      });
    }
  
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
        template: "modules/hand-mini-bar/templates/window-hand.html",
        classes: ["image-popout", "dark"],
        editable: false,
        resizable: true,
        shareable: false,
        uuid: null,
        width:800,
        height:350
      });
    }
  
    /** @override */
    get title() {
      return this.cards.data.name;
    }
  
    /** @override */
    async getData(options) {
      return {
        cards: this.cards.data.cards,
        options: this.options,
        title: this.title
      }
    }
  
    activateListeners(html){
      let t = this;
      html.find('.hand-mini-bar-window-card').click(function(e){t.minibar.cardClicked(e)});
      html.find('.hand-mini-bar-window-card').contextmenu(function(e){t.minibar.flipCard(e)});
      this.minibar.attachDragDrop(html[0]);
    }
  
    /** @override */
    _getHeaderButtons() {
      let buttons = super._getHeaderButtons();
      let t = this;
      buttons.unshift({
        label: "HANDMINIBAR.OpenCardStack",
        class: "open-stack",
        icon: "fas fa-id-badge",
        onclick: ev => this.minibar.openHand(t.currentCards)
      });
      return buttons
    }
    
  }

  export default HandWindow;