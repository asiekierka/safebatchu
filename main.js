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

var websites = {
	"safebooru": {
		"engine": "gelbooru",
		"url": "http://safebooru.org/"
	},
	"derpibooru": {
		"engine": "derpibooru",
		"url": "http://derpibooru.org/"
	},
	"danbooru": {
		"engine": "danbooru",
		"url": "http://danbooru.donmai.us/",
		"image_url": "http://danbooru.donmai.us"
	},
	"konachan": {
		"engine": "moebooru",
		"url": "http://konachan.com/"
	},
	"yandere": {
		"engine": "moebooru",
		"url": "http://yande.re/"
	}
};

var engine = undefined;

var args = process.argv;
args.shift(); args.shift(); // remove unwanted node and filename
var params = {}, tags = [];
var nextParam = undefined;
var tagMode = false;

_.each(args, function(arg) {
	if(!_.isString(arg)) return; // sanity check
	if(tagMode) { tags.push(arg); }
	else if(nextParam !== undefined) {
		params[nextParam] = arg;
		nextParam = undefined;
	} else if(arg.indexOf("-") == 0) {
		nextParam = arg.substr(1);
	} else {
		tagMode = true;
		tags.push(arg);
	}
});

function usage() {
	console.log("Usage: node main <-w website> <tags>");
	console.log("   -m id        Set minimum ID. Images below that ID will be ignored.");
	console.log("   -w website   Specify a website to download from.");
	console.log("");
	console.log("Supported websites: " + _.keys(websites).sort().join(", "));
}

function downloadPage(position, callback) {
	var listUrl = engine.getPageURL({page: position, tags: tags});
	console.log("Downloading page #" + position);
	if(_.has(engine, "downloadPage")) engine.downloadPage(listUrl, callback)
	else request({url: listUrl, headers: {
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

// Handle args
if(_.isString(params["m"])) params["m"] = Number(params["m"]);
if(!_.isString(params["w"])) params["w"] = "safebooru";

// Sanity checks
if(!_.isArray(tags) || tags.length < 1) {
	usage();
} else if(!_.has(websites, params["w"])) {
	console.log("No such website: " + params["w"] + "!");
} else {
	var website = websites[params["w"]];
	engine = require("./engines/" + website.engine)(website);
	// Begin download
	console.log("Downloading with tags: " + tags.join(", "));
	var outDir = tags.join(" ");
	if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
	var pid = 0;
	var parseFunc = function(err, links, result) {
 		if(err) throw err;
		// Remove unwanted
		links = _.filter(links, function(data) {
			if(_.isNumber(params["m"]) && data.id < params["m"])
				return false;
			return true;
		});
		if(links.length == 0) {
			console.log("Downloaded all images, quitting");
			return;
		}
		// Add filename
		links = _.map(links, function(data) {
			var ext = path.extname(data.url.split("?")[0]);
			data.filename = data.id + " - " + data.tags.join(", ");
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
	};

	var downloadFunc = function() {
		downloadPage(pid, function(out) {
			var parseFormat = engine.parseFormat || "html";
			if(parseFormat == "html") {
				jsdom.env({html: out, done: function(err, window) {
					if(err) throw err;
					engine.parsePage(window, parseFunc);
				}});
			} else if(parseFormat == "json") {
				engine.parsePage(JSON.parse(out), parseFunc);
			} else if(parseFormat == "raw") {
				engine.parsePage(out, parseFunc);
			}
		});
	};
	downloadFunc();
}
