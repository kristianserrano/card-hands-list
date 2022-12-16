import HandMiniBarWindow from './hand-window.js';

/**
 * Each instance of a Mini Bar
 */
export default class HandMiniBar{
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

    /**
     * GMs can have multiple hands for each player matching the bar on the players side
     */
    this.playerBarCount = 0;
    
    let t = this;
    renderTemplate('modules/hand-mini-bar/templates/hand.html', {id: this.id}).then(
        content => {
            content = $(content);
            content.find('.hand-mini-bar-settings-hand').click(function(e){t.openStackWindow(e)});
            content.find('.hand-mini-bar-settings-choose').click(function(e){t.chooseDialog(e)});
            content.find('.hand-mini-bar-settings-choose').contextmenu(function(e){t.resetToolbarDialog(e)});
            content.find('.hand-mini-bar-pass').click(function(e){t.passCards(e)});
            content.find('.hand-mini-bar-pass').contextmenu(function(e){t.currentCards.resetDialog()});
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
      if(!!target && !!target.parent && (!!t.currentCards && (target.parent._id ? target.parent._id : target.parent.data._id)  == (t.currentCards._id ? t.currentCards._id : t.currentCards.data._id))){
        t.update();
      }
    });

    Hooks.on("createCard", function(target) {
      if(!!target && !!target.parent && (!!t.currentCards && (target.parent._id ? target.parent._id : target.parent.data._id) == (t.currentCards._id ? t.currentCards._id : t.currentCards.data._id))){
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
      //if(game.user.isGM && data != undefined && data.color != undefined){
      //  t.restore();
      //}
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
      length = this.currentCards.cards.contents.length;
      if(CONFIG.HandMiniBar.options.faceUpMode){
        // Check to make sure all the cards are flipped over to their face
        $(this.currentCards.cards.contents.sort(HandMiniBarModule.cardSort)).each(function(i,c){
          if(c.face == null){
            c.flip();
          }
        });
      }
      $(this.currentCards.cards.contents.sort(HandMiniBarModule.cardSort)).each(function(i,c){
        let img = c.back.img;
        if(c.face != null){
          if(!c.faces){
            img = undefined;
          }else{
            img =  c.faces[c.face].img;
          }
        }
        if(c.face && !img){
          img = c.data.faces[c.data.face].img;
        }
        let renderData = {
          id: c._id ? c._id: c.data._id,
          cardsid: t.currentCards._id ? t.currentCards._id: t.currentCards.data._id,
          uuid: c.uuid,
          back: (c.face == null),
          img: img,
          name:(c.face !== null) ? c.name : game.i18n.localize("HANDMINIBAR.CardBack"),
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
        .then(function(){HandMiniBarModule.attachDragDrop.bind(t)(t.html[0])})
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

  drag(event){
    HandMiniBarModule.drag.call(this, event);
  }

  drop(event){
    HandMiniBarModule.drop.call(this, event);
  }

  //sets and renders the cards based on users choice
  setCardsOption(choice){
    this.currentCards = choice;
    if(!choice){
      this.resetCardsID();
      if(game.user.isGM && this.currentUser != undefined){
        this.currentUser.unsetFlag(HandMiniBarModule.moduleName,'CardsID-' + this.playerBarCount);
      }
    }else{
      this.storeCardsID(this.currentCards._id ? this.currentCards._id : this.currentCards.data._id);
      if(game.user.isGM && this.currentUser != undefined){
        this.currentUser.setFlag(HandMiniBarModule.moduleName,'CardsID-' + this.playerBarCount, this.currentCards._id ? this.currentCards._id : this.currentCards.data._id);
      }
    }
    this.update();
    if(!game.user.isGM){
      game.socket.emit(HandMiniBarModule.eventName, {'action': 'updatePlayers'});
    }else{
      HandMiniBarModule.updatePlayerHandsDelayed();
    }
  }
  //sets the user, only available to GMs
  setUserOption(choice){
    this.currentUser = choice;
    this.storeUserID(this.currentUser._id ? this.currentUser._id : this.currentUser.data._id);
    this.update();
    if(game.user.isGM){
      //check to see if user has a hand selected already
      if(game.user.isGM){
        HandMiniBarModule.updatePlayerBarCounts();
      }
      let id = this.currentUser.getFlag(HandMiniBarModule.moduleName,'CardsID-' + this.playerBarCount);
      if(!!id){
        this.storeCardsID(id);
        this.setCardsID(id);
      }else{
        this.resetCardsID();
      }
      HandMiniBarModule.updatePlayerHandsDelayed();
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
    let t = this;
    let userHTML = $("<select class='hand-mini-bar-user-selection' name='users'/>");
    game.users.forEach(async function(c){
      let id = c._id?c._id:c.data._id;
      userHTML.append("<option value='" + id + "'>" + c.name + "</option>");
    });
    userHTML = $("<div class='hand-mini-bar-option-container'/>").append(userHTML)
    new Dialog({
      title: game.i18n.localize("HANDMINIBAR.UserList"),
      content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseUser") + '</p>' + userHTML[0].outerHTML,
      buttons: {
        ok: {
          label: "OK",
          callback: function(html){
            let id = $(html).find(".hand-mini-bar-user-selection").val();
            let choice = game.users.get(id);
            t.setUserOption(choice);
          }
        },

        cancel: {
          label: "Cancel",
          callback: function(){}
        }
      }
    }).render(true);
  }
  //Select a hand for this Toolbar
  async chooseHandDialog(){
    let t = this;

    let userHTML = $("<select class='hand-mini-bar-hand-selection' name='users'/>");
    userHTML.append("<option>" + game.i18n.localize("HANDMINIBAR.NoHand") + "</option>");
    game.cards.forEach(async function(c){
      if((c.permission == CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER ||
          c.permission == CONST.DOCUMENT_PERMISSION_LEVELS.OWNER) &&
          c.type == "hand"){
            let id = c._id ? c._id : c.data._id;
            userHTML.append("<option value='" + id + "'>" + c.name + "</option>");
          }
    });
    userHTML = $("<div class='hand-mini-bar-option-container'/>").append(userHTML)
    new Dialog({
      title: game.i18n.localize("HANDMINIBAR.DeckList"),
      content: '<p>' + game.i18n.localize("HANDMINIBAR.ChooseHand") + '</p>' + userHTML[0].outerHTML,
      buttons: {
        ok: {
          label: "OK",
          callback: function(html){
            let id = $(html).find(".hand-mini-bar-hand-selection").val();
            let choice = game.cards.get(id);
            t.setCardsOption(choice);
          }
        },

        cancel: {
          label: "Cancel",
          callback: function(){}
        }
      }
    }).render(true);
  }
  async resetToolbarDialog(){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    Dialog.confirm({
      title: game.i18n.localize("HANDMINIBAR.ResetToolbarDialogTitle"),
      content: "<p>" + game.i18n.localize("HANDMINIBAR.ResetToolbarDialogQuestion") + "</p>",
      yes: () => this.reset(),
      no: function(){},//do nothing
      defaultYes: true
    });
  }

  //Opens a Window with larger cards
  async openStackWindow(){
    if(this.currentCards == undefined){
      ui.notifications.warn( game.i18n.localize("HANDMINIBAR.NoHandSelected"));
      return;
    }
    new HandMiniBarWindow(this.currentCards).render(true);
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
        let fd = new FormDataExtended(form).object;
        if(!fd){
          fd = new FormDataExtended(form).toObject();
        }
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
        let fd = new FormDataExtended(form).object;
        if(!fd){
          fd = new FormDataExtended(form).toObject();
        }
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
      handTitle = this.currentCards.name;
    }
    /** Do Some Extra GM work here **/
    if(game.user.isGM){
      if(!!this.currentUser && this.currentUser.name != handTitle){
        if(handTitle != ""){
          handTitle = this.currentUser.name + " (" + handTitle + ")";
        }else{
          handTitle = this.currentUser.name;
        }
        if(this.playerBarCount !== 0){
          handTitle += " " + game.i18n.localize("HANDMINIBAR.Bar") + " " + (this.playerBarCount + 1);
        }
      }
    }
    $("#hand-mini-bar-hand-name-" + t.id).html(handTitle);
  }

  updatePlayerBarCount(){
    let count = 0;
    if(this.currentUser){
      this.id;
      let list = HandMiniBarModule.handMiniBarList;
      let userId = this.currentUser._id ? this.currentUser._id : this.currentUser.data._id;
      for(let i = 0; i < list.length && i < this.id; i++){
        let bar = list[i];
        if(bar.currentUser){
          let barUserId = bar.currentUser._id ? bar.currentUser._id : bar.currentUser.data._id;
          if(barUserId === userId){
            count++;
          }
        }
      }
    }
    this.playerBarCount = count;
  }

  //Only tries to update the player color if GM this may change in the future
  updatePlayerColor(){
    if(game.user.isGM){
      if(!!this.currentUser){
        let color =  this.currentUser.color ? this.currentUser.color : this.currentUser.data.color;
        $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","0 0 10px " + color);
      }else{
        $("#hand-mini-bar-hand-" + this.id + " .hand-mini-bar-hand-inner").css("box-shadow","none");
      }
    }
  }

  //one of the cards was clicked, based on options pick what to do
  async cardClicked(e){
    let id = $(e.target).data("card-id");
    let card = this.currentCards.cards.get(id);
    HandMiniBarModule.cardClicked(this.currentCards, card);
  }

  //Flip the card the player right clicked on
  async flipCard(e){
    let id = $(e.target).data("card-id");
    let card = this.currentCards.cards.get(id);
    HandMiniBarModule.flipCard(card);
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
    //updated for GMs
    game.socket.emit(HandMiniBarModule.eventName, {'action': 'updatePlayers'});
    HandMiniBarModule.updatePlayerHandsDelayed();
  }

  //Removes the html element from the screen
  remove(){
    if(this.html){
      this.html.remove();
    }
  }

  getCards(){
    return this.currentCards;
  }
}