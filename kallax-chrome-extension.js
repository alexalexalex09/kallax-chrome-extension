/* Relies on 3 endpoints:

*********************************
/login:
*********************************
Logs the user in to kallax.io
Parameters:
  username: String
  password: String

response expected:
  jwt: base64 encoded jwt

called by:
  fn.login()

*********************************
/getInfoOnGame [to be renamed]
*********************************
Reads a specific game from Kallax


Parameters:
  title: String,
  site: String("BGG"|"BGA"),
  id: String(id based on site format of the site parameter),

Header:
  Authorization: "Bearer " + jwt

Response expected:
  self: Boolean (true if owned by current user)
  friends: Number (number of friends who own this game)
  kallaxId: Kallax internal id of the game

called by:
  fn.getKallaxInfo()

*********************************
/addGameToKallax [to be renamed]
*********************************
Adds the specified game to the user's Kallax collection


Parameters:
  kallaxId: internal Kallax id

Header:
  Authorization: "Bearer " + jwt

Response expected:
  succcess: {
    status: Boolean (true if successful, false if unsuccessful),
    reason: String (error code if unsuccessful)
  }

  called by:
    fn.addToKallax()


*/

//Initalize variables
const BGGWhiteList = [
  "game-header-title-info",
  "geekitem_infotable",
  "collection_table",
  "geeklist_item_title",
];
//chrome.storage.sync.clear();

//Wait until the window is loaded to modify the content
window.addEventListener("load", function () {
  const tabUrl = location.href;
  /***********************/
  /*      For BGG        */
  /***********************/
  if (tabUrl.substring(0, 25) == "https://boardgamegeek.com") {
    //Get list of all anchor tags
    console.log("Getting links");
    var link = [];
    BGGWhiteList.forEach((e) => {
      link.push(document.querySelectorAll("." + e + " a"));
    });

    //Filter list to only board game links
    console.log("Filtering non-boardgames");
    var boardgames = [];
    link.forEach((e) => {
      boardgames.push(fn.filterBGG(e));
    });

    console.log("Placing icons on " + boardgames.length + " elements");
    //Add a placeholder icon to all board game links
    boardgames.forEach((e) => {
      e.forEach((el) => {
        fn.addLogo(el);
      });
    });
    console.log("Placing menu");
    fn.addKallaxMenu(document.querySelector("body"));
  }
  /***********************/
  /*      For BGA        */
  /***********************/
  if (tabUrl.substring(0, 30) == "https://www.boardgameatlas.com") {
    //TODO: Add support for BGA
  }
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
  getKallaxInfo: function (title, id) {
    var promise = new Promise(function (resolve, reject) {
      chrome.storage.sync.get(["jwt"], function (result) {
        if (typeof result[jwt] == "undefined") {
          reject("Not logged in");
        }
        const jwt = result[jwt];
        const body = {
          title: title,
          site: id.type,
          id: id.id,
        };
        const options = {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + jwt,
          },
        };
        fetch("https://kallax.io/getInfoOnGame", options) //TODO: Use an actual endpoint
          .then((response) => response.text())
          .then((data) => {
            const response = {
              self: data.ownedByMyself,
              friends: data.numberOfFriendsWhoOwnThisGame,
              kallaxId: data.KallaxId,
            };
            resolve(response);
          });
      });
    });
    return promise;
  },
  addToKallax: function (kallaxId) {
    //Get the id from local storage based on title, otherwise search kallax
    console.log("Adding " + title);
    chrome.storage.sync.get(["jwt"], function (result) {
      if (typeof result[jwt] == "undefined") {
        reject("Not logged in");
      }
      const jwt = result[jwt];
      var promise = new Promise(function (resolve, reject) {
        const body = {
          kallaxId: kallaxId,
        };
        const options = {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + jwt,
          },
        };
        fetch("https://kallax.io/addGameToKallax", options) //TODO: Use an actual endpoint
          .then((response) => response.json())
          .then((data) => {
            //Store result in Chrome sync
            resolve(data.success);
          });
      });
    });
    return promise;
  },
  filterBGG: function (links) {
    //filter the list of links on Board Game Geek to leave only boardgames
    var boardgames = [];
    links.forEach((e) => {
      var href = e.getAttribute("href");
      if (
        href != null &&
        href.search(/\/boardgame.*\/[0-9]+\/[^\/]*$/) == 0 &&
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
    //Add the Kallax menu after each boardgame found
    var el = document.createElement("kallaxLogo");
    el.classList.add("kallaxLogo");
    //TODO: Create a hidden menu element
    //TODO: Add menu element as child of passed element
    el.addEventListener("click", fn.showKallaxMenu);
    e[0].parentNode.insertBefore(el, e[0]);
  },
  saveLocal: function (title, kallaxId, owned, friends) {
    //Cache data locally in Chrome sync storage to avoid scraping when possible
    var toSave = {};
    toSave[title] = {
      title: title,
      kallaxId: kallaxId,
      owned: owned,
      friends: friends,
      date: Date.now(),
    };
    chrome.storage.sync.set(toSave, (res) => {});
  },
  addKallaxMenu: function (el) {
    var menuEl = document.createElement("div");
    menuEl.innerHTML = `
    <div id="kallax-menu" class="kallax-hidden">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.classList.toggle('kallax-hidden')">X</div>
        <div id="kallax-header">
          <div id="kallax-title">Current Game</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-me">Checking if owned...</div>
          <div id="kallax-friends">Checking if owned by friends...</div>
          <div id="kallax-add">
              <button>Add to My Collection</button>
          </div>
        </div>        
      </div>      
    </div>`;
    el.appendChild(menuEl);
  },
  getElementId: function (el) {
    let id = {};
    switch (0) {
      case window.location.href.search(/.*boardgamegeek.*/):
        //We're at Board Game Geek
        id = {
          type: "BGG",
          id: el.parentElement
            .querySelector("a")
            .getAttribute("href")
            .match(/\/.*\/(\d+)/),
        };
        break;

      case window.location.href.search(/.*boardgameatlas.*/):
        //TODO: We're at Board Game Atlas
        id = {
          type: "BGA",
          id: el.parentElement
            .querySelector("a")
            .getAttribute("href")
            .match(/\/.*\/(\d+)/),
        };
        break;
      default:
        id = { error: "Ineligible site" };
    }
    return id;
  },
  showKallaxMenu: function (e) {
    const el = e.target;
    const title = el.parentElement.querySelector("a").innerText.trim();
    document.querySelector("#kallax-title").innerText = title;
    //TODO: Check Kallax to see if owned by anyone
    /*fn.getKallaxInfo(title, id).then(function (res) {
      document.querySelector("#kallax-me").innerText =
        "You " + res.self ? "own " : "do not own " + "this game";
      document.querySelector("#kallax-friends").innerText = res.friends
        ? res.friends
        : "None" + " of your friends own this game";
    });
    document.querySelector("#kallax-add button").onclick = fn.addToKallax(res.kallaxId);
    */
    document.querySelector("#kallax-menu").classList.remove("kallax-hidden");
  },
};
