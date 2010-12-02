
// simple queue system
function Queue() {
	this.buffer = new Array();
	this.__size = 0;

	this.push = function(obj) {
		this.buffer.push(obj);
		this.__size++;
	}

	// removes object from filesLeft and invalidates
	this.invalidate = function(obj) {
		// dont blame me, I know the performance problem. The filesLeft should use some sort of ring buffer or hashing
		for (var i = 0, m = this.buffer.length; i < m; i++) {
			if (this.buffer[i] == obj) {
				this.buffer[i] = undefined;
				this.buffer.slice(i);
				this.__size--;
				break;
			}
		}
	}

	this.size = function() {
		return this.__size;
	}
}

var jsdom = require("jsdom"), 
	window = jsdom.jsdom().createWindow(),
	http = require('http'),
	path = require('path'),
	qs = require("querystring"),
	fs = require('fs'),
	fileMirror = "local.mirror",
	fileDatabase = "local.database",
	targetHost = "www.americanhardcorebook.com",
	targetPath = "/punk24/",
	targetUrl = targetHost + targetPath,
	filesLeft = new Array(),
	workers = new Queue(),
	maxWorkers = 10,
	seperator = "|||",
	working = true,
	isInitalized = false,
	workerId = 0,
	currentWorkers = 0;

function createWorker() {
	var worker = http.createClient(80, targetHost);
	var obj = filesLeft.pop();

	workers.push(worker);	
	worker.id = ++workerId;
	console.log("Creating new Worker [" + worker.id + "] for file [" + obj.file + "] ...");

	var request = worker.request('GET', obj.path, {'host': targetHost});
	request.end();
	request.on('response', function(res) {

	var stream = fs.createWriteStream(obj.file);
		res.on('data', function(chunk) {
			if (stream.writeable) {
				stream.write(chunk);
			}
		});

		res.on('end', function() {
			console.log("Finished download of " + obj.file);	
			stream.end();
			request = undefined;
			workers.invalidate(worker);
		});
	});
}

function checkWorker() {
	console.log("check worker [current workers: " + workers.size() + ", unfinished files: " + filesLeft.length + "]");

	while (workers.size() < maxWorkers && filesLeft.length > 0) {
		createWorker();
	}
};

// reads the local database, structure is file $sep path
function parseDatabase() {
	fs.readFile(fileDatabase, "utf-8", function(err, data) {
		var lines = data.split("\n");
		// remove last (empty) line
		lines.pop();
		isInitalized = true;

		lines.forEach(function(line) {
			var row = line.split(seperator), 
			    // decode URI
			    obj = {'file' : row[0].replace(/[\/|\$]/g, "_") + ".mp3", 'path': qs.unescape(row[1].split("?f=")[1])};

			path.exists(obj.file, function(exists) {
				if (!exists) {
					console.log("File [" + obj.file + "] does not exist. Move to filesLeft.");
					filesLeft.push(obj);
				}
			});
		});
	});
}

function parseHtmlSite() {
	console.log("parsing local mirror file [" + fileMirror + "]");

	fs.readFile(fileMirror, "utf-8", function(err, data) {
		jsdom.jQueryify(window, 'http://code.jquery.com/jquery-1.4.2.min.js', function() {
			window.document.innerHTML = data;
			var databaseContent = "";
			// search for #data table and iterate over each row
			window.$('table.data > tr').each(function(elem) {
				jq = window.jQuery;
				jq(this).each(function() {
					// find all columns
					var $td = jq(this).find("td");
					var url = jq($td[0]).find("a").attr("href");
					var titel = jq.trim(jq($td[0]).text());
					var artist = jq.trim(jq($td[1]).text());
					if (url != undefined && url.length > 0) {
						databaseContent += artist + " - " + titel + seperator + url + "\n";
					}
				});
			});
			fs.writeFile(fileDatabase, databaseContent);
			parseDatabase();
		});
	});
}

function init() {
	console.log("Initalizing...");
	path.exists(fileDatabase, function(exists) {
		if (exists) {
			parseDatabase();
		} else {
			path.exists(fileMirror, function(exists) {
				if (!exists) {
					var htmlContent = "";
					var client = http.createClient(80, targetHost);
						console.log("Request goes to " + targetHost + targetPath);

					var request = client.request('GET', targetPath, {'host': targetHost});
					request.end();
					request.on('response', function(res) {
						var i = 0;
					
						if (res.statusCode != 200) {
							console.log("Server sends no response HTTP 200 [was: " + res.statusCode + "]");
							return;
						}

						res.on('data', function(chunk) {
							console.log("Chunk [" + i + "] received from [" + targetHost + "]");
							htmlContent += chunk;
							i++;
						});
	
						res.on('end', function() {
							fs.writeFile(fileMirror, htmlContent);
							parseHtmlSite();
						});
					});
				} else {
					parseHtmlSite();
				}
			});
		}
	});
}

init();
setInterval(checkWorker, 2000);
