color = {
	log: function(text, color) {
		console.log('\033[0;'+color+'m'+text+'\033[0m');
	},
	color: function(text, color) {
		return('\033[0;'+color+'m'+text+'\033[0m');
	},
};
/*
var express = require('express');
var sphp = require('sphp');
var app = express();
app.use(sphp.express('.'));
app.use(express.static('.'));
var port = 8000;
app.listen(port);
color.log(`Web server running on port ${port}\n\n`, 42);
*/

var WSS = require('ws').Server;
currentData = {time:0, paused:1, player:"cezar", source:"/ajax.php?serve=./sound&filename=sound.mp3"};

// Event handlers
function onconnection(port, func, socket, request) {
	var ip = request.connection.remoteAddress;
	color.log(`${func}:${port} < ${ip}: opened connection`, 32);
	if (func != 'broadcast') {
		socket.send(currentData[func]);
		color.log(`${func}:${port} > ${ip}: sent initial data: currentData.${func} (${currentData[func]})`, 100);
	}

	// When data is received
	socket.on('message', function (port, func, ip, message) {
		color.log(`${func}:${port} < ${ip}: ${message}`, 100);
		servers[func].clients.forEach(function(client) {
			client.send(message);
			color.log(`  ${func}:${port} > ${ip}: ${message}`, 100);
		});
		if (func != 'broadcast') {
			currentData[func] = message;
		}
	}.bind(this, port, func, ip));

	// The connection was closed
	socket.on('close', function(code, reason) {
		color.log(`${func}:${port} < ${this.ip}: closed connection [${code}]: ${reason}`, 31);
	}.bind({ip:ip}));
}

// Start the servers
servers = {
	time: 9000,
	paused: 9001,
	player: 9002,
	source: 9003,
	broadcast: 9004,
}
for (func of Object.keys(servers)) {
	var port = servers[func];
	servers[func] = new WSS({port: port});
	servers[func].on('connection', onconnection.bind(servers[func], port, func));
	var address = servers[func].address();
	color.log(`Server ${func} listening on ${address.address}:${address.port} with family=${address.family}`, 42)
}