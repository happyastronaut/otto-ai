(function iterate(dir) {
	fs.readdirSync(dir).forEach(function(file) {
		file = dir + '/' + file;
		const stat = fs.lstatSync(file);
		if (stat.isDirectory()) {
			iterate(file);
		} else if (stat.isFile()) {
			if (/\.js$/.test(file)) {
				const action_name = file.replace('/index.js', '').replace(__dirname + '/', '').replace(/\//g, '.').replace('.js','');
				exports[action_name] = () => { return require(file); };
			}
		}
	});
})(__dirname);