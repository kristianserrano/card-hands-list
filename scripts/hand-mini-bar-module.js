
import HandMiniBar from './hand-mini-bar.js';

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

window.HandMiniBarModule = {
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