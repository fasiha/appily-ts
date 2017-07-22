client/webClient.js: webClient.js *-cyclejs.js *.js
	./node_modules/.bin/browserify -x node-fetch -x atob -x btoa webClient.js -o client/webClient.js

client/webClient.min.js: client/webClient.js
	java -jar ~/Downloads/compiler-latest/closure-compiler-v20170626.jar --js client/webClient.js > client/webClient.min.js

dist: client/webClient.js client/webClient.min.js

watch:
	fswatch -0 -o -l 0.1 webClient.js *-cyclejs.js *.js | xargs -0 -n 1 -I {} make

clean:
	rmtrash pouch__all_dbs__ _users _replicator config.json log.txt client/webClient.*js