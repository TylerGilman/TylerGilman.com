#\!/bin/bash
sed -i 's/new THREE\./new window.THREE\./g' public/js/aquarium.js
sed -i 's/THREE\./window.THREE\./g' public/js/aquarium.js
