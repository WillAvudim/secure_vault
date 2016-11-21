document.addEventListener('DOMContentLoaded', function() {
  var page_url = "chrome-extension://" + chrome.runtime.id + "/index.html";
  chrome.tabs.create({ url: page_url });
});
