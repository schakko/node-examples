
var jsdom = require("jsdom"), 
	window = jsdom.jsdom().createWindow(),
	http = require('http'),
	path = require('path'),
	qs = require("querystring"),
	fs = require('fs'),
	document = "",
	file = "dump.txt",
	file2 = "res.txt",
	host = "www.americanhardcorebook.com",
	subPath = "/punk24",
	url = host + subPath,
	array = new Array(),
	workers = new Array(),
	maxWorkers = 10;


setTimeout(function() {
	if (workers.length < maxWorkers && array.length > 0) {
		console.log("Creating new Worker");
		worker = http.createClient(80, host);
		var bla = array.pop();
		var r = qs.unescape(bla[1].split("?f=")[1]);

		request = worker.request('GET', r, {'host': host});
		request.end();
		request.on('response', function(res) {
			var i = workers.length;
			var data;
			var file  = bla[0] + ".mp3";
			var stream = fs.createWriteStream(bla[0] + ".mp3");
			res.on('data', function(chunk) {
				console.log("Chunk [Worker] [" + i + "] received");
				if (stream.writeable) {
					stream.write(chunk);
				}
			});
	
			res.on('end', function() {
				stream.end();
			});
		});

		workers.push(worker);			
	}
}, 10);

function parseData(file2) {

	fs.readFile(file2, "utf-8", function(err, data) {
		var lines = data.split("\n");
		lines.pop();
		lines.forEach(function(line) {
			var data = line.split("|||");
			var filename = data[0]; 
			path.exists(filename + ".mp3", function(exists) {
				if (!exists) {
					array.push(new Array(data[0], data[1]));
				}
			});
		});
	});
}

function parseSourceFile(file) {
	console.log("parsing " + file);
	fs.readFile(file, "utf-8", function(err, data) {
		document += data;
		jsdom.jQueryify(window, 'http://code.jquery.com/jquery-1.4.2.min.js', function() {
			window.document.innerHTML = document;
			var download = "";
			window.$('table.data > tr').each(function(elem) {
				jq = window.jQuery;
				jq(this).each(function() {
					var $td = jq(this).find("td");
					var url = jq($td[0]).find("a").attr("href");
					var titel = jq.trim(jq($td[0]).text());
					var artist = jq.trim(jq($td[1]).text());
					if (url != undefined && url.length > 0) {
						download += artist + " - " + titel + "|||" + url + "\n";
					}
				});
			});
			fs.writeFile(file2, download);
			parseData(file2);
		});
	});
}

path.exists(file2, function(exists) {
	if (exists) {
		parseData(file2);
	} else {
		path.exists(file, function(exists) {
			if (!exists) {
				client = http.createClient(80, host);
				request = client.request('GET', subPath, {'host': host}),
				request.end();
				request.on('response', function(res) {
					var i = 0;

					res.on('data', function(chunk) {
						console.log("Chunk [" + i + "] received");
						document += chunk;
						i++;
					});
	
					res.on('end', function() {
						fs.writeFile(file, document);
						parseSourceFile(file);
					});
				});
			} else {
				parseSourceFile(file);
			}
		});
	}
});
