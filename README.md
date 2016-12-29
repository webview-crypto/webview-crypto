# webview-crypto

[![Build Status](https://travis-ci.org/saulshanabrook/webview-crypto.svg?branch=master)](https://travis-ci.org/saulshanabrook/webview-crypto)
[![npm](https://img.shields.io/npm/v/webview-crypto.svg?maxAge=2592000?style=flat-square)](https://www.npmjs.com/package/webview-crypto)
[![Dependency Status](https://dependencyci.com/github/saulshanabrook/webview-crypto/badge)](https://dependencyci.com/github/saulshanabrook/webview-crypto)

![Build Status](https://saucelabs.com/browser-matrix/sshanabrook.svg)

This repo provides some helper tools to run the [Web Cryptography API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
in a WebView.

It is used in
[`react-native-webview-crypto`](https://github.com/saulshanabrook/react-native-webview-crypto),
[`nativescript-webview-crypto`](https://github.com/saulshanabrook/nativescript-webview-crypto), and
[`nativescript-angular-webview-crypto`](https://github.com/saulshanabrook/nativescript-angular-webview-crypto). It is not meant to be used directly, but simply serves as a common building
block for those libraries.


*This project is funded by [Burke Software and Consulting LLC](http://burkesoftware.com/) for [passit](http://passit.io/). We are available for hire for any improvement and integration needs on this project. Open an issue to start a conversation or email info @ burke software dot com.*

## Why?

The [Web Cryptography API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
is [implemented in all major browsers](http://caniuse.com/#feat=cryptography)
and provides performant and secure way of doing client side encryption in
JavaScript. However it is not supported in NativeScript or React Native, which
limits them from using Javascript libraries that depend on Web Crypto.

Luckily, the iOS and Android browser engines do support this API.
We can use their implementations by creating a WebView and communicating
with it asynchronously.

## Usage
We provide two entrypoints in this repo.

### Main Thread

`MainWorker` is used in your main thread. It communicates to the WebView
asynchronously with string messages, providing a `crypto` attribute
that fulfills the [`Crypto`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto)
interface. If you set this to be globally defined, all applications that depend
on `window.crypto` will work transperently.

```javascript
import {MainWorker} from "webview-crypto";

function sendToWebView(message: string): void {
  // sends `message` to the webview
}

var mw = new MainWorker(sendToWebView); // optional second argument for debug on or off

// call `mw.onWebViewMessage` whenever you get a message from the WebView
onWebViewMessage(mv.onWebViewMessage.bind(mv));

mw.crypto.subtle.generateKey(
  // whatever
)

window.crypto = mw.crypto;
```

### WebView

`WebViewWorkerSource` is a string that contains the source defining
a `WebViewWorker` constructor that should be used in your WebView.

After loading that Javascript in the WebView, initialize
`WebViewWorker` so that it can communicate with the main thread and do the
work of executing the cryptography.

```javascript

function sendToMain(message: string): void {
  // send `message` to the main thread
}
var wvw = new WebViewWorker(sendToMain);

// call `wvw.onMainMessage` whenever you get a message from the main thread
onMainMessage(wvw.onMainMessage.bind(wvw));
```

## Tests

We have some unit tests for basic behavior here.
Run `npm run test:local` to run them in a local browser. You also need to run
`npm run build:watch` to recompute the `webViewWorkerString` injected as needed.

In Travis CI, they run on iOS, Android, and Chrome through SauceLabs.

While these tests do help catch some bugs, they do not provide any strong
reassurance that this library will work in React Native and Typescript. That's
because on those platforms, half the code is running in a WebView and the
other half in their native JavaScript engine, which is either JavaScriptCore or
V8. I haven't come up with a way to test this in an automated fashion.

So in addition to local unit tests, all code changes that might break something
should be tested against the example repos ([React Native](https://github.com/saulshanabrook/react-native-webview-crypto-example)
and [NativeScript](https://github.com/saulshanabrook/nativescript-webview-crypto-example))
on both iOS and Android.

I welcome suggestions on improving this process and making it more automated.

## Caveats
While this attempts to as stick to the Web Cryptography API as possible,
this is impossible in a few situations due to the differing browser
implementations.

### Incomplete Support
This library is limited by the mobile browser's support. On iOS, the WebView's
use WebKit, which has limited and incomplete support ([example](https://bugs.webkit.org/show_bug.cgi?id=151308)).
If something isn't working, that might be why. Try it on Safari and see if it
works there.

### `getRandomValues`

Since this uses an asynchronous bridge to execute the crypto logic it
can't quite execute `crypto.getRandomValues` correctly, because that method
returns a value synchronously. It is simply *impossible* (as far as I know,
please let me know if there any ways to get around this) to wait for the
bridge to respond asynchronously before returning a value.

Instead, we return you a promise that resolves to a `TypedArray`.
We also accept these promises on all `crypto.subtle` methods that takes in
`TypedArray`s, to make it transparent and will automatically wait for
them to resolve before asking the WebView execute the method.

### `CryptoKey`
Since [JavaScriptCore](https://facebook.github.io/react-native/docs/javascript-environment.html#javascript-runtime)
does not support `window.Crypto`, it also doesn't have a `CryptoKey` interface.
So instead of returning an actual `CryptoKey` from
[`subtle.generateKey()`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey)
we instead return an object that confirms to the `CryptoKey` interface and has
a `_import` property that has the value of the key exported as `jwk` or using
the value for importing the key. This allows
you to treat the `CryptoKey` as you would normally, and whenever you need to use
it in some `subtle` method, we will automatically convert it back to a real
`CryptoKey` from the `_import` string and the metadata.
