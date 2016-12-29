#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

printf "export default \`" > ./src/webViewWorkerString.ts

# quote backslashes and backticks so we can wrap the whole thing in backticks
sed -e "s/\\\\/\\\\\\\\/g" -e "s/\`/\\\\\`/g" ./src/webViewWorkerDist.js >> ./src/webViewWorkerString.ts
echo \` >> ./src/webViewWorkerString.ts
