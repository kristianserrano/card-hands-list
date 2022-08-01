
  /**
   * Card Hand Toolbar to show cards on the main display
   * Author: pengrath
   */
CONFIG.HandMiniBar = {};
CONFIG.HandMiniBar.options = {
  betterChatMessages: false,
  hideMessages: false,
  faceUpMode: false,
  position:"",
  positionDefault:"right_bar",
  cardClick:"play_card"
};

class HandWindow extends FormApplication {
  constructor(minibar) {
    super(cards, {});
    this.cards = minibar.currentCards;
    this.minibar = minibar;
    console.log(cards);
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

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    return {
      cards: this.cards.data.cards,
      options: this.options,
      title: this.title
    }
  }

  activateListeners(html){
    let minibar = this.minibar;
    html.find('.hand-mini-bar-window-card').click(function(e){minibar.cardClicked(e)});
    
  }

  /** @override */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();
    buttons.unshift({
      label: "HANDMINIBAR.OpenCardStack",
      class: "open-stack",
      icon: "fas fa-id-badge",
      onclick: ev => this.minibar.openHand()
    });
    return buttons
  }
  
}

const HandMiniBarModule = {
  handMiniBarList: new Array(),
  moduleName:"hand-mini-bar",
  eventName:"module.hand-mini-bar",
  handMax: 10,
  updatePostion:function(){
    let position = CONFIG.HandMiniBar.options.position;
    let content = $("#hand-mini-bar-container ").detach();
    //reset classes
    $("#ui-bottom").removeClass("hand-mini-bar-left");
    $("#ui-bottom").removeClass("hand-mini-bar-right");
    $("#ui-bottom").removeClass("hand-mini-bar");


    if (position === "left_bar"){
      $("#ui-bottom").addClass("hand-mini-bar-left");
      $("#ui-bottom").addClass("hand-mini-bar");
      $("#ui-bottom").append(content);
    }else if(position === "right_bar"){
      $("#ui-bottom").addClass("hand-mini-bar-right");
      $("#ui-bottom").addClass("hand-mini-bar");
      $("#ui-bottom").append(content);
    }else{
      $("#players").before(content);
      //above players
    }
  },
  updateHandCount: function(value){ // value is the new value of the setting
    if (value > HandMiniBarModule.handMax){
      value = HandMiniBarModule.handMax;
    }
    //add more
    if(value == HandMiniBarModule.handMiniBarList.length){
      //do nothing
    }else if(value > HandMiniBarModule.handMiniBarList.length){
      let more = value - HandMiniBarModule.handMiniBarList.length ;
      for(let i = 0; i < more; i++){
        HandMiniBarModule.handMiniBarList.push(new HandMiniBar(HandMiniBarModule.handMiniBarList.length));
      }
    }else{//remove some may need additional cleanup
      let less =  HandMiniBarModule.handMiniBarList.length - value;
      for(let i = 0; i < less; i++){
        HandMiniBarModule.handMiniBarList.pop().remove();
      }
    }
  },
  //updates the player hands but with a delay so user flags are correctly set
  updatePlayerHandsDelayed: function(){
    setTimeout(function(){
      HandMiniBarModule.updatePlayerHands();
    },500);
  },
  //updates the player hands that are owned by other players (the DM)
  updatePlayerHands: function(){
    if(game.user.isGM){
      let u = game.user;
      for(let i = 0; i <= HandMiniBarModule.handMiniBarList.length; i++){
        let toolbar = HandMiniBarModule.handMiniBarList[i];
        if(!toolbar){
          break;
        }
        let uID = u.getFlag(HandMiniBarModule.moduleName,'UserID-' + toolbar.id);
        if(!!uID){
          let cardsID = game.users.get(uID).getFlag(HandMiniBarModule.moduleName,"CardsID-0");
          let changed = false;
          if(!!cardsID){
            u.setFlag(HandMiniBarModule.moduleName,'CardsID-' + toolbar.id, cardsID);
            changed = true;
          }else{
            u.unsetFlag(HandMiniBarModule.moduleName,'CardsID-' + toolbar.id);
            changed=true;
          }
          if(changed){
            if(HandMiniBarModule.handMiniBarList.length > i){
              HandMiniBarModule.handMiniBarList[i].restore();
            }
          }
        }
      }
    }
  },
  rerender: function(){
    $(HandMiniBarModule.handMiniBarList).each(function(i, h){
      h.renderCards();
    });
  },
  restore: function(){
    $(HandMiniBarModule.handMiniBarList).each(function(i, h){
      h.restore();
    });
  }
}
class HandMiniBar{
  constructor(id) {
    /**
     * an integer to identify this hand so we can have multiple on the screen
     */
    this.id = id;

    /**
     * current hand object from FoundryVTT (Cards Object)
     */
    this.currentCards = undefined;

    /**
     * current user used to identify they user associated with the hand for GMs
     */
     this.currentUser = undefined;

    /**
     * Wether or not this object is re-rendering
     */
    this.updating = false;

    /**
     * HTML hook for this hand
     */
    this.html = undefined;
    
    let t = this;
    renderTemplate('modules/hand-mini-bar/templates/hand.html', {id: this.id}).then(
        content => {
            content = $(content);
            content.find('.hand-mini-bar-settings-hand').click(function(e){t.openHandWindow(e)});
            content.find('.hand-mini-bar-settings-choose').click(function(e){t.chooseDialog(e)});
            content.find('.hand-mini-bar-settings-choose').contextmenu(function(e){t.resetToolbarDialog(e)});
            content.find('.hand-mini-bar-pass').click(function(e){t.passCards(e)});
            content.find('.hand-mini-bar-pass').contextmenu(function(e){t.resetHand(e)});
            content.find('.hand-mini-bar-draw').click(function(e){t.drawCard(e)});
            $('#hand-mini-bar-hands-container').prepend(content);
            t.restore();
            t.html = content;
        }
    )

    /**
     * Hooks to listen to changes in this hand
     * Useful: CONFIG.debug.hooks = true
     */
    Hooks.on("updateCard", function(target, data) {
      if(!!data.drawn || data.sort !== undefined || data.face !== undefined){
        t.update();
      }
    });
    
    Hooks.on("deleteCard", function(target) {
      if(!!target && !!target.parent && (!!t.currentCards && target.parent.data._id == t.currentCards.data._id)){
        t.update();
      }
    });

    Hooks.on("createCard", function(target) {
      if(!!target && !!target.parent && (!!t.currentCards && target.parent.data._id == t.currentCards.data._id)){
        t.update();
      }
    });

    Hooks.on("updateUser",function(target, data){
      //GM informs others not informaed by players
      if(data != undefined && data.flags !== undefined)
      {
        if(data.flags[HandMiniBarModule.moduleName] !== undefined){
          t.restore();
        }
      }
      if(game.user.isGM && data != undefined && data.color != undefined){
        t.restore();
      }
    });
    //auto register to listen for updates
    HandMiniBarModule.handMiniBarList.push(this);
  }
  //renders the cards within the hand template
  renderCards(resolve, reject){
    let t = this;
    let length = 0;
    if(typeof this.currentCards !== "undefined"){
      $('#hand-mini-bar-card-container-' + t.id).empty();
      length = this.currentCards.data.cards.contents.length;
      if(CONFIG.HandMiniBar.options.faceUpMode){
        // Check to make sure all the cards are flipped over to their face
        $(this.currentCards.data.cards.contents.sort(this.cardSort)).each(function(i,c){
          if(c.face == null){
            c.flip();
          }
        });
      }
      $(this.currentCards.data.cards.contents.sort(this.cardSort)).each(function(i,c){
        let renderData = {
          id: c.data._id,
          back: (c.face == null),
          img: (c.face !== null) ? c.face.img : c.back.img,
          name:(c.face !== null) ? c.data.name : game.i18n.localize("HANDMINIBAR.CardBack"),
        };
        renderTemplate('modules/hand-mini-bar/templates/card.html', renderData).then(
            content => {
                content = $(content);
                content.click(function(e){t.cardClicked(e)});
                content.contextmenu(function(e){t.flipCard(e)});
                $('#hand-mini-bar-card-container-' + t.id).append(content);
                if(i == length - 1){
                  if (resolve){
                    //Return for the promise
                    resolve();
                  }
                }
            }
        )
      });
    }

    this.updateTitle();
    this.updatePlayerColor();
    //Return for the promise if there is nothing to render
    if(length == 0){
      if (resolve){
        resolve();
      }
    }
  }
  cardSort(a, b){
    if(a.data.sort < b.data.sort) return 1;
    if(a.data.sort > b.data.sort) return -1;
    return 0;
  }
  update(){
    let t = this;
    if(!!t.currentCards){
      if(!t.updating)
      {
        t.updating = true;
        const myPromise = new Promise((resolve, reject) => {
          t.renderCards(resolve, reject);
        });

        myPromise
        .then(t.attachDragDrop.bind(t))
        .then(function(){
          t.updating = false;
          },function(){
            t.updating = false;//even on error still finish updating
        });
      }
      else{
        setTimeout(function(){
          //continue to try to update the hand
          t.update();
        },500);
      }
    }
    else{
      //check if player is selected but not a hand yet then display color and player name
      this.updateTitle();
      this.updatePlayerColor();
      renderTemplate('modules/hand-mini-bar/templates/empty-hand-message.html', {}).then(
          content => {
            $("#hand-mini-bar-card-container-" + t.id).html(content);
            t.updatePlayerColor();
      });
    }
  }
  //Attach for dragging cards from the toolbar
  attachDragDrop(){
    let t = this;
    let dragDrop = new DragDrop({
      dragSelector: ".hand-mini-bar-card",
      dropSelector: undefined,
      permissions: { dragstart: function(selector) {return true;}},
      callbacks: { 
        dragstart: t.drag.bind(t),
        drop: t.drop.bind(t)
      }
    });
    dragDrop.bind(t.html[0]);
  }
  drag(event) {
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
  drop(event){
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
  //sets and renders the cards based on users choice
  setCardsOption(choice){
    this.currentCards = choice;
    if(!choice){
      this.resetCardsID();
      if(game.user.isGM && this.currentUser != undefined){
        this.currentUser.unsetFlag(HandMiniBarModule.moduleName,'CardsID-0');
      }
    }else{
      this.storeCardsID(this.currentCards.data._id);
      if(game.user.isGM && this.currentUser != undefined){
        this.currentUser.setFlag(HandMiniBarModule.moduleName,'CardsID-0' , this.currentCards.data._id);
      }
    }
    this.update();
    //if this is the first hand then make sure it's updated for DMs
    if(this.id == 0){
      socket.emit(HandMiniBarModule.eventName, {'action': 'updatePlayers'});
    }
    HandMiniBarModule.updatePlayerHandsDelayed();
  }
  //sets the user, only available to GMs
  setUserOption(choice){
    this.currentUser = choice;
    this.storeUserID(this.currentUser.data._id);
    this.update();
    if(game.user.isGM){
      //check to see if user has a hand selected already
      let id = this.currentUser.getFlag(HandMiniBarModule.moduleName,'CardsID-0');
      if(!!id){
        this.storeCardsID(id);
        this.setCardsID(id)
      }
    }
  }
  //sets and renders the cards based on the id
  setCardsID(id){
    if(!id){
      this.currentCards = undefined;
    }else{
      let cards = game.cards.get(id);
      if(cards != undefined){
        this.currentCards = cards;
        if(this.currentCards != undefined){
          this.update();
        }
      }
    }
  }
  //sets and renders the cards based on the id
  setUserID(id){
    if(!id){
      this.currentUser = undefined;
    }else{
      let user = game.users.get(id);
      if(user != undefined){
        this.currentUser = user;
      }
    }
  }
  async chooseDialog(){
    let t = this;
    //options based on state and GM status
    let buttons = [{
      label:game.i18n.localize("HANDMINIBAR.Hand"),
      callback:function(){
        t.chooseHandDialog();
      }
    }];

    if(game.user.isGM){
      buttons.push({
        label:game.i18n.localize("HANDMINIBAR.Player"),
        callback:function(){
          t.chooseUserDialog();
      }});
    }

    if(this.currentCards != undefined || this.currentUser != undefined){
      buttons.push({
        label:game.i18n.localize("HANDMINIBAR.ResetBar"),
        callback:function(){
          t.reset();
        }
      });
    }

    if(buttons.length === 1){//if only 1 option then move along to the hand dialog no other options
      this.chooseHandDialog();
    }else{
      let d = new Dialog({
        title: game.i18n.localize("HANDMINIBAR.ChooseForGMTitle"),
        content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseForGMQuestion") + '</p>',
        buttons: buttons
      });
      d.render(true);
    }
  }
  //The GM is a able to select a user for each Toolbar
  async chooseUserDialog(){
    let usersAvailable = {};
    let t = this;
    let userChosen = function(choice){
      t.setUserOption(choice);
    };
    game.users.forEach(async function(c){
          usersAvailable[c.name] = {
            label: c.data.name,
            callback: function(){userChosen(c)}
          };
    });
    let d = new Dialog({
      title: game.i18n.localize("HANDMINIBAR.UserList"),
      content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseUser") + '</p>',
      buttons: usersAvailable
    });
    d.render(true);
  }
  //Select a hand for this Toolbar
  async chooseHandDialog(){
    let handsAvailable = {};
    let t = this;
    let handChosen = function(choice){
      t.setCardsOption(choice);
    };
    let count = 0;
    game.cards.forEach(async function(c){
      if((c.permission == CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER ||
         c.permission == CONST.DOCUMENT_PERMISSION_LEVELS.OWNER) &&
         c.type == "hand"){
          count++;
          handsAvailable[c.name] = {
            icon: '<img src="' + c.thumbnail + '"></img>',
            label: c.name,
            callback: function(){handChosen(c)}
          };
      }
    });
    //The ability to set "No Hand" to this toolbar
    handsAvailable[game.i18n.localize("HANDMINIBAR.NoHand")] = {
      label: game.i18n.localize("HANDMINIBAR.NoHand"),
      callback: function(){handChosen(undefined)}
    };
    if(count == 0){
      ui.notifications.info( game.i18n.localize("HANDMINIBAR.NoAvailableHands"));
    }else{
      let d = new Dialog({
        title: game.i18n.localize("HANDMINIBAR.DeckList"),
        content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseHand") + '</p>',
        buttons: handsAvailable
      });
      d.render(true);
    }
  }
  async resetToolbarDialog(){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    let d = Dialog.confirm({
     title: game.i18n.localize("HANDMINIBAR.ResetToolbarDialogTitle"),
     content: "<p>" + game.i18n.localize("HANDMINIBAR.ResetToolbarDialogQuestion") + "</p>",
     yes: () => this.reset(),
     no: function(){},//do nothing
     defaultYes: true
    });
    d.render(true);
  }
  //Opens a Window with larger cards
  async openHandWindow(){
    new HandWindow(this).render(true);
  }
  //Opens the hand for any additional options
  async openHand(){
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
  //one of the cards was clicked, based on options pick what to do
  async cardClicked(e){
    let option = CONFIG.HandMiniBar.options.cardClick;
    if(option === "play_card"){
      this.playCard(e);
    }else if(option === "open_hand"){
      this.openHand();
    } else if(option === "card_image"){
      let id = $(e.target).data("card-id");
      let card = this.currentCards.data.cards.get(id);
      this.showCardImage(card);
    }
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
  //Plays the card the player clicked on
  async playCard(e){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    let id = $(e.target).data("card-id");
    let card = this.currentCards.data.cards.get(id);
    this.playDialog(card);
  }
  async playDialog(card){
      const cards = game.cards.filter(c => (c !== this.currentCards) && (c.type !== "deck") && c.testUserPermission(game.user, "LIMITED"));
      if ( !cards.length ) return ui.notifications.warn("CARDS.PassWarnNoTargets", {localize: true});
  
      // Construct the dialog HTML
      const html = await renderTemplate("modules/hand-mini-bar/templates/dialog-play.html", {card, cards, notFaceUpMode: !CONFIG.HandMiniBar.options.faceUpMode});
    
      const currentCards = this.currentCards;
      // Display the prompt
      Dialog.prompt({
        title: game.i18n.localize("CARD.Play"),
        label: game.i18n.localize("CARD.Play"),
        content: html,
        callback: html => {
          const form = html.querySelector("form.cards-dialog");
          const fd = new FormDataExtended(form).toObject();
          const to = game.cards.get(fd.to);
          //override chat notification here
          const options = {action: "play", chatNotification:!CONFIG.HandMiniBar.options.hideMessages, updateData: fd.down ? {face: null} : {}};

           
          if(CONFIG.HandMiniBar.options.betterChatMessages){

            let created = currentCards.pass(to, [card.id], options).catch(err => {
              return ui.notifications.error(err.message);
            });
            let renderData = {
              id: card.data._id,
              back: (card.face == null),
              img: (card.face !== null) ? card.face.img : card.back.img,
              name:(card.face !== null) ? card.data.name : game.i18n.localize("HANDMINIBAR.CardHidden"),
              description: (card.face !== null) ? card.data.description : null,
              action: "Played"
            };
            renderTemplate('modules/hand-mini-bar/templates/chat-message.html', renderData).then(
              content => {
                const messageData = {
                    speaker: {
                        scene: game.scenes?.active?.id,
                        actor: game.userId,
                        token: null,
                        alias: null,
                    },
                    content: content,
                };
                ChatMessage.create(messageData);

            });
            return created;
          }
          else{
            return card.pass(to, [card.id], options).catch(err => {
              ui.notifications.error(err.message);
              return card;
            });
          }
        },
        rejectClose: false,
        options: {jQuery: false}
      });
  }
  //Flip the card the player right clicked on
  async flipCard(e){
    if(CONFIG.HandMiniBar.options.faceUpMode){
      return;// do not flip when in token mode
    }
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    let id = $(e.target).data("card-id");
    let card = this.currentCards.data.cards.get(id);
    card.flip();
    
  }
  //Draws a card into this hand
  async drawCard(e){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    this.drawDialog();
  }
  async drawDialog() {
    const decks = game.cards.filter(c => (c.type === "deck") && c.testUserPermission(game.user, "LIMITED"));
    if ( !decks.length ) return ui.notifications.warn("CARDS.DrawWarnNoSources", {localize: true});

    // Construct the dialog HTML
    const html = await renderTemplate("templates/cards/dialog-draw.html", {
      decks: decks,
      modes: {
        [CONST.CARD_DRAW_MODES.TOP]: "CARDS.DrawModeTop",
        [CONST.CARD_DRAW_MODES.BOTTOM]: "CARDS.DrawModeBottom",
        [CONST.CARD_DRAW_MODES.RANDOM]: "CARDS.DrawModeRandom",
      }
    });
    let currentCards = this.currentCards;
    // Display the prompt
    return Dialog.prompt({
      title: game.i18n.localize("CARDS.DrawTitle"),
      label: game.i18n.localize("CARDS.Draw"),
      content: html,
      callback: html => {
        const form = html.querySelector("form.cards-dialog");
        const fd = new FormDataExtended(form).toObject();
        const from = game.cards.get(fd.from);
        const options = { chatNotification: !CONFIG.HandMiniBar.options.hideMessages, how: fd.how, updateData: fd.down ? {face: null} : {}};
        return currentCards.draw(from, fd.number, options).catch(err => {
          ui.notifications.error(err.message);
          return [];
        });
      },
      rejectClose: false,
      options: {jQuery: false}
    });
  }
  //Resets this hand
  async resetHand(e){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    let d = Dialog.confirm({
     title: game.i18n.localize("HANDMINIBAR.ResetHandConfirmTitle"),
     content: "<p>" + game.i18n.localize("HANDMINIBAR.ResetHandConfirmQuestion") + "</p>",
     yes: () => this.currentCards.reset({ chatNotification: !CONFIG.HandMiniBar.options.hideMessages }),
     no: function(){},//do nothing
     defaultYes: true
    });
  }
  //Brings up the pass cards dialog
  async passCards(e){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    this.passDialog();
  }
  async passDialog() {
    const cards = game.cards.filter(c => (c !== this) && (c.type !== "deck") && c.testUserPermission(game.user, "LIMITED"));
    if ( !cards.length ) return ui.notifications.warn("CARDS.PassWarnNoTargets", {localize: true});

    // Construct the dialog HTML
    const html = await renderTemplate("templates/cards/dialog-pass.html", {
      cards: cards,
      modes: {
        [CONST.CARD_DRAW_MODES.TOP]: "CARDS.DrawModeTop",
        [CONST.CARD_DRAW_MODES.BOTTOM]: "CARDS.DrawModeBottom",
        [CONST.CARD_DRAW_MODES.RANDOM]: "CARDS.DrawModeRandom",
      }
    });
    let currentCards = this.currentCards;
    // Display the prompt
    return Dialog.prompt({
      title: game.i18n.localize("CARDS.PassTitle"),
      label: game.i18n.localize("CARDS.Pass"),
      content: html,
      callback: html => {
        const form = html.querySelector("form.cards-dialog");
        const fd = new FormDataExtended(form).toObject();
        const to = game.cards.get(fd.to);
        const options = {action: "pass", chatNotification:!CONFIG.HandMiniBar.options.hideMessages, how: fd.how, updateData: fd.down ? {face: null} : {}};
        return currentCards.deal([to], fd.number, options).catch(err => {
          ui.notifications.error(err.message);
          return currentCards;
        });
      },
      rejectClose: false,
      options: {jQuery: false}
    });
  }

  //updates the title of the bar
  updateTitle(){
    let t = this;
    let handTitle = "";
    if(typeof this.currentCards !== "undefined"){
      handTitle = this.currentCards.data.name;
    }
    /** Do Some Extra GM work here **/
    if(game.user.isGM){
      if(!!this.currentUser && this.currentUser.data.name != handTitle){
        if(handTitle != ""){
          handTitle = this.currentUser.data.name + " (" + handTitle + ")";
        }else{
          handTitle = this.currentUser.data.name;
        }
      }
    }
    $("#hand-mini-bar-hand-name-" + t.id).html(handTitle);
  }

  //Only tries to update the player color if GM this may change in the future
  updatePlayerColor(){
    if(game.user.isGM){
      if(!!this.currentUser){
        let color =  this.currentUser.data.color;
        $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","0 0 10px " + color);
      }else{
        $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","none");
      }
    }
  }
  //Gets any stored CardsID 
  restore(){
    this.setCardsID(this.getStoredCardsID());
    this.setUserID(this.getStoredUserID());
    this.update();
  }
  //stores the current cards ID
  storeCardsID(id){
    game.user.setFlag(HandMiniBarModule.moduleName,'CardsID-' + this.id, id);
  }
  //reset the current cards ID
  resetCardsID(){
    game.user.unsetFlag(HandMiniBarModule.moduleName,'CardsID-' + this.id);
    this.currentCards = undefined;
  }
  //gets the previously selected cards ID
  getStoredCardsID(){
    return game.user.getFlag(HandMiniBarModule.moduleName,'CardsID-' + this.id);
  }

  //stores the User (for GMs)
  storeUserID(id){
    game.user.setFlag(HandMiniBarModule.moduleName,'UserID-' + this.id, id);
  }
  //reset the User (for GMs)
  resetUserID(){
    game.user.unsetFlag(HandMiniBarModule.moduleName,'UserID-' + this.id);
    this.currentUser = undefined;
  }
  //gets the User (for GMs)
  getStoredUserID(){
    return game.user.getFlag(HandMiniBarModule.moduleName,'UserID-' + this.id);
  }
  //Resets the Toolbar 
  reset(){
    let t = this;
    this.resetCardsID();
    this.resetUserID();
    //if this is the first hand then make sure it's updated for GMs
    if(t.id == 0){
      socket.emit(HandMiniBarModule.eventName, {'action': 'updatePlayers'});
    }
    HandMiniBarModule.updatePlayerHandsDelayed();
  }

  //Removes the html element from the screen
  remove(){
    if(this.html){
      this.html.remove();
    }
  }
}

//Attach to Foundry's CONFIG
CONFIG.HandMiniBar.documentClass = HandMiniBar;

Hooks.on("init", function() {
  Handlebars.registerHelper('breaklines', function(text) {
      text = Handlebars.Utils.escapeExpression(text);
      text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
      return new Handlebars.SafeString(text);
  });
  game.settings.register(HandMiniBarModule.moduleName, 'HandCount', {
    name: game.i18n.localize("HANDMINIBAR.HandCountSetting"),
    hint: game.i18n.localize("HANDMINIBAR.HandCountSettingHint"),
    scope: 'client',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Number,       // Number, Boolean, String,
    default: 1,
    range: {             // If range is specified, the resulting setting will be a range slider
      min: 0,
      max: 10,
      step: 1
    },
    onChange: HandMiniBarModule.updateHandCount,
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'DisplayHandName', {
    name: game.i18n.localize("HANDMINIBAR.DisplayHandNameSetting"),
    hint: game.i18n.localize("HANDMINIBAR.DisplayHandNameSettingHint"),
    scope: 'client',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: false,
    onChange: value => { // value is the new value of the setting
      (value == true) ?  $("#hand-mini-bar-container").addClass("show-names") :  $("#hand-mini-bar-container").removeClass("show-names");
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'BetterChatMessages', {
    name: game.i18n.localize("HANDMINIBAR.BetterChatMessagesSetting"),
    hint: game.i18n.localize("HANDMINIBAR.BetterChatMessagesSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: true,
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.betterChatMessages = value;
      
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'HideMessages', {
    name: game.i18n.localize("HANDMINIBAR.HideMessagesSetting"),
    hint: game.i18n.localize("HANDMINIBAR.HideMessagesSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: true,
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.hideMessages = value;
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'FaceUpMode', {
    name: game.i18n.localize("HANDMINIBAR.FaceUpModeSetting"),
    hint: game.i18n.localize("HANDMINIBAR.FaceUpModeSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: false,
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.faceupMode = value;
      socket.emit(HandMiniBarModule.eventName, {'action': 'rerender'});
      HandMiniBarModule.reRender();
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'BarPosition', {
    name: game.i18n.localize("HANDMINIBAR.BarPositionSetting"),
    hint: game.i18n.localize("HANDMINIBAR.BarPositionSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: String,       // Number, Boolean, String,
    choices: {
      "right_bar":  game.i18n.localize("HANDMINIBAR.BarPositionRightMacroSetting"),
      "left_bar": game.i18n.localize("HANDMINIBAR.BarPositionLeftMacroSetting"),
      "above_players":  game.i18n.localize("HANDMINIBAR.BarPositionAbovePlayersSetting")
    },
    default: "right_bar",
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.position = value;
      HandMiniBarModule.updatePostion();
      socket.emit(HandMiniBarModule.eventName, {'action': 'reposition'});
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'CardClick', {
    name: game.i18n.localize("HANDMINIBAR.CardClickBehavior"),
    hint: game.i18n.localize("HANDMINIBAR.CardClickBehaviorHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: String,       // Number, Boolean, String,
    choices: {
      "play_card":  game.i18n.localize("HANDMINIBAR.CardClickPlayCard"),
      "open_hand": game.i18n.localize("HANDMINIBAR.CardClickOpenHand"),
      "card_image":  game.i18n.localize("HANDMINIBAR.CardClickCardImage")
    },
    default: "play_card",
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.cardClick = value;
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
});
Hooks.on("ready", function() {
  // Pre Load templates.
  const templatePaths = ['modules/hand-mini-bar/templates/hand.html',
  'modules/hand-mini-bar/templates/card.html'];
  loadTemplates(templatePaths).then(() => {
    console.log("Better Hand templates preloaded")
  });
  // Creates the outer container
  renderTemplate('modules/hand-mini-bar/templates/hand-container.html', {}).then(
      content => {
          content = $(content);
          $("#ui-bottom").append(content);

          CONFIG.HandMiniBar.options.position = game.settings.get(HandMiniBarModule.moduleName, "BarPosition");
          HandMiniBarModule.updatePostion();

          let count = game.settings.get(HandMiniBarModule.moduleName, "HandCount");
          count = count ? count : 0;
          if (count > HandMiniBarModule.handMax){
            count = HandMiniBarModule.handMax;
          }
          for(let i = 0; i < count; i++){
            new HandMiniBar(i);
          }
          if(game.settings.get(HandMiniBarModule.moduleName, "DisplayHandName") == true){
            $("#hand-mini-bar-container").addClass("show-names");
          }
          $(".hand-mini-bar-hide-show").click(function(){
            $("#hand-mini-bar-container").toggleClass("hidden");
            $(".hand-mini-bar-hide-show").toggleClass("show");
          });
          $(".hand-mini-bar-add-bar").click(function(){
            let value =game.settings.get(HandMiniBarModule.moduleName,'HandCount') + 1;
            if(value < HandMiniBarModule.handMax + 1){
              game.settings.set(HandMiniBarModule.moduleName,'HandCount', value);
              HandMiniBarModule.updateHandCount(value);
            }
          });
          $(".hand-mini-bar-subtract-bar").click(function(){
            let value = game.settings.get(HandMiniBarModule.moduleName,'HandCount') - 1;
            if(value > 0){
              game.settings.set(HandMiniBarModule.moduleName,'HandCount', value);
              HandMiniBarModule.updateHandCount(value);
            }
          });
          //popup card image on message click
          $(document).on("click",".hand-mini-bar-message-card", function(e){
              let t = $(e.target);
              let src = t.data("img");
              if(!!src){
                const ip = new ImagePopout(src, {
                  title: t.attr("title"),
                  shareable: true
                });
                ip.render(true);
              }
          });
          //initialize Options from saved settings
          CONFIG.HandMiniBar.options.cardClick = game.settings.get(HandMiniBarModule.moduleName, "CardClick");
          if(game.settings.get(HandMiniBarModule.moduleName, "HideMessages") == true){
            CONFIG.HandMiniBar.options.hideMessages = true;
          }
          if(game.settings.get(HandMiniBarModule.moduleName, "BetterChatMessages") == true){
            CONFIG.HandMiniBar.options.betterChatMessages = true;
          }
          if(game.settings.get(HandMiniBarModule.moduleName, "FaceUpMode") == true){
            CONFIG.HandMiniBar.options.faceUpMode = true;
          }
          socket.on(HandMiniBarModule.eventName, data => {
            if(data.action === "rerender"){
              HandMiniBarModule.rerender();
            }
            else if(data.action === "reposition"){
              HandMiniBarModule.updatePostion();
            }
            else if(data.action === "reload"){
              HandMiniBarModule.restore();
            }
            else if(data.action === "updatePlayers"){
              HandMiniBarModule.updatePlayerHandsDelayed();
            }
          });
          HandMiniBarModule.updatePlayerHands();
      }
  )
});