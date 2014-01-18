// To all anime fans commenting on the inclusion of this: It is merely included for completeness.
// Support ALL the boorus! o3o

var _ = require("underscore");

module.exports = function(options) {
	return {
		URL: options.url,
		parseFormat: "json",
		getPageURL: function(options) {
			var url = "search.json?nocomments=true&nofav=true";

			if(_.isArray(options.tags)) url += "&sbq=" + encodeURIComponent(options.tags.join(", "));
			if(_.isNumber(options.page) && options.page > 0) url += "&page=" + (options.page+1);

			return this.URL + url;
		},
		parsePage: function(json, callback) {
			var images = _.map(json, function(image) {
				var data = {
					id: image.id_number,
					tags: _.map(image.tag_ids, function(tag) { return tag.replace(/-/g, "_"); }),
					name: "#" + image.id_number,
					url: image.image
				};
				data.rating = _.contains(data.tags, "explicit") ? "e" : _.contains(data.tags, "questionable") ? "q" : _.contains(data.tags, "safe") ? "s" : "u";
				if(data.url.indexOf("http") != 0) data.url = "http:" + data.url;
				return data;
			});
			callback(undefined, images, {
				pageChangeAmount: 1
			});
		}
	};
};
