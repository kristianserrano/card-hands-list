
export default class CardListener{
  contructor(){

  }
  //Attach for dragging cards from the toolbar
  _attachDragDrop(html){
    let t = this;
    let dragDrop = new DragDrop({
      dragSelector: ".hand-mini-bar-card, .hand-mini-bar-window-card",
      dropSelector: undefined,
      permissions: { dragstart: function(selector) {return true;}},
      callbacks: { 
        dragstart: t.drag.bind(t),
        drop: t.drop.bind(t)
      }
    });
    dragDrop.bind(html);
  }
  _drag(event) {
    const id = $(event.currentTarget).data("card-id");
    const card = this.currentCards.data.cards.get(id);
    if ( !card ) return;

    // Create drag data
    const dragData = {
      id: card.id,//id required
      type: "Card",
      cardsId: this.currentCards.data._id,
      cardId: card.id
    };

    // Set data transfer
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }
  _drop(event){
    let t = this;
    const data = TextEditor.getDragEventData(event);
    if ( data.type !== "Card" ) return;
    const source = game.cards.get(data.cardsId);
    const card = source.cards.get(data.cardId);
    //if the card does not already exist in this hand then pass it to it
    let exists = this.currentCards.cards.filter(c => c.id === card.id);
    //SORT
    let sort = function(){
      const closest = event.target.closest("[data-card-id]");
      if(closest){
        const siblings = t.currentCards.cards.filter(c => c.id !== card.id);
        const target = t.currentCards.data.cards.get(closest.dataset.cardId);
        const updateData = SortingHelpers.performIntegerSort(card, {target, siblings}).map(u => {
          return {_id: u.target.id, sort: u.update.sort}
        });
        t.currentCards.updateEmbeddedDocuments("Card", updateData);
      }
    }
    if(exists.length == 0){
      return card.pass(this.currentCards, { chatNotification: !CONFIG.HandMiniBar.options.hideMessages }).then(
        function(){
          sort();
        },function(error){
          ui.notifications.error(error);
        }
      );
    }else{//already a part of the hand, just sort
      sort();
    }
  }


  //one of the cards was clicked, based on options pick what to do
  async _cardClicked(e){
    let id = $(e.target).data("card-id");
    let option = CONFIG.HandMiniBar.options.cardClick;
    if(option === "play_card"){
      let card = this.getCardByID(id);
      this.playCard(card);
    }else if(option === "open_hand"){
      let hand = getHandByID(id);
      this.openHand(hand);
    } else if(option === "card_image"){
      let card = this.getCardByID(id);
      this.showCardImage(card);
    }
  }

  //Flip the card the player right clicked on
  async _flipCard(e){
    if(CONFIG.HandMiniBar.options.faceUpMode){
      return;// do not flip when in token mode
    }
    let id = $(e.target).data("card-id");
    let card = this.getCardByID(id);
    card.flip();
    
  }

  //Plays the card the player clicked on
  async playCard(card){
    let card = this.currentCards.data.cards.get(id);
    this.playDialog(card);
  }

  //Shows the card image
  async showCardImage(card){
    const ip = new ImagePopout(card.img, {
      title: card.name,
      shareable: true,
      uuid: card.uuid
    });
    ip.render(true);
  }

  //Opens the hand for any additional options
  async openHand(hand){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    if (this.currentCards.sheet.rendered) {
      this.currentCards.sheet.close();
    } else {
      this.currentCards.sheet.render(true);
    }
  }

  /** Loop Through the hands to grab the card out 
   * protects against missing hand references **/
  getCardByID(id){
    let card = undefined;
    game.cards.forEach(function(cards){
      if(!card && cards.data.type === "hand"){
        card = cards.data.cards.get(id);
      }
    });
    return card;
  }
  
  /** Loop Through the hands to grab the card out 
   * protects against missing hand references **/
  getHandByCardID(id){
    let hand = undefined;
    game.cards.forEach(function(cards){
      if(!card && cards.data.type === "hand"){
        if(!!cards.data.cards.get(id)){
          hand = cards;
        }
      }
    });
    return hand;
  }
}