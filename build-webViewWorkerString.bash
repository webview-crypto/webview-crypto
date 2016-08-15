#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -o nounset

printf "export default \`" > ./src/webViewWorkerString.ts
sed -e "s/\\\\/\\\\\\\\/g" -e "s/\`/\\\\\`/g" webViewWorker.js >> ./src/webViewWorkerString.ts
echo \` >> ./src/webViewWorkerString.ts
