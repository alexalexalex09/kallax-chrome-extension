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
  login()

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
  getKallaxInfo()

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
    addToKallax()


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

function login(e) {
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
}
function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
function getKallaxInfo(title, id) {
  console.log("Getting Kallax info...");
  var promise = new Promise(function (resolve, reject) {
    chrome.storage.sync.get(["jwt"], function (result) {
      if (Object.keys(result).length == 0) {
        reject("Not logged in");
      } else {
        const jwt = result["jwt"];
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
    });
  });
  return promise;
}
function addToKallax(kallaxId) {
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
}
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
function addLogo(e) {
  //Add the Kallax menu after each boardgame found
  var el = document.createElement("kallaxLogo");
  el.classList.add("kallaxLogo");
  el.setAttribute("x-href", e[1]);
  el.setAttribute("x-text", e[2].trim());
  el.addEventListener("click", showKallaxMenu);
  e[0].parentNode.insertBefore(el, e[0]);
}
function saveLocal(title, kallaxId, owned, friends) {
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
}
function showLoginWindow(error) {
  var loginMenu = document.createElement("div");
  loginMenu.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-login-container">
        <div id="kallax-x">X</div>
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
          <div id="kallax-login-error">${
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
    document
      .querySelector("#kallax-login-button")
      .addEventListener("click", login);
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-login-error")
      .addEventListener("click", toggleHidden);
  }, 10);
}
function closeWindow(e) {
  e.target.parentElement.parentElement.parentElement.remove();
}
function toggleHidden() {
  document
    .querySelector("#kallax-login-error-expand")
    .classList.toggle("kallax-hidden");
}
function showErrorWindow(code, message) {
  var ErrorWindowEl = document.createElement("div");
  ErrorWindowEl.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-login-container">
        <div id="kallax-x">X</div>
        <div id="kallax-header">
          <div id="kallax-title">Error</div>
        </div>
        <div id="kallax-footer">
          <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
        </div>
        <div id="kallax-body">
          <div id="kallax-profile-id">
            <div id="kallax-login-description">There was an error retrieving this game.</div>
            <div id="kallax-login-error">
              ${message}
              <div id='kallax-login-error-expand' class='kallax-hidden'>Code:${code}</div>
            </div>
          </div>          
        </div>        
      </div>      
    </div>`;
  document.querySelector("body").appendChild(ErrorWindowEl);
  setTimeout(function () {
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
    document
      .querySelector("#kallax-login-error")
      .addEventListener("click", toggleHidden);
  }, 10);
}
function addKallaxMenu(title, self, friends, kallaxId) {
  var menuEl = document.createElement("div");
  menuEl.innerHTML = `
    <div id="kallax-menu">
      <div id="kallax-shadow"></div>
      <div id="kallax-menu-container">
        <div id="kallax-x">X</div>
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
  setTimeout(function () {
    document.querySelector("#kallax-x").addEventListener("click", closeWindow);
  }, 10);
}
function showKallaxMenu(e) {
  const el = e.target;
  const title = el.getAttribute("x-text");
  const id = getElementId(el);
  getKallaxInfo(title, id)
    .then(function (res) {
      addKallaxMenu(title, res.self, res.friends, res.kallaxId);
    })
    .catch(function (error) {
      console.log({ error });
      switch (error.code) {
        case 401:
          showLoginWindow(error.message);
          break;
        default:
          showErrorWindow(error.code, error.message);
      }
    });
}
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
      //TODO: We're at Board Game Atlas
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
