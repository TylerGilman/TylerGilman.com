#!/bin/bash
set -e

VERSION="v0.3.8"
DOWNLOAD_URL="https://github.com/a-h/templ/releases/download/$VERSION/templ_Linux_x86_64.tar.gz"

mkdir -p bin
cd bin
wget "$DOWNLOAD_URL" -O templ.tar.gz
tar -xzf templ.tar.gz
chmod +x templ
rm templ.tar.gz
echo "templ $VERSION installed to $(pwd)/templ"