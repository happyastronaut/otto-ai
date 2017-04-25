require('./boot');

IOManager.loadDrivers();
IOManager.startPolling();

if (config.cron) {
	require(__basedir + '/src/cron');
}

if (config.server) {
	require(__basedir + '/src/server');
}

if (config.awh) {
	require(__basedir + '/src/awh');
}

function successResponse(f, session_model) {
	console.debug('Success', session_model.id, f);

	let io = this;

	io.output(f, session_model)
	.then(io.startInput)
	.catch((err) => {
		console.error('Error in success', err);
		io.startInput();
	});
}

function errorResponse(f, session_model) {
	console.error('Error', session_model.id, f);

	let io = this;

	AI.fulfillmentTransformer(f, session_model)
	.then((f) => {

		io.output(f, session_model)
		.then(io.startInput)
		.catch((err) => {
			console.error('Error in error', err);
			io.startInput();
		});

	});
}

function onIoResponse({ session_model, error, params }) {
	const io = this;

	if (session_model == null) {
		console.error('Invalid session model');
		io.startInput();
		return;
	}

	console.debug('onIoResponse', 'SID = ' + session_model.id, { error, params });

	if (error) {
		return errorResponse.call(io, { 
			data: {
				error: error
			}
		}, session_model);
	}

	new ORM.IOPending()
	.where({ session_id: session_model.id })
	.fetch()
	.then((pending) => {

		if (pending != null) {

			if (/stop/i.test(params.text)) {
				console.info('Stopping pending action', pending.id);
				
				pending.destroy()
				.then(() => {
					AI.fulfillmentTransformer({ speech: 'Ok' }, session_model)
					.then((f) => {
						successResponse.call(io, f, session_model);
					});
				})
				.catch((err) => {
					console.error('Deleting pending action error', err);
					errorResponse.call(io, { error: err }, session_model);
				});

				return;
			}

			console.info('Resolving pending action', pending.id);

			const action_fn = Actions.list[ pending.get('action') ];
			AI.fulfillmentPromiseTransformer(action_fn(), {
				sessionId: session_model.id,
				result: _.extend(pending.getData(), { 
					resolvedQuery: params.text,
				})
			}, session_model)
			.then((fulfillment) => {
				pending.destroy();
				successResponse.call(io, fulfillment, session_model);
			})
			.catch((err) => {
				console.error('Pending action error', err);
				errorResponse.call(io, { error: err }, session_model);
			});

			return;
		}

		if (params.text) {

			AI.textRequest(params.text, session_model)
			.then((fulfillment) => { 
				successResponse.call(io, fulfillment, session_model);
			})
			.catch((fulfillment) => {
				console.error('AI error', fulfillment);
				errorResponse.call(io, fulfillment, session_model);
			});

		} else if (params.fulfillment) {
			successResponse.call(io, params.fulfillment, session_model);
		}

	});
}

_.each(IOManager.drivers, (io) => {
	io.emitter.on('input', onIoResponse.bind(io));
	io.startInput();
});
