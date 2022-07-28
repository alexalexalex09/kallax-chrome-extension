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
  ".game-header-title-info a",
  "gg-item-link-ui a",
  ".geekitem_infotable a",
  ".collection_table a",
  ".geeklist_item_title a",
  /*".hotness-item",*/ //This doesn't look good
];

const BGAWhiteList = [".card-title", "#game-info h1"];

//chrome.storage.sync.clear();

//Wait until the window is loaded to modify the content
window.addEventListener("load", function () {
  const tabUrl = location.href;
  /***********************/
  /*      For BGG        */
  /***********************/
  //Get list of all anchor tags
  console.log("Getting links");
  var link = [];
  var boardgames = [];
  if (tabUrl.substring(0, 25) == "https://boardgamegeek.com") {
    BGGWhiteList.forEach((e) => {
      link.push(document.querySelectorAll(e));
    });
    link.forEach((e) => {
      boardgames.push(fn.filterBGG(e));
    });

    console.log("Placing icons on " + boardgames.length + " elements");
    boardgames.forEach((e) => {
      e.forEach((el) => {
        fn.addLogo(el);
      });
    });
  }

  if (tabUrl.substring(0, 30) == "https://www.boardgameatlas.com") {
    fn.waitForElem(".game-item.subtle-link-area a").then(function () {
      BGAWhiteList.forEach((e) => {
        link.push(document.querySelectorAll(e));
      });
      link.forEach((e) => {
        boardgames.push(fn.filterBGA(e));
      });
      boardgames.forEach((e) => {
        e.forEach((el) => {
          fn.addLogo(el);
        });
      });
    });
  }
  //Add a placeholder icon to all board game links
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
  streamToString: function (stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  },
  getKallaxInfo: function (title, id) {
    console.log("Getting Kallax info...");
    var promise = new Promise(function (resolve, reject) {
      chrome.storage.sync.get(["jwt"], function (result) {
        if (Object.keys(result).length == 0) {
          reject("Not logged in");
        } else {
          if (id.type == "bgg") {
            console.log("At BGG...");
            const jwt = result["jwt"];
            console.log({ jwt });
            const options = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": jwt,
              },
            };
            fetch(
              "https://kallax.io/api/owns/" +
                id.id +
                "?source=" +
                id.type.toLowerCase(),
              options
            )
              .then(function (response) {
                if (response.status < 200 || response.status > 299) {
                  var ret = { error: true, code: response.status };
                  switch (response.status) {
                    case 500:
                      ret.message =
                        "Sorry, this game could not be found. We're working on adding it to our database!";
                      return ret;
                      break;
                    case 401:
                      ret.message =
                        "The previous login attempt failed. Please try to log in again.";
                      return ret;
                      break;
                    default:
                      ret.message = "Error " + response.status;
                      return ret;
                  }
                } else {
                  return response.json();
                }
              })
              .then(function (data) {
                if (data.error) {
                  reject(data);
                } else {
                  console.log({ data });
                  const response = {
                    self: data.owned,
                    friends: data.friends.length,
                    kallaxId: data.game.id,
                  };
                  resolve(response);
                }
              })
              .catch((res) => {
                console.log({ res });
                reject({ error: true, code: 0, message: res.toString() });
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
  filterBGA: function (links) {
    //filter the list of links on Board Game Geek to leave only boardgames
    var boardgames = [];
    links.forEach((e) => {
      var href = "";
      var text = "";
      var location = window.location.href;
      if (location.search(/\/game\/(.*?)\//) != -1) {
        href = location.match(/\/game\/(.*?)\//)[1];
        text = e.textContent;
      } else {
        console.log(e);
        console.log(e.closest("a"));
        href = e.closest("a").getAttribute("href");
        text = e.firstChild.textContent;
      }
      if (href != null) {
        boardgames.push([e, href, text]);
      }
    });
    return boardgames;
  },
  waitForElem: function (selector) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver((mutations) => {
        if (document.querySelector(selector)) {
          resolve(document.querySelector(selector));
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
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
  showErrorWindow: function (code, message) {
    var ErrorWindowEl = document.createElement("div");
    ErrorWindowEl.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-login-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.parentElement.remove()">X</div>
        <div id="kallax-header">
          <div id="kallax-title">Error</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-profile-id">
            <div id="kallax-login-description">There was an error retrieving this game.</div>
            <div id="kallax-login-error" onclick="document.querySelector('#kallax-login-error-expand').classList.toggle('kallax-hidden')">
              ${message}
              <div id='kallax-login-error-expand' class='kallax-hidden'>Code:${code}</div>
            </div>
          </div>          
        </div>        
      </div>      
    </div>`;
    document.querySelector("body").appendChild(ErrorWindowEl);
  },
  addKallaxMenu: function (title, self, friends, kallaxId) {
    var menuEl = document.createElement("div");
    menuEl.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.parentElement.remove()">X</div>
        <div id="kallax-header">
          <div id="kallax-title">${title}</div>
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
        fn.addKallaxMenu(title, res.self, res.friends, res.kallaxId);
      })
      .catch(function (error) {
        console.log({ error });
        switch (error.code) {
          case 401:
            fn.showLoginWindow(error.message);
            break;
          default:
            fn.showErrorWindow(error.code, error.message);
        }
      });
  },
  getElementId: function (el) {
    let id = {};
    switch (0) {
      case window.location.href.search(/.*boardgamegeek.*/):
        //We're at Board Game Geek
        id = {
          type: "bgg",
          id: el.parentElement
            .querySelector("a")
            .getAttribute("href")
            .match(/\/.*?\/(\d+)/)[1],
        };
        break;
      case window.location.href.search(/.*boardgameatlas.*/):
        //TODO: We're at Board Game Atlas
        id = {
          type: "bga",
          id: el.parentElement
            .querySelector("a")
            .getAttribute("href")
            .match(/\/.*?\/(\d+)/)[1],
        };
        break;
      default:
        id = { error: "Ineligible site" };
    }
    return id;
  },
};
