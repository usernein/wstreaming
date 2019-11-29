// Get the user name
user = getCookie('user');
if (user == null) {
	user = prompt('Digite seu nome de usuário:');
	setCookie('user', user, 1);
}

// Main functions (required to be set before the code)
function getQueryVariable(variable, url = null) {
	//var query = url.split('?')[1];
    var query = url? url.split('?')[1] : window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return false;
}

// Main variables
colors = {
	names: [
		"red", "blue", "green", "yellow", "purple", "cyan", "black", "pink", "lime", "violet"
	],
};
player = user;
site = window.location.origin;
lastUpdate = 0;
syncing = 0;
syncServer = 1;
syncDeg = 0;
serverDiff = (Date.now() - ServerDate.now())/1000;

show_console = 1;//getQueryVariable('console');
terminal = $('#console');
console_limit = 50;
delay_limit = 0.3;

audio = $('#audio').get(0);
stop = $('#stop');
play = $('#play');
sync = $('#sync');
color_bar = $('#colorbar');

// Correção de delay
correct = getCookie('correct');
if (correct == null) {
	correct = 0;
	setCookie('correct', correct, 1);
}
correct = Number(correct);
$('#correct').val(correct);
$('#correctspan').text('Correção de delay: '+correct);
$('#correct').on('input', function(event) {
	correct = Number(event.target.value);
	setCookie('correct', correct, 1);
	$('#correctspan').text('Correção de delay: '+correct);
});

audio.onpause = function() {
	play.children().eq(0).addClass('icon-play');
	play.children().eq(0).removeClass('icon-stop');
}
audio.onplay = function() {
	play.children().eq(0).addClass('icon-stop');
	play.children().eq(0).removeClass('icon-play');
}
play.click(function(event) {
	var val = play.attr('value');
	if (val == 'play') {
		servers.time.send(JSON.stringify({time: audio.currentTime, server: ServerDate.now()/1000}));
		servers.player.send(user);
		servers.paused.send(0);
		play.attr('value', 'stop');
	} else {
		servers.paused.send(1);
		servers.time.send(JSON.stringify({time: audio.currentTime}));
		play.attr('value', 'play');
	}
});
sync.click(function() {
	syncServer = !syncServer;
	if (syncServer) {
		sync.addClass('current');
		syncInterval = setInterval(function(){
			syncDeg += 3;
			var css = 'rotate('+syncDeg+'deg)';
			var i = sync.children().eq(0);
			i.css('webkitTransform', css); 
		    i.css('mozTransform', css); 
		    i.css('msTransform', css); 
		    i.css('oTransform',css); 
		    i.css('transform', css);
		}, 33);
	} else {
		sync.removeClass('current');
		clearInterval(syncInterval);
	}
	/*audio.onpause();
	servers.time.send(JSON.stringify({time: audio.currentTime, server: ServerDate.now()/1000}));
	servers.paused.send(1);
	play.attr('value', 'play');
	
	setTimeout(function(){
		audio.onplay();
		servers.player.send(user);
		servers.paused.send(0);
		servers.time.send(JSON.stringify({time: audio.currentTime, server: ServerDate.now()/1000}));
		play.attr('value', 'stop');
	}, 1000);*/
});
audio.ontimeupdate = function(event) {
	var c = colors.names[String(Math.floor(audio.currentTime)).substr(-1)];
	color_bar.css('background-color', c);
	document.title = c;
	if (user != player) return;
	if (1 || (Date.now() - lastUpdate) >= 500){
		lastUpdate = Date.now();
		servers.time.send(JSON.stringify({time: audio.currentTime, server: ServerDate.now()/1000}));
	}
};
audio.onseeked = function(event) {
	if (player != user) return;
	servers.time.send(JSON.stringify({time: audio.currentTime, server: ServerDate.now()/1000}));
	servers.player.send(player);
}
$('#console').click(function() {
	$('#console').toggleClass('small');
	//alert('Relativa à data do servidor, a data do browser é = '+(Date.now() - ServerDate.now())/1000);
});

add = $('#add');
add.change(function(event) {
	var files = event.target.files;
	var file = files.item(0);
	$('.addlabel').html(`<i class="fas icon-doc-text"></i> Enviando ${file.name}...`);
	var reader = new FileReader();
	reader.onload = function (f) {
		$.post(site+'/ajax.php?save=sound', {data: f.target.result}, function(response) {
			console.log("Response: "+response);
			var url = '/ajax.php?'+$.param({filename: file.name, serve: 'sound', mime: file.type});
			servers.player.send(user);
			servers.source.send(url);
			servers.time.send(0);
			servers.paused.send(0);
		});
	};
	reader.readAsDataURL(file);
});

function updateTime(data) {
	var updated = data.time + serverDiff;
	return updated;
}
// Setters
function setTime(data) {
	data = JSON.parse(data);
	var time = data.time;
	if (syncServer && data.server != undefined) {
		time = updateTime(data);
	}
	//console.log(`updated time: ${time}`);
	if (user == player) return;
	if (audio.paused) {
		audio.currentTime = time;
		return;
	}
	
	diff = audio.currentTime - time;
	if (Math.abs(diff) >= delay_limit) {
		//console.log(`setTime: ${time+correct}`);
		audio.currentTime = time+correct;
	}
}
function setPaused(paused) {
	if (paused) audio.pause();
	else audio.play();
}
function setPlayer(player_value) {
	player = player_value;
}

function setSource(source) {
	$('.addlabel').html('<i class="fas icon-doc-text"></i> Carregando '+getQueryVariable('filename', source)+'...');
	console.log({source});
	audio.pause();
	$('#audio source').attr('src', site+source);
	audio.load();
	audio.oncanplaythrough = function(){
		audio.oncanplaythrough = null;
		$('.addlabel').html('<i class="fas icon-doc-text"></i> '+getQueryVariable('filename', source));
	}
}

// WebSockets
var hostname = window.location.hostname;
servers = {
	time: 9000,
	paused: 9001,
	player: 9002,
	source: 9003,
	broadcast: 9004,
}
for (var func of Object.keys(servers)) {
	var port = servers[func];
	servers[func] = new WebSocket(`ws://${hostname}:${port}/`);
	
	servers[func].onerror = function(func, event) {
		alert(`Server ${func} failed with error ${event.data.code}`);
	}.bind(null, func);
}

servers.time.onmessage = function(event) {
	setTime((event.data)); console.log("[WebSocket] time: "+event.data);
}
servers.paused.onmessage = function(event) {
	setPaused(Number(event.data)); console.log("[WebSocket] paused: "+event.data);
}
servers.player.onmessage = function(event) {
	setPlayer(event.data); console.log("[WebSocket] player: "+event.data);
}
servers.source.onmessage = function(event) {
	setSource(event.data); console.log("[WebSocket] source: "+event.data);
}

// Close the connection when the window is closed
window.addEventListener('beforeunload', function() {
	if (user == player) servers.paused.send(1);
	for (var socket in servers) {
		socket.close();
	}
});