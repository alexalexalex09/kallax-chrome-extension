/* Relies on 3 endpoints:

*********************************
/security_credentials:
*********************************
Not an endpoint, but an actual webpage at kallax.io
Parameters:
  game: String (this extension's id)

response expected:
  key: String (user's private api key)

called by:
  navigating to the endpoint in the browser

*********************************
[GET] /api/owns
*********************************
Reads a specific game from Kallax

https://kallax.io/swagger/index.html

called by:
  getKallaxInfo()

*********************************
/api/collection/add [to be renamed]
*********************************
Adds the specified game to the user's Kallax collection

https://kallax.io/swagger/index.html

called by:
  addToKallax()




  TODO:

  * Create Events
  * Show Places in results
  * BGA Functionality
  * Convert to Firefox extension

*/

//Initalize variables
const BGGWhiteList = [
  ".game-header-title-info a",
  "gg-item-link-ui a",
  ".geekitem_infotable a",
  ".collection_table a",
  ".geeklist_item_title a",
  /*".hotness-item",*/ //This doesn't look right when adding icons
];

const BGAWhiteList = [".game-item.subtle-link-area>a", "#game-info h1"];

//Uncomment to clear Chrome storage
//chrome.storage.sync.clear();

//Wait until the window is loaded to modify the content
window.addEventListener("load", function () {
  document.querySelector("body").addEventListener("keyup", function (e) {
    if (e.key === "Escape") {
      closeWindow();
    }
  });
  const tabUrl = location.href;

  //Get list of all anchor tags

  //For BGG:
  var link = [];
  var boardgames = [];
  if (tabUrl.substring(0, 25) == "https://boardgamegeek.com") {
    BGGWhiteList.forEach((e) => {
      link.push(document.querySelectorAll(e));
    });
    link.forEach((e) => {
      boardgames.push(filterBGG(e));
    });

    console.log("Placing icons on " + boardgames.length + " elements");
    boardgames.forEach((e) => {
      e.forEach((el) => {
        addLogo(el);
      });
    });
  }

  //For BGA:
  if (tabUrl.substring(0, 30) == "https://www.boardgameatlas.com") {
    var waitElem = "";
    if (document.querySelector("#game-info h1") != null) {
      waitElem = "#game-info h1";
    } else {
      waitElem = ".game-item.subtle-link-area a";
    }
    waitForElem(waitElem).then(function () {
      BGAWhiteList.forEach((e) => {
        link.push(document.querySelectorAll(e));
      });
      link.forEach((e) => {
        boardgames.push(filterBGA(e));
      });
      boardgames.forEach((e) => {
        e.forEach((el) => {
          addLogo(el);
        });
      });
    });
  }
  //Add a placeholder icon to all board game links
});

/***********************/
/*      Functions      */
/***********************/

/**
 * Navigate to Kallax login
 *
 */
function login() {
  window.open(
    "https://kallax.io/security_credentials/" + chrome.runtime.id,
    "_blank"
  );
}

/**
 * fetches info from /api/owns
 * @param {String} title
 * @param {String} id
 * @returns {Promise} promise
 */
function getKallaxInfo(title, id) {
  console.log("Getting Kallax info...");
  var promise = new Promise(function (resolve, reject) {
    chrome.storage.sync.get(["key"], function (result) {
      if (Object.keys(result).length == 0) {
        reject({ code: 401, message: "Not logged in" });
      } else {
        const key = result["key"];
        const options = {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
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
              var httpError = ret;
              console.log(JSON.stringify(httpError, null, 4));
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
              var error = data;
              console.log(JSON.stringify(error, null, 4));
              reject(data);
            } else {
              const response = {
                self: data.owned,
                friends: data.friends,
                kallaxId: data.game.id,
              };
              console.log(JSON.stringify(data, null, 4));
              resolve(response);
            }
          })
          .catch((res) => {
            var caughtError = res.toString();
            console.log(JSON.stringify(caughtError, null, 4));
            reject({ error: true, code: 0, message: res.toString() });
          });
      }
    });
  });
  return promise;
}

function kallaxFetch(request, method) {
  var promise = new Promise(function (resolve, reject) {
    chrome.storage.sync.get(["key"], function (result) {
      if (Object.keys(result).length == 0) {
        reject({ code: 401, message: "Not logged in" });
      } else {
        const key = result["key"];
        const options = {
          method: method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
          },
        };
        fetch(request, options)
          .then((response) => response.json())
          .then((data) => {
            var kallaxFetchResponse = data;
            console.log(JSON.stringify(kallaxFetchResponse, null, 4));
            resolve(data);
          });
      }
    });
  });
  return promise;
}

/**
 * Posts an add game request to /api/collection/add
 * @param {String} title
 * @param {String} id
 * @returns {Promise}
 */
function addToKallax(id) {
  console.log("Adding game...");
  const request =
    `https://kallax.io/api/collection/add/` +
    id.id +
    "?source=" +
    id.type.toLowerCase();
  const method = "POST";
  kallaxFetch(request, method)
    .then(function (res) {
      //Populate a gameObject with a BGA or BGG key, depending on which site we're on
      var gameObject = {
        title: res.game.title,
        instance: res.instance.identifier,
      };
      gameObject[id.type.toLowerCase()] = id.id;

      //Save that object under its Kallax id
      var setObject = {};
      setObject[res.game.title] = gameObject;
      chrome.storage.sync.set(setObject);

      //Make sure we can look up the exact game title locally in the future in the gameIndex object
      chrome.storage.sync.get(["gameIndex"], function (result) {
        if (Object.keys(result).length == 0) {
          result.gameIndex = {};
        }
        result.gameIndex[id.id] = res.game.title;
        //TODO: Save BGA and BGG ID: result.gameIndex[id.bggId] = res.game.title; result.gameIndex[id.bgaId] = res.game.title;
        chrome.storage.sync.set({ "gameIndex": result.gameIndex }, function () {
          document.querySelector("#kallax-menu").parentElement.remove();
        });
      });
    })
    .catch(function (error) {
      showKallaxMenuError("There was an error adding this game", error);
    });
}

function showKallaxMenuError(message, error) {
  document.querySelector("#kallax-error").innerHTML =
    message + "..." + document.querySelector("#kallax-error").innerHTML;
  document.querySelector("#kallax-error-expand").innerHTML = error;
}

function removeFromKallax(id) {
  chrome.storage.sync.get(["gameIndex"], function (gameIndexResult) {
    if (Object.keys(gameIndexResult).length == 0) {
      result.gameIndex = {};
    }
    const title = gameIndexResult.gameIndex[id.id];
    try {
      chrome.storage.sync.get([title], function (instanceResult) {
        const instance = instanceResult[title].instance;
        const request = `https://kallax.io/api/collection/delete/` + instance;
        const method = "DELETE";
        kallaxFetch(request, method)
          .then(function (res) {
            delete gameIndexResult.gameIndex[id.id];
            chrome.storage.sync.remove([title], function () {
              document.querySelector("#kallax-menu").parentElement.remove();
            });
          })
          .catch(function (error) {
            showKallaxMenuError("There was an error removing this game", error);
          });
      });
    } catch {
      showKallaxMenuError(
        "There was an error removing this game",
        "This game was not added by this extension. If you would like to remove this game from your collection, please go to <a href='https://kallax.io' target='_blank'>kallax.io</a>"
      );
    }
  });
}

/**
 * For BGG
 * @param {Array} links An array of querySelectorAll results
 * @returns {Array} An array of arrays in the format [e, href, e.text]
 */
function filterBGG(links) {
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
}

/**
 * For BGA
 * @param {Array} links An array of querySelectorAll results
 * @returns {Array} An array of arrays in the format [e, href, e.text]
 */
function filterBGA(links) {
  //filter the list of links on Board Game Geek to leave only boardgames
  var boardgames = [];
  links.forEach((e) => {
    var href = "";
    var text = "";
    var location = window.location.href;
    if (location.search(/\/game\/(.*?)\//) != -1) {
      href = location;
      text = e.textContent;
      e.innerHTML = "<div style='display:none'></div>" + e.innerHTML;
      e = e.children[0];
    } else {
      href = e.getAttribute("href");
      text = e.getAttribute("title");
      //If there's a "deal" above the element in a list, place the kallax logo before the deal, not
      e = e.parentElement.querySelector(".game-extra-info");
    }
    if (href != null) {
      boardgames.push([e, href, text]);
    }
  });
  return boardgames;
}

/**
 * Call this to wait for a selector to appear in the document.
 * Useful for elements that only appear after asyncronous calls on the main page
 * @param {String} selector
 * @returns {Promise}
 */
function waitForElem(selector) {
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
}

/**
 * Adds a logo to the selected element
 * @param {Event} e The selecting event
 */
function addLogo(e) {
  //Add the Kallax menu after each boardgame found
  var el = document.createElement("kallaxLogo");
  el.classList.add("kallaxLogo");
  el.setAttribute("x-href", e[1]);
  el.setAttribute("x-text", e[2].trim());
  el.addEventListener("click", showKallaxMenu);
  e[0].parentNode.insertBefore(el, e[0]);
}

/**
 * Generate and show a login winow, with error message if given
 * @param {String} error Optional: The error message to show
 */
function showLoginWindow(error) {
  var loginMenu = document.createElement("div");
  loginMenu.innerHTML = `
    <div id="kallax-menu" class="kallax-invisible">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x">X</div>
        <div id="kallax-logo"></div>
        <div id="kallax-header">
          <div id="kallax-title">Login to Kallax</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-profile-id">
            <label for="kallax-menu-button">Click the button to log in at Kallax.io</label>
          </div>
          <div id="kallax-menu-button">
            <button type="submit">Login</button>
          </div>
          <div id="kallax-error">${
            error
              ? "The previous login attempt failed...<div id='kallax-error-expand' class='kallax-hidden'>" +
                error +
                "</div>"
              : ""
          }</div>
        </div>        
      </div>      
    </div>`;
  document.querySelector("body").appendChild(loginMenu);
  setTimeout(function () {
    document
      .querySelector("#kallax-menu-button")
      .addEventListener("click", function () {
        login();
        document.querySelector(
          "#kallax-error"
        ).innerHTML = `<div id="kallax-error-expand" class="kallax-hidden"></div>`;
        document
          .querySelector("#kallax-menu-button button")
          .setAttribute("disabled", "");
        document.querySelector("#kallax-profile-id label").innerHTML =
          "You may close this window after authorizing the extension on <a href='https://kallax.io'>kallax.io</a>";
      });
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-shadow")
      .addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-error")
      .addEventListener("click", toggleHidden);
    document.querySelector("#kallax-menu").classList.remove("kallax-invisible");
  }, 10);
}

/**
 * A function to close the modal, for sites that prevent executing inline scripts
 *
 */
function closeWindow() {
  if (document.querySelector("#kallax-menu") != null) {
    document.querySelector("#kallax-menu").classList.add("kallax-invisible");
    setTimeout(function () {
      document.querySelector("#kallax-menu").parentElement.remove();
    }, 310);
  }
}

/**
 * A function to toggle the kallax-error-expand, for sites that prevent executing inline scripts
 */
function toggleHidden() {
  document
    .querySelector("#kallax-error-expand")
    .classList.toggle("kallax-hidden");
}

/**
 * Generate an error window
 * @param {Number} code The error code, i.e. 401
 * @param {String} message
 */
function showErrorWindow(code, message) {
  var errorWindowEl = document.createElement("div");
  errorWindowEl.innerHTML = `
    <div id="kallax-menu" class="kallax-invisible">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x">X</div>
        <div id="kallax-logo"></div>
        <div id="kallax-header">
          <div id="kallax-title">Error</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-profile-id">
            <div id="kallax-menu-description">There was an error retrieving this game.</div>
            <div id="kallax-error">
              ${message}...
              <div id='kallax-error-expand' class='kallax-hidden'>Code:${code}</div>
            </div>
          </div>          
        </div>        
      </div>      
    </div>`;
  document.querySelector("body").appendChild(errorWindowEl);
  setTimeout(function () {
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-shadow")
      .addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-error")
      .addEventListener("click", toggleHidden);
    document.querySelector("#kallax-menu").classList.remove("kallax-invisible");
  }, 10);
}

/**
 * Generate and display a game window after successfully retrieving information from kallax.io
 * @param {String} title
 * @param {String} self
 * @param {Array} friends A friends array in the format [{identifier, username, profileUrl}]
 * @param {String} id
 */
function addKallaxMenu(title, self, friends, id) {
  var menuEl = document.createElement("div");
  const buttonText = self ? "Remove from" : "Add to";
  const meText = self ? "" : "do not";
  menuEl.innerHTML = `
    <div id="kallax-menu" class="kallax-invisible">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x">X</div>
        <div id="kallax-logo"></div>
        <div id="kallax-header">
          <div id="kallax-title">${title}</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-add">
            <button>${buttonText} My Collection</button>
          </div>
          <div id="kallax-me">You ${meText} own this game</div>
          <div id="kallax-friends-title">This game is owned by ${friends.length} of your friends</div>
          <div id="kallax-friends"></div>
          <div id="kallax-error">
            <div id='kallax-error-expand' class='kallax-hidden'></div>
          </div>
          <div id="kallax-settings">⚙️</div>  
        </div>      
      </div>      
    </div>`;
  document.querySelector("body").appendChild(menuEl);
  friends.forEach(function (friend) {
    var friendEl = document.createElement("div");
    friendEl.setAttribute("id", friend.identifier);
    friendEl.classList.add("kallax-friend");
    friendEl.innerHTML = `
    <span>
      ${friend.username}&nbsp;
      <div class="kallax-avatar"><img src="${friend.avatarUrl}"/></div>
    </span>`;
    document.querySelector("#kallax-friends").appendChild(friendEl);
    setTimeout(function () {
      friendEl.addEventListener("click", function () {
        window.open(friend.profileUrl, "_blank");
      });
    }, 1);
  });
  setTimeout(function () {
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-shadow")
      .addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-error")
      .addEventListener("click", toggleHidden);

    document
      .querySelector("#kallax-settings")
      .addEventListener("click", showSettings);

    if (!self) {
      document
        .querySelector("#kallax-add button")
        .addEventListener("click", function () {
          addToKallax(id);
        });
    } else {
      document
        .querySelector("#kallax-add button")
        .addEventListener("click", function () {
          removeFromKallax(id);
        });
    }
    document.querySelector("#kallax-menu").classList.remove("kallax-invisible");
  }, 10);
}

function showSettings() {
  document.querySelector("#kallax-menu").parentElement.remove();
  var settingsEl = document.createElement("div");
  settingsEl.innerHTML = `
    <div id="kallax-menu" class="kallax-invisible">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x">X</div>
        <div id="kallax-logo"></div>
        <div id="kallax-header">
          <div id="kallax-title">Extension Settings</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-add">
            <button>Click here to log out</button>
          </div>
          <div id="kallax-error">
            <div id='kallax-error-expand' class='kallax-hidden'></div>
          </div>
        </div>
      </div>      
    </div>`;
  document.querySelector("body").appendChild(settingsEl);
  setTimeout(function () {
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-shadow")
      .addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-error")
      .addEventListener("click", toggleHidden);
    document
      .querySelector("#kallax-add button")
      .addEventListener("click", function () {
        chrome.storage.sync.remove(["key"], closeWindow);
      });
    document.querySelector("#kallax-menu").classList.remove("kallax-invisible");
  }, 10);
}

/**
 * Show the appropriate modal given a clicked element
 * @param {Event} e
 */
function showKallaxMenu(e) {
  const el = e.target;
  const title = el.getAttribute("x-text");
  const id = getElementId(el);
  getKallaxInfo(title, id)
    .then(function (res) {
      addKallaxMenu(title, res.self, res.friends, id);
    })
    .catch(function (error) {
      console.log(JSON.stringify(error, null, 4));
      switch (error.code) {
        case 401:
          showLoginWindow();
          break;
        default:
          showErrorWindow(error.code, error.message);
      }
    });
}

/**
 * given a DOM Node, discover which site we're on and return the id for that node
 * @param {Node} el Find the game id of the matched element for BGA or BGG
 * @returns {Object} {type: String, id: String}
 */
function getElementId(el) {
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
      // We're at Board Game Atlas
      id = {
        type: "bga",
        id: el.getAttribute("x-href").match(/\/game\/(.*?)\//)[1],
      };
      break;
    default:
      id = { error: "Ineligible site" };
  }
  return id;
}
