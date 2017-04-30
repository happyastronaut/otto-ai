exports.id = 'stories.get';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		ORM.Story
		.findOne({ $text: { $search: p.q }}, { score: { $meta: "textScore" }})
		.sort({ score: { $meta:"textScore" } })
		.then((story) => {
			resolve({
				speech: story.text,
				data: {
					url: story.url
				}
			});
		})
		.catch(reject);
	});
};