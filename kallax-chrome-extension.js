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
  login: function (e) {
    const profileId = document.querySelector("#kallax-profile-id-input").value;
    chrome.storage.sync.set({ jwt: profileId });
    document.querySelector("#kallax-body").innerHTML = `
    <div class="kallax-alert">
      Password saved...
    </div>`;
    setTimeout(function () {
      document.querySelector("#kallax-menu").parentElement.remove();
    }, 2000);
    /*chrome.storage.sync.get(["jwt"], function (result) {
      if (Object.keys(result).length == 0) {
        //If we're not already logged in, create a fetch request with username and password
        const options = {
          method: "GET",
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
    });*/
  },
  getKallaxInfo: function (title, id) {
    console.log("Getting Kallax info...");
    var promise = new Promise(function (resolve, reject) {
      chrome.storage.sync.get(["jwt"], function (result) {
        console.log({ id });
        console.log({ result });
        if (Object.keys(result).length == 0) {
          reject("Not logged in");
        } else {
          if (id.type == "BGG") {
            const jwt = result["jwt"];
            const options = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": jwt,
              },
            };
            let promises = [];
            promises.push(
              fetch("https://kallax.io/api/bgg/owns/" + id.id, options)
            );
            promises.push(
              fetch("https://kallax.io/api/bgg/friendsowns/" + id.id, options)
            );
            Promise.all(promises)
              .then((responses) => {
                console.log(responses);
                const response = {
                  self: responses[0].owned,
                  friends: responses[1].friends.length,
                  kallaxId: responses[0].instances[0].id,
                };
                resolve(response);
              })
              .catch((responses) => {
                reject(responses);
              });
          }
        }
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
      const jwt = result["jwt"];
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
  showLoginWindow: function (error) {
    var loginMenu = document.createElement("div");
    loginMenu.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-login-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.parentElement.remove()">X</div>
        <div id="kallax-header">
          <div id="kallax-title">Login to Kallax</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-login-description"><em>(Find your profile ID on your Kallax profile page)</em></div>
          <div id="kallax-profile-id">
            <label for="kallax-profile-id-input">Enter your Kallax Extension Password</label>
            <input id="kallax-profile-id-input" type="text"/>
          </div>
          <div id="kallax-login-button">
            <input type="submit" value="Login"/>
          </div>
          <div id="kallax-login-error" onclick="document.querySelector('#kallax-login-error-expand').classList.toggle('kallax-hidden')">${
            error
              ? "The previous login attempt failed<div id='kallax-login-error-expand' class='kallax-hidden'>" +
                error +
                "</div>"
              : ""
          }</div>
        </div>        
      </div>      
    </div>`;
    document.querySelector("body").appendChild(loginMenu);
    setTimeout(function () {
      console.log("Adding login function");
      document
        .querySelector("#kallax-login-button")
        .addEventListener("click", fn.login);
    }, 10);
  },
  addKallaxMenu: function (title, self, friends, kallaxId) {
    var menuEl = document.createElement("div");
    menuEl.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.parentElement.remove()">X</div>
        <div id="kallax-header">
          <div id="kallax-title">${title}/div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-me">You ${
            self ? "own " : "do not own "
          }this game</div>
          <div id="kallax-friends">${
            friends ? friends : "None"
          } of your friends own this game</div>
          <div id="kallax-add">
              <button onclick=${kallaxId}>Add to My Collection</button>
          </div>
        </div>        
      </div>      
    </div>`;
    document.querySelector("body").appendChild(menuEl);
  },
  showKallaxMenu: function (e) {
    const el = e.target;
    const title = el.parentElement.querySelector("a").innerText.trim();
    const id = fn.getElementId(el);
    fn.getKallaxInfo(title, id)
      .then(function (res) {
        addKallaxMenu(title, owned, friends, kallaxId);
      })
      .catch(function (error) {
        console.log({ error });
        fn.showLoginWindow(error);
      });
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
            .match(/\/.*\/(\d+)/)[1],
        };
        break;
      case window.location.href.search(/.*boardgameatlas.*/):
        //TODO: We're at Board Game Atlas
        id = {
          type: "BGA",
          id: el.parentElement
            .querySelector("a")
            .getAttribute("href")
            .match(/\/.*\/(\d+)/)[1],
        };
        break;
      default:
        id = { error: "Ineligible site" };
    }
    return id;
  },
};
