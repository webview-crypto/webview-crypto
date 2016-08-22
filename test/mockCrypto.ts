import MainWorker from "../src/MainWorker";
import WebViewWorker = require("../src/WebViewWorker");

let webViewWorker: WebViewWorker;
function sendToWebView(message: string) {
  webViewWorker.onMainMessage(message);
}
const mainWorker = new MainWorker(sendToWebView, true);
export default mainWorker.crypto;

webViewWorker = new WebViewWorker(mainWorker.onWebViewMessage.bind(mainWorker));
