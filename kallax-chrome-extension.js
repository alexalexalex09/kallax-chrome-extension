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
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    const tabUrl = tabs[0].url;
    if (tabUrl.substr(0, 25 == "https://boardgamegeek.com")) {
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
          fn.addLogo(el);
        });
      });
    }
    if (tabUrl.substr(0, 30 == "https://www.boardgameatlas.com")) {
      //TODO: Add support for BGA
    }
  });
});

/***********************/
/*      Functions      */
/***********************/

const fn = {
  login: function (username, password) {
    const body = {
      username: username,
      password: password,
    };
    chrome.storage.sync.get(["jwt"], function (result) {
      if (typeof result[jwt] == "undefined") {
        //If we're not already logged in, create a fetch request with username and password
        const options = {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        };
        fetch("https://kallax.io/login", options) //TODO: Use an actual endpoint
          .then((response) => response.text())
          .then((data) => {
            //When the response is received, store the jwt in chrome sync storage for future use
            chrome.storage.sync.set({ jwt: data.jwt });
          });
      }
    });
  },
  filterBGG: function (links) {
    //filter the list of links on Board Game Geek to leave only boardgames
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
  addLogo: function (e) {
    //Add the piece after each boardgame found
    var el = document.createElement("kallaxLogo");
    el.classList.add("kallaxLogo", "kallaxGrey");
    fn.getKallaxID(e[2].trim()).then((res) => {
      switch (res) {
        case -1:
          break;
        case 0:
          el.classList.remove("kallaxGrey");
          el.classList.add("kallaxRed");
          break;
        default:
          el.classList.remove("kallaxGrey");
          el.classList.add("kallaxGreen");
      }
      this.addMenu(el, e[2].trim());
      e[0].parentNode.insertBefore(el, e[0]);
    });
  },
  getKallaxID: function (title) {
    //Get the id from local storage based on title, otherwise search kallax
    console.log("Getting " + title);
    var promise = new Promise(function (resolve, reject) {
      chrome.storage.sync.get([title], (result) => {
        if (
          typeof result[title] != "undefined" &&
          Date.now() - result[title].date < 1000 * 60 * 60 * 24 * 7 //Fetch the results again if they're older than 7 days
        ) {
          resolve(result[title].numMatches);
        }
        // Didn't find anything locally, so search Kallax
        const body = {
          title: title,
        };
        const options = {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        };
        fetch("https://kallax.io/getSingleGameFromTitle", options) //TODO: Use an actual endpoint
          .then((response) => response.text())
          .then((data) => {
            data = data.toString();
            //Store result in Chrome sync
            fn.saveLocal(title, data.id);
            resolve(data.id);
          });
      });
    });
    return promise;
  },
  addMenu: function (el, title) {
    //Add the Kallax menu
    //TODO: Create a hidden menu element
    //TODO: Add menu element as child of passed element
    el.addEventListener("click", () => {
      //TODO: Toggle hidden state of child
    });
  },
  saveLocal: function (title, id) {
    //Cache Steam data locally in Chrome sync storage to avoid scraping when possible
    var toSave = {};
    toSave[title] = { id: id, date: Date.now() };
    chrome.storage.sync.set(toSave, (res) => {});
  },
};
