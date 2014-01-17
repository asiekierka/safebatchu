var _ = require("underscore")
  , jquery = require("jquery")
  , ent = require("ent");

module.exports = function(options) {
	return {
		URL: options.url,
		IMAGE_URL: options.image_url || options.url,
		getPageURL: function(options) {
			var url = "index.php?page=post&s=list";

			if(_.isString(options.tags)) url += "&tags=" + options.tags;
			else if(_.isArray(options.tags)) url += "&tags=" + options.tags.join("+");

			if(_.isNumber(options.page) && options.page > 0) url += "&pid=" + options.page;

			return this.URL + url;
		},
		parsePage: function(window, callback) {
			var $ = jquery(window);
			var images = [];
			var engine = this;
			$("img.preview").each(function() {
				var src = $(this).attr("src");
				var data = {
					url: src.replace(/thumbnail/g, "image").replace("image_", ""),
					id: Number(src.split("?")[1]),
					tags: ent.decode($(this).attr("alt").trim()).split(" ")
				};
				data.url = data.url.replace(engine.URL, engine.IMAGE_URL);
				data.name = "#" + data.id;
				images.push(data);
			});
			callback(undefined, images, {
				pageChangeAmount: images.length
			});
		}
	};
};
