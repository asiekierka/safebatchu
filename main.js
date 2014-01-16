// Config
var URL = "http://safebooru.org/";
var IMAGE_URL = "http://safebooru.org/";
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
  , async	= require("async");

function downloadPage(position, callback) {
	var listUrl = URL + "index.php?page=post&s=list&tags=" + tags.join("+") + "&pid=" + position;
	console.log("Downloading images from position "+ position);
	request({url: listUrl, headers: {
			"User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; X11; Linux i686; en) Opera 8.01"
		}}, function(err, response, body) {
			if(err) throw err;
			if(response.statusCode != 200) {
				console.log("Page " + listUrl + " returned " + response.statusCode + "!");
			} else callback(body);
		}
	);
}

var tags = process.argv;
tags.shift(); tags.shift(); // remove unwanted node and filename

// Sanity checks
if(!_.isArray(tags) || tags.length < 1) {
	console.log("Usage: node main [tags]");
} else {
	// Begin download
	console.log("Downloading with tags: " + tags.join(", "));
	var outDir = tags.join(" ");
	if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
	var pid = 0;
	var jumpBy = function(amount) {
		pid += amount;
		downloadPage(pid, function(out) {
			jsdom.env({html: out, done: function(err, window) {
				if(err) throw err;
				var $ = jquery(window);
				var links = [];
				$("img.preview").each(function() {
					var src = $(this).attr("src");
					var data = {	url: src.replace(/thumbnail/g, "image").replace("image_", ""),
							id: Number(src.split("?")[1]),
							tags: $(this).attr("alt").trim()};
					data.tags = ent.decode(data.tags);
					data.filename = data.id + " - " + data.tags
					var ext = path.extname(src.split("?")[0]);
					data.filename = data.filename.substr(0, MAX_NAME_LENGTH) + ext;
					links.push(data);
				});
				console.log("  " + links.length + " images found");
				async.eachSeries(links, function(link, callback) {
					pid = pid + 1;
					var outFile = outDir + "/" + link.filename;
					if(fs.existsSync(outFile)) {
						console.log("  [" + pid + "] Already downloaded #" + link.id + ", not redownloading");
						callback();
						return;
					} else console.log("  [" + pid + "] Downloading image #" + link.id);
					var dl = function() {
						child = exec('wget -O "' + outFile + '" "' + link.url + '"', function(err, stdout, stderr) {
							if(err) {
								if(stderr.contains("timed out")) dl();
								else throw err;
							}
							else callback();
						});
					};
					dl();
				}, function() {
					jumpBy(0);
				});
			}});
		});
	};
	jumpBy(0);
}
