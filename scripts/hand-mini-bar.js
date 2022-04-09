
  /**
   * Card Hand Toolbar to show cards on the main display
   * Author: Pengrath
   */
let HandMiniBarOptions = {
  betterChatMessages: false,
  hideMessages: false,
  tokenMode: false,
  position:"",
  positionDefault:"right_bar"
};

let HandMiniBarConfig = {
  moduleName:"hand-mini-bar",
  eventName:"module.hand-mini-bar",
  updatePostion:function(){
    let position = HandMiniBarOptions.position;
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
  rerender: function(){
    $(handMiniBarHandList).each(function(i, h){
      h.renderCards();
    });
  },
  restore: function(){
    $(handMiniBarHandList).each(function(i, h){
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
     * HTML hool for this hand
     */
    this.html = undefined;
    
    let t = this;
    renderTemplate('modules/hand-mini-bar/templates/hand.html', {id: this.id}).then(
        content => {
            content = $(content);
            content.find('.hand-mini-bar-settings-hand').click(function(e){t.openHand(e)});
            content.find('.hand-mini-bar-settings-choose').click(function(e){t.chooseDialog(e)});
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
    Hooks.on("updateCard", function() {
      t.update();
    });
    
    Hooks.on("deleteCard", function() {
      t.update();
    });
    
    Hooks.on("passCards", function() {
      t.update();
    });

    Hooks.on("updateUser",function(target, data){
      //GM informs others not informaed by players
      if(data.flags !== undefined)
      {
        if(data.flags[HandMiniBarConfig.moduleName] !== undefined){
          t.restore();
        }
      }
    });
  }
  //renders the cards within the hand template
  renderCards(resolve, reject){
    let t = this;
    $('#hand-mini-bar-card-container-' + t.id).empty();
    if(typeof this.currentCards !== "undefined"){
      let length = this.currentCards.data.cards.contents.length;
      if(HandMiniBarOptions.tokenMode){
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
                content.click(function(e){t.playCard(e)});
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
      let handTitle = this.currentCards.data.name;
      /** Do Some Extra GM work here **/
      if(game.user.isGM){
        $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","none");
        let player = this.currentUser;
        if(player !== undefined){
          handTitle = player.data.name + " (" + handTitle + ")";
          let color =  player.data.color;
          $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","0 0 10px " + color);
        }
      }
      $("#hand-mini-bar-hand-name-" + t.id).html(handTitle);
      //Return for the promise if there is nothing to render
      if(length == 0){
        if (resolve){
          resolve();
        }
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
    if(t.currentCards != undefined){
      let cards = game.cards.get(t.currentCards.data._id);
      if(cards != undefined){
        t.currentCards = cards;
        if(t.currentCards != undefined){
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
      }
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
        dragstart:   function(event) {
          const id = $(event.currentTarget).data("card-id");
          const card = t.currentCards.data.cards.get(id);
          if ( !card ) return;
      
          // Create drag data
          const dragData = {
            id: card.id,//id required
            type: "Card",
            cardsId: t.currentCards.data._id,
            cardId: card.id
          };
      
          // Set data transfer
          event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        },

        drop: function(event){
          const data = TextEditor.getDragEventData(event);
          if ( data.type !== "Card" ) return;
          const source = game.cards.get(data.cardsId);
          const card = source.cards.get(data.cardId);
          //if the card does not already exist in this hand then pass it to it
          let exists = t.currentCards.cards.filter(c => c.id === card.id);
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
            return card.pass(t.currentCards, { chatNotification: !HandMiniBarOptions.hideMessages }).then(
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
      } 
    });
    dragDrop.bind(t.html[0]);
  }
  /**@TODO do more work if isGM */
  //sets and renders the cards based on users choice
  setCardsOption(choice){
    this.currentCards = choice;
    this.storeCardsID(this.currentCards.data._id);
    this.update();
    if(game.user.isGM && this.currentUser != undefined){
      this.currentUser.setFlag(HandMiniBarConfig.moduleName,'CardsID-0' , this.currentCards.data._id);
    }
  }
  //sets the user, only available to GMs
  setUserOption(choice){
    this.currentUser = choice;
    this.storeUserID(this.currentUser.data._id);
    this.update();
    if(game.user.isGM && this.currentCards != undefined){
      this.currentUser.setFlag(HandMiniBarConfig.moduleName,'CardsID-0', this.currentCards.data._id);
    }
  }
  //sets and renders the cards based on the id
  setCardsID(id){
    let cards = game.cards.get(id);
    if(cards != undefined){
      this.currentCards = cards;
      if(this.currentCards != undefined){
        this.update();
      }
    }
  }
  //sets and renders the cards based on the id
  setUserID(id){
    let user = game.users.get(id);
    if(user != undefined){
      this.currentUser = user;
    }
  }
  async chooseDialog(){
      if(game.user.isGM){
        let t = this;
        let d = new Dialog({
          title: game.i18n.localize("HANDMINIBAR.ChooseForGMTitle"),
          content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseForGMQuestion") + '</p>',
          buttons: [{
            label: "Player", 
            callback:function(){
              t.chooseUserDialog();
          }},{
            label:"Hand",
            callback:function(){
              t.chooseHandDialog();
            }
          }]
        });
        d.render(true);
      }else{
        this.chooseHandDialog();
      }
  }
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
      const html = await renderTemplate("modules/hand-mini-bar/templates/dialog-play.html", {card, cards, cardMode: !HandMiniBarOptions.tokenMode});
    
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
          const options = {action: "play", chatNotification:!HandMiniBarOptions.hideMessages, updateData: fd.down ? {face: null} : {}};

           
          if(HandMiniBarOptions.betterChatMessages){

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
    if(HandMiniBarOptions.tokenMode){
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
        const options = { chatNotification: !HandMiniBarOptions.hideMessages, how: fd.how, updateData: fd.down ? {face: null} : {}};
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
     yes: () => this.currentCards.reset({ chatNotification: !HandMiniBarOptions.hideMessages }),
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
        const options = {action: "pass", chatNotification:!HandMiniBarOptions.hideMessages, how: fd.how, updateData: fd.down ? {face: null} : {}};
        return currentCards.deal([to], fd.number, options).catch(err => {
          ui.notifications.error(err.message);
          return currentCards;
        });
      },
      rejectClose: false,
      options: {jQuery: false}
    });
  }
  //Gets any stored CardsID 
  restore(){
    this.setCardsID(this.getStoredCardsID());
    this.setUserID(this.getStoredUserID());
    this.update();
  }
  //stores the current cards ID
  storeCardsID(id){
    game.user.setFlag(HandMiniBarConfig.moduleName,'CardsID-' + this.id, id);
  }
  //reset the current cards ID
  resetCardsID(){
    game.user.setFlag(HandMiniBarConfig.moduleName,'CardsID-' + this.id, "");
  }
  //gets the previously selected cards ID
  getStoredCardsID(){
    return game.user.getFlag(HandMiniBarConfig.moduleName,'CardsID-' + this.id);
  }

  //stores the User (for GMs)
  storeUserID(id){
    game.user.setFlag(HandMiniBarConfig.moduleName,'UserID-' + this.id, id);
  }
  //reset the User (for GMs)
  resetUserID(){
    game.user.setFlag(HandMiniBarConfig.moduleName,'UserID-' + this.id, "");
  }
  //gets the User (for GMs)
  getStoredUserID(){
    return game.user.getFlag(HandMiniBarConfig.moduleName,'UserID-' + this.id);
  }

  //Removes the html element from the screen
  remove(){
    if(this.html){
      this.html.remove();
    }
  }
}
const handMiniBarHandList = new Array();
const handMiniBarHandMax = 10;

Hooks.on("init", function() {
  game.settings.register(HandMiniBarConfig.moduleName, 'HandCount', {
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
    onChange: value => { // value is the new value of the setting
      if (value > handMiniBarHandMax){
        value = handMiniBarHandMax;
      }
      //add more
      if(value == handMiniBarHandList.length){
        //do nothing
      }else if(value > handMiniBarHandList.length){
        let more = value - handMiniBarHandList.length ;
        for(let i = 0; i < more; i++){
          handMiniBarHandList.push(new HandMiniBar(handMiniBarHandList.length));
        }
      }else{//remove some may need additional cleanup
        let less =  handMiniBarHandList.length - value;
        for(let i = 0; i < less; i++){
          handMiniBarHandList.pop().remove();
        }
      }
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarConfig.moduleName, 'DisplayHandName', {
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
  game.settings.register(HandMiniBarConfig.moduleName, 'BetterChatMessages', {
    name: game.i18n.localize("HANDMINIBAR.BetterChatMessagesSetting"),
    hint: game.i18n.localize("HANDMINIBAR.BetterChatMessagesSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: true,
    onChange: value => { // value is the new value of the setting
      HandMiniBarOptions.betterChatMessages = value;
      
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarConfig.moduleName, 'HideMessages', {
    name: game.i18n.localize("HANDMINIBAR.HideMessagesSetting"),
    hint: game.i18n.localize("HANDMINIBAR.HideMessagesSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: true,
    onChange: value => { // value is the new value of the setting
      HandMiniBarOptions.hideMessages = value;
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarConfig.moduleName, 'TokenOnlyMode', {
    name: game.i18n.localize("HANDMINIBAR.TokenModeSetting"),
    hint: game.i18n.localize("HANDMINIBAR.TokenModeSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: false,
    onChange: value => { // value is the new value of the setting
      HandMiniBarOptions.tokenMode = value;
      socket.emit(HandMiniBarConfig.eventName, {'action': 'rerender'});
      HandMiniBarConfig.reRender();
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarConfig.moduleName, 'BarPosition', {
    name: game.i18n.localize("HANDMINIBAR.BarPositionSetting"),
    hint: game.i18n.localize("HANDMINIBAR.BarPositionSettingHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: String,       // Number, Boolean, String,
    choices: {
      "above_players":  game.i18n.localize("HANDMINIBAR.BarPositionAbovePlayersSetting"),
      "right_bar":  game.i18n.localize("HANDMINIBAR.BarPositionRightMacroSetting"),
      "left_bar": game.i18n.localize("HANDMINIBAR.BarPositionLeftMacroSetting")
    },
    default: "right_bar",
    onChange: value => { // value is the new value of the setting
      HandMiniBarOptions.position = value;
      HandMiniBarConfig.updatePostion();
      socket.emit(HandMiniBarConfig.eventName, {'action': 'reposition'});
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
  // Creates the outer container above the players list area
  renderTemplate('modules/hand-mini-bar/templates/hand-container.html', {}).then(
      content => {
          content = $(content);
          $("#ui-bottom").append(content);

          HandMiniBarOptions.position = game.settings.get(HandMiniBarConfig.moduleName, "BarPosition");
          HandMiniBarConfig.updatePostion();

          let count = game.settings.get(HandMiniBarConfig.moduleName, "HandCount");
          count = count ? count : 0;
          if (count > handMiniBarHandMax){
            count = handMiniBarHandMax;
          }
          for(let i = 0; i < count; i++){
            handMiniBarHandList.push(new HandMiniBar(i));
          }
          if(game.settings.get(HandMiniBarConfig.moduleName, "DisplayHandName") == true){
            $("#hand-mini-bar-container").addClass("show-names");
          }
          $(".hand-mini-bar-hide-show").click(function(){
            $("#hand-mini-bar-container").toggleClass("hidden");
            $(".hand-mini-bar-hide-show").toggleClass("show");
          });
          //initialize Options from saved settings
          if(game.settings.get(HandMiniBarConfig.moduleName, "HideMessages") == true){
            HandMiniBarOptions.hideMessages = true;
          }
          if(game.settings.get(HandMiniBarConfig.moduleName, "BetterChatMessages") == true){
            HandMiniBarOptions.betterChatMessages = true;
          }
          if(game.settings.get(HandMiniBarConfig.moduleName, "TokenOnlyMode") == true){
            HandMiniBarOptions.tokenMode = true;
          }
          socket.on(HandMiniBarConfig.eventName, data => {
            console.log(data)
            if(data.action === "rerender"){
              HandMiniBarConfig.rerender();
            }
            else if(data.action === "reposition"){
              HandMiniBarConfig.updatePostion();
            }
            else if(data.action === "reload"){
              HandMiniBarConfig.restore();
            }
          });
      }
  )
});
