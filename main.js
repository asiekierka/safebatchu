// Config
var MAX_NAME_LENGTH = 235;
var USER_AGENT = "Mozilla/5.0 (Safebatchu) WebKit/537.73.11 (KHTML, like Gecko) Version/7.0.1 Safari/537.73.11";

// Libraries
var fs		= require("fs")
  , exec	= require('child_process').exec
  , ent		= require("ent")
  , path	= require("path")
  , _		= require("underscore")
  , jsdom	= require("jsdom")
  , jquery	= require("jquery")
  , request	= require("request")
  , async	= require("async");

var engine = require("./engines/gelbooru.js")({
	url: "http://safebooru.org/"
});

var tags = process.argv;
tags.shift(); tags.shift(); // remove unwanted node and filename

function getFilename() {

}

function downloadPage(position, callback) {
	var listUrl = engine.getPageURL({page: position, tags: tags});
	console.log("Downloading page #" + position);
	request({url: listUrl, headers: {
			"User-Agent": USER_AGENT
		}}, function(err, response, body) {
			if(err) throw err;
			if(response.statusCode != 200) {
				console.log("Page " + listUrl + " returned error " + response.statusCode + "!");
			} else callback(body);
		}
	);
}

function downloadWget(url, out, callback) {
	var cleanupFailure = function() {
		if(fs.existsSync(out)) fs.unlinkSync(out);
	};
	child = exec('wget -U "' + USER_AGENT + '" -O "' + out + '" "' + url + '"',
		function(err, stdout, stderr) {
			if(err) {
				if(stderr.indexOf("timed out") >= 0) {
					console.log("    Timed out, retrying in 5 seconds...");
					setTimeout(function() { downloadWget(url, out, callback); }, 5000);
				} else if(stderr.indexOf("404 Not Found") >= 0) {
					console.log("    File not found!");
					cleanupFailure();
					callback();
				}
				else throw err;
			}
			else callback();
		}
	);
}

var imagesDownloaded = 0;

function downloadImage(name, url, out, callback) {
	imagesDownloaded++;
	if(fs.existsSync(out)) {
		console.log("  [" + imagesDownloaded + "] Already downloaded " + name + "!");
		callback();
		return;
	} else console.log("  [" + imagesDownloaded + "] Downloading image " + name);
	downloadWget(url, out, callback);
}

// Sanity checks
if(!_.isArray(tags) || tags.length < 1) {
	console.log("Usage: node main [tags]");
} else {
	// Begin download
	console.log("Downloading with tags: " + tags.join(", "));
	var outDir = tags.join(" ");
	if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
	var pid = 0;
	var downloadFunc = function() {
		downloadPage(pid, function(out) {
			jsdom.env({html: out, done: function(err, window) {
				if(err) throw err;
				engine.parsePage(window, function(err, links, result) {
					if(err) throw err;
					else if(links.length == 0) {
						console.log("Downloaded all images, quitting");
						return;
					}
					links = _.map(links, function(data) {
						var ext = path.extname(data.url.split("?")[0]);
						data.filename = data.id + " - " + data.tags;
						data.filename = data.filename.replace(/\//g, "_").substr(0, MAX_NAME_LENGTH) + ext;
						return data;
					});
					if(_.isObject(result)) {
						if(_.isNumber(result.pageChangeAmount)) pid += result.pageChangeAmount;
					}
					console.log("  " + links.length + " images found");
					async.eachSeries(links, function(link, callback) {
						downloadImage(link.name, link.url, outDir + "/" + link.filename, callback);
					}, function() {
						downloadFunc();
					});
				});
			}});
		});
	};
	downloadFunc();
}
