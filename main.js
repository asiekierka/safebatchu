// Config
var MAX_NAME_LENGTH = 235;

// Libraries
var fs		= require("fs")
  , exec	= require('child_process').exec
  , ent		= require("ent")
  , path	= require("path")
  , _		= require("underscore")
  , jsdom	= require("jsdom")
  , jquery	= require("jquery")
  , request	= require("request")
  , async	= require("async")
  , util	= require("./util.js");

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
	},
	"pixiv": {
		"engine": "pixiv-nekomaid"
	},
	"deviantart": {
		"engine": "deviantart"
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
		if(arg.indexOf("http:") == 0 && !_.isString(params["url"])) {
			params["url"] = arg;
		} else {
			tagMode = true;
			tags.push(arg);
		}
	}
});

function usage() {
	console.log("Usage: node main <-w website> <tags>");
	console.log("   -m id        Images below this ID will be ignored.");
	console.log("   -O dir       Output to this directory. (Default: your tags)");
	console.log("   -r ratings   Allow only those ratings. -r sqe, for instance.");
	console.log("   -w website   Download from the specified website.");
	console.log("");
	console.log("Supported websites: " + _.keys(websites).sort().join(", "));
}

function downloadPage(position, callback) {
	var listUrl = engine.getPageURL({page: position, tags: tags});
	console.log("Downloading page #" + position);
	if(_.has(engine, "downloadPage")) engine.downloadPage(listUrl, callback)
	else util.download(listUrl, function(err, response, body) {
			if(err) throw err;
			if(response.statusCode != 200) {
				console.log("Page " + listUrl + " returned error " + response.statusCode + "!");
			} else callback(listUrl, body);
		}
	);
}

var imagesDownloaded = 0;

function downloadImage(name, url, out, referer, callback) {
	imagesDownloaded++;
	if(fs.existsSync(out)) {
		console.log("  [" + imagesDownloaded + "] Already downloaded " + name + "!");
		callback();
		return;
	} else console.log("  [" + imagesDownloaded + "] Downloading image " + name);
	util.downloadWget(url, out, referer, callback);
}

function downloadImages(links, outDir, callbackFunc) {
	async.eachSeries(links, function(link, callback) {
		downloadImage(link.name, link.url, outDir + "/" + link.filename, link.referer, callback);
	}, function() {
		callbackFunc();
	});
}

// Handle args
if(_.isString(params["m"])) params["m"] = Number(params["m"]);
if(!_.isString(params["w"]) && _.isString(params["url"])) {
	// TODO: add URL support for imgur/4chan
}

// Sanity checks
if(!_.isArray(tags) || tags.length < 1) {
	usage();
} else if(!_.has(websites, params["w"])) {
	console.log("No such website: " + params["w"] + "!");
} else {
	var website = websites[params["w"]];
	engine = require("./engines/" + website.engine)(_.extend(website, {"useragent": util.USER_AGENT}));
	// Begin download
	if(_.isString(params["url"])) {
		// TODO: add URL support for imgur/4chan
	} else {
		if(_.contains(engine, "init")) engine.init(downloadTagBased);
		else downloadTagBased();
	}
}

function parsePageEngine(url, out, engine, callback) {
	var parseFormat = engine.parseFormat || "html";
	if(parseFormat == "html") {
		jsdom.env({html: out, done: function(err, window) {
			if(err) throw err;
			engine.parsePage(url, window, jquery(window), callback);
		}});
	} else if(parseFormat == "json") {
		engine.parsePage(url, JSON.parse(out), callback);
	} else if(parseFormat == "raw") {
		engine.parsePage(url, out, callback);
	}
}

function updateWithParams(links, params) {
	links = _.filter(links, function(data) {
		if(_.isNumber(data.id) && _.isNumber(params["m"]) && data.id < params["m"])
			return false; // Minimum ID check
		if(_.isString(data.rating) && _.isString(params["r"])) {
			// Rating check
			if(params["r"].indexOf(data.rating) < 0) {
				if(_.isString(data.name))
					console.log("  Removed image " + data.name + " due to rating!");
				return false;
			}
		}
		return true;
	});
	links = _.map(links, function(data) {
		var ext = path.extname(data.url.split("?")[0]);
		if(!_.has(data, "filename")) {
			// Set initial filename
			if(_.isNumber(data.id)) {
				data.filename = data.id+"";
			} else if(_.isString(data.name)) {
				data.filename = data.name;
			}
			// Add comment
			if(_.isArray(data.tags)) {
				data.filename += " - " + data.tags.join(", ");
			} else if(_.isString(data.comment)) {
				data.filename += " - " + data.comment;
			}
		}
		// Shorten, add extension
		data.filename = data.filename.replace(/\//g, "_").substr(0, MAX_NAME_LENGTH) + ext;
		return data;
	});
	return links;
}

var pid = 0;

function downloadImageArray(links, result, outDir, callback) {
	if(links.length == 0) {
		console.log("Downloaded all images, quitting");
		return;
	}
	links = updateWithParams(links, params);
	console.log("  " + links.length + " images found");
	if(_.isObject(result)) {
		// Update based on engine output
		if(_.isNumber(result.pageChangeAmount)) pid += result.pageChangeAmount;
	}
	downloadImages(links, outDir, callback);
}

function downloadTagBased() {
	console.log("Downloading with tags: " + tags.join(", "));
	var outDir = params["O"] || tags.join(" ");
	if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
	var pid = 0;
	var parseFunc = function(err, links, result) {
		pid += links.length;
		if(err) throw err;
		else downloadImageArray(links, result, outDir, downloadFunc);
	};
	var downloadFunc = function() {
		downloadPage(pid, function(url, out) {
			parsePageEngine(url, out, engine, parseFunc);
		});
	};
	downloadFunc();
}
