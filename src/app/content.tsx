import * as ReactDOM from "react-dom";
import App from "./App";
import * as React from "react";

chrome.runtime.sendMessage({}, (response) => {
  var checkReady = setInterval(() => {
    if (document.readyState === "complete") {
      clearInterval(checkReady);
      const Element = document.createElement("div");
      Element.setAttribute("id", "culater-root");
      document.body.appendChild(Element);
      console.log("We're in the injected content script!");
      ReactDOM.render(<App />, document.getElementById("culater-root"));
    }
  });
});
