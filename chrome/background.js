chrome.runtime.onMessageExternal.addListener((key, _, sendResponse) => {
  if (key) {
    console.log("Token ::: ", key);
    chrome.storage.sync.set({ "key": key.value });
    sendResponse({
      success: true,
      message: "Token has been received",
      received: key,
    });
  }
});
