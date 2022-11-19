
import HandMiniBar from './hand-mini-bar.js';
import HandMiniBarWindow from './hand-window.js';

/**
 * Card Hand Toolbar to show cards on the main display
 * Author: pengrath
 */
CONFIG.HandMiniBar = {};
CONFIG.HandMiniBar.options = {
  betterChatMessages: false,
  hideMessages: false,
  faceUpMode: false,
  showPlayedPlayerNames: false,
  position:"",
  cardStackShortcut: "",
  positionDefault:"right_bar",
  cardClick:"play_card"
};

window.HandMiniBarModule = {
  handMiniBarList: new Array(),
  moduleName:"hand-mini-bar",
  eventName:"module.hand-mini-bar",
  playerPlayedProp:"player-played",
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
      let changed = false;
      for(let i = 0; i <= HandMiniBarModule.handMiniBarList.length; i++){
        let toolbar = HandMiniBarModule.handMiniBarList[i];
        if(!toolbar){
          break;
        }
        toolbar.updatePlayerBarCount();
        let uID = u.getFlag(HandMiniBarModule.moduleName,'UserID-' + toolbar.id);
        if(!!uID){
          let cardsID = game.users.get(uID).getFlag(HandMiniBarModule.moduleName,"CardsID-" + toolbar.playerBarCount);
          let userCards = u.getFlag(HandMiniBarModule.moduleName,'CardsID-' + toolbar.id);
          if(userCards !== cardsID){
            if(!!cardsID){
              u.setFlag(HandMiniBarModule.moduleName,'CardsID-' + toolbar.id, cardsID);
              changed = true;
            }else{
              u.unsetFlag(HandMiniBarModule.moduleName,'CardsID-' + toolbar.id);
              changed=true;
            }
          }
        }
      }
      if(changed){
        HandMiniBarModule.restore();
      }
    }
  },
  showStackWindow(data){
    if(!data.uuid){
      return ui.notifications.warn( game.i18n.localize("HANDMINIBAR.ShowStackUUIDError"));
    }
    if(!data.users){
      return;
    }

    if(data.users.includes(game.userId)){
      fromUuid(data.uuid).then(
        function(cards){
          new HandMiniBarWindow(cards).render(true);
        }
      ).catch(function(err){
        ui.notifications.warn( game.i18n.localize("HANDMINIBAR.ShowStackError"));
      });
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
  },
  updatePlayerBarCounts(){
    $(HandMiniBarModule.handMiniBarList).each(function(i, h){
      h.updatePlayerBarCount();
    });
  },

  //Opens a Window with larger cards
  async openStackWindow(cards){
    new HandMiniBarWindow(cards).render(true);
  },

  //Attach for dragging cards from the toolbar
  attachDragDrop: function(html){
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
  },
  
  drag: function(event) {
    const id = $(event.currentTarget).data("card-id");
    const cardsid = $(event.currentTarget).data("cards-id");
    const uuid = $(event.currentTarget).data("card-uuid");

    // Create drag data
    const dragData = {
      id: id,//id required
      type: "Card",
      cardsId: cardsid,
      cardId: id,
      uuid: uuid
    };

    // Set data transfer
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  },

  drop: function(event){
    let cards = this.getCards();
    const data = TextEditor.getDragEventData(event);
    if ( data.type !== "Card" ) return;

    //SORT
    let sort = function(card){
      const closest = event.target.closest("[data-card-id]");
      if(closest){
        const siblings = cards.cards.filter(c => c.id ? c.id : c._id !== card.id);
        const target = cards.cards.get(closest.dataset.cardId);
        const updateData = SortingHelpers.performIntegerSort(card, {target, siblings}).map(u => {
          return {_id: u.target.id, sort: u.update.sort}
        });
        cards.updateEmbeddedDocuments("Card", updateData);
      }
    }

    if(data.uuid){
      fromUuid(data.uuid).then(
        function(card){
          if(!card){
            ui.notifications.warn( game.i18n.localize("HANDMINIBAR.DragDropUUIDError"));
          }
          let cardList = [];
          cardList.push(card._id);

          let exists = cards.cards.filter(c => c._id  === card._id);
          if(exists.length == 0){
            card.parent.pass(cards, cardList,{ chatNotification: !CONFIG.HandMiniBar.options.hideMessages })
            .then(function(){
              sort(card);
            }).catch(function(error){
              ui.notifications.warn( game.i18n.localize("HANDMINIBAR.DragDropError"));
            });
          }
          else{
            sort(card);
          }
        }
      ).catch(function(err){
        ui.notifications.warn( game.i18n.localize("HANDMINIBAR.DragDropError"));
      });
    }else{
      const source = game.cards.get(data.cardsId);
      const card = source.cards.get(data.cardId);
      if(typeof card == "Card"){
        ui.notifications.warn( game.i18n.localize("HANDMINIBAR.DragDropObjectError"));
      }
      //if the card does not already exist in this hand then pass it to it
      let exists = cards.cards.filter(c =>  c.id === card.id );
      if(exists.length == 0){
        return card.pass(cards, { chatNotification: !CONFIG.HandMiniBar.options.hideMessages }).then(
          function(){
            sort(card);
          },function(error){
            ui.notifications.error(error);
          }
        );
      }else{//already a part of the hand, just sort
        sort();
      }
    }
  },
  
  //one of the cards was clicked, based on options pick what to do
  cardClicked: async function(cards, card){
    let option = CONFIG.HandMiniBar.options.cardClick;
    if(option === "play_card"){
      this.playDialog(cards, card);
    }else if(option === "open_hand"){
      this.openHand(cards);
    } else if(option === "card_image"){
      this.showCardImage(card);
    }
  },

  //Flip the card the player right clicked on
  flipCard: async function(card){
    if(card.permission !== CONST.DOCUMENT_PERMISSION_LEVELS.OWNER){
      return ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoPermission"));
    }
    card.flip();
  },

  //Flip all cards in hand, deck or pile
  flipAllCards: async function(cards){
    if(cards.permission !== CONST.DOCUMENT_PERMISSION_LEVELS.OWNER){
      return ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoPermission"));
    }
    let aFaceDown = false;
    //check to see if any are flipped over
    cards.cards.forEach(function(card){
      if(aFaceDown == false && card.face == null){
        aFaceDown = true;
      }
    });
    //if flipped over only flip the ones that are faced down
    if(aFaceDown){
      cards.cards.forEach(function(card){
        if(card.face== null){
          card.flip();
        }
      });
    }else{
      cards.cards.forEach(function(card){
        card.flip();
      });
    }
    
  },

  async playDialog(currentCards, card){
    //list of cards that can be passed to
    const cards = game.cards.filter(c => (c !== currentCards) && (c.type !== "deck") && c.testUserPermission(game.user, "LIMITED"));
    if ( !cards.length ) return ui.notifications.warn("CARDS.PassWarnNoTargets", {localize: true});
    if(currentCards.permission !== CONST.DOCUMENT_PERMISSION_LEVELS.OWNER){
      return ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoPermission"));
    }
    let faceUp = card.face !== null && card.face !== undefined;
    let faceDesc = undefined;
    let description = undefined;
    if(faceUp){
      faceDesc = (card.face == null || !card.faces) ? "" : card.faces[card.face].text;
      description = card.description ? card.description :card.data.description;
    }
    // Construct the dialog HTML
    const html = await renderTemplate("modules/hand-mini-bar/templates/dialog-play.html", {card, cards, description, faceDesc, faceUp, notFaceUpMode : !CONFIG.HandMiniBar.options.faceUpMode});
  
    // Display the prompt
    Dialog.prompt({
      title: game.i18n.localize("CARD.Play"),
      label: game.i18n.localize("CARD.Play"),
      content: html,
      callback: html => {
        const form = html.querySelector("form.cards-dialog");
        let fde = new FormDataExtended(form);
        let fd = fde.object;
        if(!fd){
          fd = fde.toObject();
        }
        const to = game.cards.get(fd.to);
        //override chat notification here
        const options = {action: "play", chatNotification:!CONFIG.HandMiniBar.options.hideMessages, updateData: fd.down ? {face: null} : {}};
               
        if(CONFIG.HandMiniBar.options.betterChatMessages){

          if(fd.down && card.face != null){
            card.flip();
          }
          let created = currentCards.pass(to, [card.id], options).catch(err => {
            return ui.notifications.error(err.message);
          });
          let img = card.back.img;
          if(card.face != null && !fd.down){
            if(!card.faces){
              img = undefined;
            }else{
              img =  card.faces[card.face].img;
            }
          }
          if(card.face && !img){
            img = card.data.faces[card.data.face].img;
          }
          let desc = card.description;
          if(desc == undefined){
            desc = card.data.description;
          }
          let cardID = card._id ? card._id: card.data._id;
          
          let renderData = {
            id: cardID,
            back: (card.face == null || fd.down),
            img: img,
            name:(card.face !== null && !fd.down) ? card.name : game.i18n.localize("HANDMINIBAR.CardHidden"),
            description: (card.face !== null && !fd.down) ? desc : null,
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
  },

  updateShortcutButton(){
    CONFIG.HandMiniBar.options.cardStackShortcut = game.settings.get(HandMiniBarModule.moduleName, "CardsStackShortcut");
    let shortcut = game.cards.get(CONFIG.HandMiniBar.options.cardStackShortcut);
    //remove any old buttons then prepend this one
    $(".hand-mini-bar-pile-shortcut-container").remove();
    if(!!shortcut){
      let data = {shortcut: shortcut,shortcutId:shortcut._id ? shortcut._id : shortcut.data._id};
      renderTemplate('modules/hand-mini-bar/templates/shortcut-button.html', data).then(
        content => {
          content = $(content);
          $("#hand-mini-bar-container").prepend(content);
      });
    }
  },

  updateShortcutPileChoices:function(){
    //add pile choices for shortcuts
    game.cards.forEach(function(cards){
      if(cards.type === "pile"){
        game.settings.settings.get("hand-mini-bar.CardsStackShortcut").choices[cards._id ? cards._id : cards.data._id] = cards.name;
      }
    });
  },

  //Shows the card image
  showCardImage: async function(card){
    const ip = new ImagePopout(card.img, {
      title: card.name,
      shareable: true,
      uuid: card.uuid
    });
    ip.render(true);
  },

  //Opens the hand for any additional options
  openHand: async function(hand){
    if(hand == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    if (hand.sheet.rendered) {
      hand.sheet.close();
    } else {
      hand.sheet.render(true);
    }
  },

  cardSort(a, b){
    if(a.sort < b.sort) return 1;
    if(a.sort > b.sort) return -1;
    return 0;
  }
}

//Attach to Foundry's CONFIG
CONFIG.HandMiniBar.documentClass = HandMiniBar;
CONFIG.HandMiniBar.documentClass = HandMiniBarWindow;

//Add a button to all the card windows to open the Larger card stack view
Hooks.on("getCardsConfigHeaderButtons", function(config, buttons){
  //when A card pile is rendered add a button to hook into the hand mini bar window
  if(config.object){
    buttons.unshift({
      label: "HANDMINIBAR.OpenHand",
      class: "open-stack",
      icon: "fas fa-hand-mini-bar-open-hand",
      onclick: ev => HandMiniBarModule.openStackWindow(config.object)
    });
  }
  return true;
});

//Mark The Pile with the card info and player ID that passed it that's being passed to it
Hooks.on("passCards", function(from, to, action){
  //track who played what if this flag is turned on showPlayedPlayerNames 
  if((action.action === "play" || action.action === "pass") && to.type === "pile" && CONFIG.HandMiniBar.options.showPlayedPlayerNames){
    action.toCreate.forEach(function(c,i){
      let cardID = c._id ? c._id : c.data._id;
      let history = game.user.getFlag(HandMiniBarModule.moduleName, HandMiniBarModule.playerPlayedProp);
      if(history === undefined){
        history = {};
      }
      history[cardID] = Date.now();
      game.user.setFlag(HandMiniBarModule.moduleName, HandMiniBarModule.playerPlayedProp, history);
    });
  }
  return true;
});

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
      CONFIG.HandMiniBar.options.faceUpMode = value;
      game.socket.emit(HandMiniBarModule.eventName, {'action': 'rerender'});
      HandMiniBarModule.rerender();
    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
  game.settings.register(HandMiniBarModule.moduleName, 'ShowPlayedPlayerNames', {
    name: game.i18n.localize("HANDMINIBAR.ShowPlayedPlayerNames"),
    hint: game.i18n.localize("HANDMINIBAR.ShowPlayedPlayerNamesHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String,
    default: false,
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.showPlayedPlayerNames = value;
      game.socket.emit(HandMiniBarModule.eventName, {'action': 'rerender'});
      HandMiniBarModule.rerender();
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
      game.socket.emit(HandMiniBarModule.eventName, {'action': 'reposition'});
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
  game.settings.register(HandMiniBarModule.moduleName, 'CardsStackShortcut', {
    name: game.i18n.localize("HANDMINIBAR.CardsStackShortcut"),
    hint: game.i18n.localize("HANDMINIBAR.CardsStackShortcutHint"),
    scope: 'world',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: String,       // Number, Boolean, String,
    choices: {
      "":game.i18n.localize("HANDMINIBAR.CardsStackShortcutNoShortcut")
    },
    default: "",
    onChange: value => { // value is the new value of the setting
      CONFIG.HandMiniBar.options.cardStackShortcut = value;
      HandMiniBarModule.updateShortcutButton();

    },
    filePicker: false,  // set true with a String `type` to use a file picker input
  });
});
Hooks.on("ready", function() {
  // Pre Load templates.
  const templatePaths = [
    'modules/hand-mini-bar/templates/card.html',
    'modules/hand-mini-bar/templates/chat-message.html',
    'modules/hand-mini-bar/templates/dialog-play.html',
    'modules/hand-mini-bar/templates/dialog-show.html',
    'modules/hand-mini-bar/templates/empty-hand-message.html',
    'modules/hand-mini-bar/templates/hand-container.html',
    'modules/hand-mini-bar/templates/hand.html',
    'modules/hand-mini-bar/templates/shortcut-button.html',
    'modules/hand-mini-bar/templates/window-hand.html'];
  loadTemplates(templatePaths).then(() => {
    console.log("Better Hand templates preloaded")
  });
  HandMiniBarModule.updateShortcutPileChoices();
  // Creates the outer container
  renderTemplate('modules/hand-mini-bar/templates/hand-container.html', {}).then(
    content => {
      content = $(content);
      $("#ui-bottom").append(content);
      HandMiniBarModule.updateShortcutButton();
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
        if($("#hand-mini-bar-container").hasClass("hidden")){
          $(".hand-mini-bar-buttons-container").addClass("hidden-expanded");
        }else{
          $(".hand-mini-bar-buttons-container").removeClass("hidden-expanded");
        }
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
      $(document).on("click",".hand-mini-bar-pile-shortcut",function(e){
        let cardsId = $(e.target).data("cards");
        HandMiniBarModule.openStackWindow(game.cards.get(cardsId));
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
      //buttons
      $(document).on("mouseover",".hand-mini-bar-buttons-container", function(e){
        $(".hand-mini-bar-buttons-container").addClass("expanded");
      });
      $(document).on("mouseout",".hand-mini-bar-buttons-container", function(e){
        $(".hand-mini-bar-buttons-container").removeClass("expanded");
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
      if(game.settings.get(HandMiniBarModule.moduleName, "ShowPlayedPlayerNames") == true){
        CONFIG.HandMiniBar.options.showPlayedPlayerNames = true;
      }
      game.socket.on(HandMiniBarModule.eventName, data => {
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
        }else if(data.action === "showStackWindow"){
          HandMiniBarModule.showStackWindow(data)
        }
      });
      HandMiniBarModule.restore();
      HandMiniBarModule.updatePlayerHands();
    }
  )
});
