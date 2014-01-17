var _ = require("underscore")
  , jquery = require("jquery");

module.exports = function(options) {
	return {
		URL: options.url,
		parseFormat: "json",
		getPageURL: function(options) {
			var url = "post.json?limit=100";

			if(_.isArray(options.tags)) url += "&tags=" + encodeURIComponent(options.tags.join(" "));
			if(_.isNumber(options.page) && options.page > 0) url += "&page=" + (options.page+1);

			return this.URL + url;
		},
		parsePage: function(json, callback) {
			var engine = this;
			var images = _.map(json, function(image) {
				return {
					id: image.id,
					tags: image.tags.split(" "),
					name: "#" + image.id,
					url: image.file_url
				};
			});
			callback(undefined, images, {
				pageChangeAmount: 1
			});
		}
	};
};
