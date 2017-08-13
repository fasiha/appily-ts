dev: client/webClient.js client/testing.html

dist: client/webClient.min.js

client/webClient.js: *.js
	./node_modules/.bin/browserify -x node-fetch -x atob -x btoa webClient.js -o client/webClient.js

client/webClient.min.js: client/webClient.js
	java -jar ~/Downloads/compiler-latest/closure-compiler-v20170626.jar --js client/webClient.js --create_source_map %outname%.map --js_output_file client/webClient.min.js

client/testing.html: client/index.html
	sed -e 's:webClient.min.js:webClient.js:g' client/index.html > client/testing.html

watch:
	fswatch -0 -o -l 0.1 webClient.js *-cyclejs.js *.js | xargs -0 -n 1 -I {} make

backup:
	tar cf data.tar .data
	node printDbDated.js > mydb.txt
