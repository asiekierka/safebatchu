var USER_AGENT = "Mozilla/5.0 (Safebatchu) WebKit/537.73.11 (KHTML, like Gecko) Version/7.0.1 Safari/537.73.11";

var fs		= require("fs")
  , exec	= require('child_process').exec
  , request = require("request")
  , _		= require("underscore");

exports.USER_AGENT = USER_AGENT;
  
exports.download = function(url, callback) {
	request({url: url, headers: {
		"jar": true,
		"User-Agent": USER_AGENT
	}}, callback);
}

exports.downloadWget = function(url, out, referer, callback) {
	var cleanupFailure = function() {
		if(fs.existsSync(out)) fs.unlinkSync(out);
	};
	child = exec('wget ' + (_.isString(referer) ? '--referer="' + referer + '" ' : "") + '-U "' + USER_AGENT + '" -O "' + out + '" "' + url + '"',
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
