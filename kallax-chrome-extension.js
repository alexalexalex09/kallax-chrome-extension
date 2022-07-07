//Initalize variables
const whiteList = [
  "game-header-title-info",
  "geekitem_infotable",
  "collection_table",
  "geeklist_item_title",
];
//chrome.storage.sync.clear();

//Wait until the window is loaded to modify the content
window.addEventListener("load", function () {
  /***********************/
  /*      For BGG        */
  /***********************/
  //Get list of all anchor tags
  console.log("Getting links");
  var link = [];
  whiteList.forEach((e) => {
    link.push(document.querySelectorAll("." + e + " a"));
  });

  //Filter list to only board game links
  console.log("Filtering non-boardgames");
  var boardgames = [];
  link.forEach((e) => {
    boardgames.push(fn.filterBGG(e));
  });

  //Add a placeholder icon to all board game links
  boardgames.forEach((e) => {
    e.forEach((el) => {
      fn.addPiece(el);
    });
  });
});

/***********************/
/*      Functions      */
/***********************/

const fn = {
  filterBGG: function (links) {
    //filter the list of links to leave only boardgames
    var boardgames = [];
    links.forEach((e) => {
      var href = e.getAttribute("href");
      if (
        href != null &&
        href.search(/\/boardgame\/[0-9]+\/[^\/]*$/) == 0 &&
        e.text != "" &&
        e.text != "Shop" &&
        e.offsetParent !== null
      ) {
        boardgames.push([e, href, e.text]);
      }
    });
    return boardgames;
  },
  addPiece: function (e) {
    //Add the piece after each boardgame found
    var el = document.createElement("kallaxPiece");
    el.classList.add("kallaxPiece", "kallaxGrey");
    fn.getTTSMod(e[2].trim()).then((res) => {
      switch (res) {
        case -1:
          break;
        case 0:
          el.classList.remove("kallaxGrey");
          el.classList.add("kallaxRed");
          break;
        case 1:
          el.classList.add("kallaxYellow");
          break;
        default:
          el.classList.add("kallaxGreen");
      }
      this.addLink(el, e[2].trim());
      e[0].parentNode.insertBefore(el, e[0]);
    });
  },
  getTTSMod: function (title) {
    //Get the number of mods found from chrome sync storage if available, scrape Steam otherwise
    console.log("Getting " + title);
    var promise = new Promise(function (resolve, reject) {
      chrome.storage.sync.get([title], (result) => {
        if (
          //true == true || //Testing
          typeof result[title] == "undefined" ||
          Date.now() - result[title].date > 1000 * 60 * 60 * 24 * 7 //Fetch the results again if they're older than 7 days
        ) {
          /*//First try to find them in the database
            Cache.findOne({ title: title }).exec(function (err, cache) {
              //If a cache was found and it's younger than 7 days, use that
              if (cache && Date.now() - cache.date > 1000 * 60 * 60 * 24 * 7) {
                //Update the local database, which was out of date
                fn.saveLocal(cache.title, cache.count);
                resolve(cache.count);
              } else {
                //Didn't find a cached result: find a new result and update the chrome sync and mongo cache*/

          var fixed =
            "Fixed the connection string error caused by rotating config vars";
          fixed.toString();
          fetch(
            "https://bgg-tts-cors.herokuapp.com/steamcommunity.com/workshop/browse/?appid=286160&searchtext=" +
              title
          )
            .then((response) => response.text())
            .then((data) => {
              data = data.toString();

              //Filter down the HTML to only workshop item titles that match ours
              var regex = `class="workshopItemTitle.*?>` + title + "(.*?)<";
              var regexName = new RegExp(regex, "gi");
              var matches = data.matchAll(regexName);
              var count = 0;

              //Loop through the matches to filter further
              for (const match of matches) {
                if (
                  match[1].indexOf("[") == -1 ||
                  //Brackets are OK only if they are for English or to designate that it's scripted
                  match[1].indexOf("[EN]") != -1 ||
                  match[1].indexOf("[Script") != -1 ||
                  match[1].indexOf("[script") != -1
                ) {
                  //Success! Increase the count
                  count++;
                } else {
                  console.log("Didn't match: " + match[1]);
                }
              }
              //Store result in Chrome sync
              fn.saveLocal(title, count);
              //Store result in Mongo DB
              /*cache = { title: title, count: count, date: Date.now() };
                    cache.save();*/
              resolve(count);
            });
          /*}
            });*/
        } else {
          resolve(result[title].numMatches);
        }
      });
    });
    return promise;
  },
  addLink: function (el, title) {
    //Add a link to each piece
    el.addEventListener("click", () => {
      window.open(
        "https://steamcommunity.com/workshop/browse/?appid=286160&searchtext=" +
          title
      );
    });
  },
  saveLocal: function (title, count) {
    //Cache Steam data locally in Chrome sync storage to avoid scraping when possible
    var toSave = {};
    toSave[title] = { numMatches: count, date: Date.now() };
    chrome.storage.sync.set(toSave, (res) => {});
  },
};
