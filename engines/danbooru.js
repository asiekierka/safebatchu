var _ = require("underscore")
  , jquery = require("jquery");

module.exports = function(options) {
	return {
		URL: options.url,
		IMAGE_URL: options.image_url || options.url,
		parseFormat: "json",
		getPageURL: function(options) {
			var url = "posts.json?limit=100";

			if(_.isArray(options.tags)) url += "&tags=" + encodeURIComponent(options.tags.join(" "));
			if(_.isNumber(options.page) && options.page > 0) url += "&page=" + (options.page+1);

			return this.URL + url;
		},
		parsePage: function(json, callback) {
			var engine = this;
			var images = _.map(json, function(image) {
				var data = {
					id: image.id,
					tags: image.tag_string_general.split(" "),
					name: "#" + image.id,
					url: image.file_url,
					rating: image.rating || "u"
				};
				if(data.url.indexOf("http") != 0) data.url = engine.IMAGE_URL + data.url;
				return data;
			});
			callback(undefined, images, {
				pageChangeAmount: 1
			});
		}
	};
};
