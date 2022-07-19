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
    //Add the Kallax menu after each boardgame found
    var el = document.createElement("kallaxLogo");
    el.classList.add("kallaxLogo");
    //TODO: Create a hidden menu element
    //TODO: Add menu element as child of passed element
    el.addEventListener("click", fn.showKallaxMenu);
    e[0].parentNode.insertBefore(el, e[0]);
  },
  addToKallax: function (title, id) {
    //Get the id from local storage based on title, otherwise search kallax
    console.log("Adding " + title);
    var promise = new Promise(function (resolve, reject) {
      const body = {
        title: title,
        id: id,
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
    return promise;
  },
  saveLocal: function (title, id) {
    //Cache Steam data locally in Chrome sync storage to avoid scraping when possible
    var toSave = {};
    toSave[title] = { id: id, date: Date.now() };
    chrome.storage.sync.set(toSave, (res) => {});
  },
  addKallaxMenu: function (el) {
    var menuEl = document.createElement("div");
    menuEl.innerHTML = `
    <div id="kallax-menu" class="kallax-hidden">
    <div id="kallax-shadow"></div>
    <div id="kallax-menu-container">
        <div id="kallax-x" onclick="this.parentElement.parentElement.classList.toggle('kallax-hidden')">X</div>
        <div id="kallax-title">Current Game</div>
        <div id="kallax-me">Checking if owned...</div>
        <div id="kallax-friends">Checking if owned by friends...</div>
        <div id="kallax-add">
            <button>Add to My Collection</button>
        </div>
        <div id="kallax-link"><a href="https://kallax.io">kallax.io</a></div>
      </div>
    </div>`;
    el.appendChild(menuEl);
  },
  showKallaxMenu: function (e) {
    const el = e.target;
    console.log(el);
    const title = el.parentElement.querySelector("a").innerText.trim();
    document.querySelector("#kallax-title").innerText = title;
    //TODO: Check Kallax to see if owned by anyone
    document.querySelector("#kallax-menu").classList.remove("kallax-hidden");
  },
};
