// Uses api.neko.maid.tw because pixiv would kill us for the bandwidthraep

var _ = require("underscore");

module.exports = function(options) {
	return {
		parseFormat: "json",
		getPageURL: function(options) {
			var url = "http://api.neko.maid.tw/artwork.json?limit=100&sites=pixiv";

			if(_.isArray(options.tags)) url += "&tag=" + encodeURIComponent(options.tags.join(" "));
			if(_.isNumber(options.page) && options.page > 0) url += "&start=" + options.page;

			return url;
		},
		parsePage: function(json, callback) {
			var images = _.chain(json.artworks)
				.filter(function(image) {
					return image.photos.length == 1; // Block multiple-image pixiv entries (FOR NOW)
				})
				.map(function(image) {
					var photo = image.photos[0];
					var r18 = image.r_18;
					if(_.isString(r18)) r18 = (r18 == "true"); // Fix for neko.maid.tw being silly
					return {
						id: Number(image.id),
						tags: image.tags,
						name: "#" + image.id,
						url: photo.image,
						rating: r18 ? "e" : "s"
					};
				})
				.value();
			callback(undefined, images, {
				pageChangeAmount: Number(json.header.perpage)
			});
		}
	};
};
