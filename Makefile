client/webClient.js: webClient.js tono5k-cyclejs.js
	./node_modules/.bin/browserify webClient.js -o client/webClient.js

watch:
	fswatch -0 -o -l 0.1 webClient.js tono5k-cyclejs.js | xargs -0 -n 1 -I {} make

