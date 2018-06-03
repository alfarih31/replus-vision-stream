// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay yoursecret 8081 8082
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

var fs = require('fs'),
	http = require('http'),
	WebSocket = require('ws');

var STREAM_PORT = 8081,
	WEBSOCKET_PORT = 8082;

var clients = {};
var id = 0;

// Websocket Server
var socketServer = new WebSocket.Server({port: WEBSOCKET_PORT, perMessageDeflate: false});
socketServer.connectionCount = 0;
socketServer.on('connection', function(socket, upgradeReq) {
	socketServer.connectionCount++;
	console.log(
		'New WebSocket Connection from: ', 
		(upgradeReq || socket.upgradeReq).socket.remoteAddress,
		(upgradeReq || socket.upgradeReq).headers['user-agent'],
		'('+socketServer.connectionCount+' total)'
	);
	
	socket.on('message', function(message){
		clients[id] = {'socket': socket, 'dev_uid':message};
		id++;
	});

	socket.on('close', function(code, message){
		delete clients[id];
		id--;
		socketServer.connectionCount--;
		socket.close();
		console.log(
			(upgradeReq || socket.upgradeReq).socket.remoteAddress+ ` Disconnected from WebSocket, total connection:` +socketServer.connectionCount
		);
	});
});


sendData = function(path, data){
	for(var i = 0; i<id+1; i++){
		if (clients[i]){
			if (path == clients[i]['dev_uid']){
				if (clients[i]['socket'].readyState === WebSocket.OPEN){
					clients[i]['socket'].send(data);
				};
			};
		};
	};
};

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
var streamServer = http.createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

	response.connection.setTimeout(0);
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort + '/' + params
	);
	request.on('data', function(data){
		sendData(params, data);
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end',function(){
		console.log('close');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});
}).listen(STREAM_PORT);

console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/<dev_uid>');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');
