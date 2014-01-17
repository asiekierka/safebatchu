var _ = require("underscore")
  , jquery = require("jquery")
  , async = require("async")
  , jsdom = require("jsdom")
  , request = require("request");

module.exports = function(options) {
	return {
		init: function() {
			console.log("WARNING! DOWNLOAD TOKENS ARE NOT SUPPORTED YET, QUALITY MAY BE LIMITED");
		},
		USER_AGENT: options.useragent,
		getPageURL: function(options) {
			var url = "http://www.deviantart.com/?order=9&paging_mode=1";

			if(_.isArray(options.tags)) url += "&q=" + encodeURIComponent(options.tags.join(" "));
			if(_.isNumber(options.page) && options.page > 0) url += "&offset=" + options.page;

			return url;
		},
		parsePage: function(window, callback) {
			var $ = jquery(window);
			var engine = this;
			var urls = [], images = [];
			$("span a.thumb").each(function() {
				urls.push({
					"url": $(this).attr("href"),
					"downloadURL": $(this).attr("data-super-img"),
					"fullDownloadURL": $(this).attr("data-super-full-img")
				});
			});
			var p = 0;
			async.eachSeries(urls, function(item, itemcb) {
				p++;
				console.log("  [" + p + "/" + urls.length + "] Collecting image data");
				var data = {
					name: item.url.split("/")[item.url.split("/").length - 1],	
					rating: "s",
					id: item.url.split("-")[item.url.split("-").length - 1],
					referer: item.url
				}
				data.filename = data.name;
				// Remove the line below to restore full image attempt code
				if(!_.isString(item.fullDownloadURL)) item.fullDownloadURL = item.downloadURL;
				if(_.isString(item.fullDownloadURL)) {
					// Sometimes, dA helps us and gives us the image URL already
					data.url = item.fullDownloadURL;
					images.push(data);
					itemcb();
				} else {
					itemcb();
				}
				/* else request({url: item.url, headers: {"User-Agent": engine.USER_AGENT}}, function(error, response, body) {
					// Lengthy method
					if(error) throw error;
					else if(response.statusCode != 200) {
						console.log("  Cannot download an image - status code " + response.statusCode + "!");
					} else {
						jsdom.env({html: body, done: function(err, window) {
							if(err) throw err;
							var $ = jquery(window);
							// Finally, we have the image's page.
							if($("a.dev-page-download").length) {
								data.url = $("a.dev-page-download").attr("href");
							}
							if(!_.isString(data.url)) {
								data.url = item.downloadURL;
							}
							if(_.isString(data.url)) {
								images.push(data);
							}
							itemcb();
						}});
					}
				}); */
			}, function() {
				callback(undefined, images, {
					pageChangeAmount: urls.length
				});
			});
		}
	};
};
