// Get the user name
user = get_cookie_or_create("user") || prompt("Digite seu nome de usuário:");

// Main variables
database = {
    audio_time_point: 0,
    audio_paused: true,
    stream_master: null,
    audio_source: {
        filename: "sound.mp3",
        url: "/ajax.php?serve=./sound&filename=sound.mp3",
    },
    last_command: null,
};

last_audio_point_post = 0;
sync_time_with_server = false;
syncing_icon_rotation_degree = 0;
time_diff_to_server = 0  //(Date.now() - ServerDate.now()) / 1000;

max_accepted_delay = 0.3;

audioTag = $("#audio").get(0);
play_button = $("#play");
sync_button = $("#sync");
color_bar = $("#colorbar");

function build_command(command, data) {
    return JSON.stringify({ command: command, data: data });
}
function decode_command(json_command) {
    decoded = JSON.parse(json_command);
    return decoded;
}

// Correção de delay
correctSeconds = Number(get_cookie_or_create("correct", 0));

$("#correct").val(correctSeconds);
$("#correctspan").text(`Correção de delay: ${correctSeconds}`);

$("#correct").on("input", function (event) {
    correctSeconds = Number(event.target.value);
    setCookie("correct", correctSeconds, 1);
    $("#correctspan").text(`Correção de delay: ${correctSeconds}`);
});

audioTag.onpause = function () {
    play_button.children().eq(0).addClass("icon-play");
    play_button.children().eq(0).removeClass("icon-stop");
    play_button.attr("value", "play");
};
audioTag.onplay = function () {
    play_button.children().eq(0).addClass("icon-stop");
    play_button.children().eq(0).removeClass("icon-play");
    play_button.attr("value", "pause");
};

play_button.click(function (event) {
    var buttonIntent = play_button.attr("value");
    if (buttonIntent == "play") {
        server.send(
            build_command("BROADCAST_SET", {
                audio_time_point: audioTag.currentTime,
                stream_master: user,
                audio_paused: 0,
            })
        );
        audioTag.play();
    } else {
        server.send(
            build_command("BROADCAST_SET", {
                audio_time_point: audioTag.currentTime,
                audio_paused: 1,
            })
        );
        audioTag.pause();
    }
});

sync_button.click(function () {
    sync_time_with_server = !sync_time_with_server; // switch values ;)
    if (sync_time_with_server) {
        sync_button.addClass("current");
        syncInterval = setInterval(function () {
            syncing_icon_rotation_degree >= 360
                ? syncing_icon_rotation_degree - 360
                : syncing_icon_rotation_degree + 3;

            var icon = sync_button.children().eq(0);
            var trasformation = `rotate(${syncing_icon_rotation_degree}deg)`;
            icon.css("webkitTransform", trasformation);
            icon.css("mozTransform", trasformation);
            icon.css("msTransform", trasformation);
            icon.css("oTransform", trasformation);
            icon.css("transform", trasformation);
        }, 33);
    } else {
        sync_button.removeClass("current");
        clearInterval(syncInterval);
    }
});

audioTag.ontimeupdate = function (event) {
    var colors = [
        "red",
        "blue",
        "green",
        "yellow",
        "purple",
        "cyan",
        "black",
        "pink",
        "lime",
        "violet",
    ];
    var c = colors[String(Math.floor(audioTag.currentTime)).substr(-1)];
    color_bar.css("background-color", c);

    if (user != database.stream_master || database.last_command == "INITIAL_SET") return;

    if (Date.now() - last_audio_point_post >= 500) {
        last_audio_point_post = Date.now();
        server.send(
            build_command("BROADCAST_SET", {
                audio_time_point: audioTag.currentTime,
            })
        );
    }
};
audioTag.onseeked = function (event) {
    server.send(
        build_command("BROADCAST_SET", {
            audio_time_point: audioTag.currentTime,
            stream_master: user,
        })
    );
};


$("#select_media").change(function (event) {
    var files = event.target.files;
    var file = files.item(0);
    $(".select_label").html(
        `<i class="fas icon-doc-text"></i> Enviando ${file.name}...`
    );

    var reader = new FileReader();
    reader.onload = function (f) {
        $.post(
            window.location.origin + "/ajax.php?save=sound",
            { data: f.target.result },
            function (response) {
                var url =
                    "/ajax.php?" +
                    $.param({
                        filename: file.name,
                        serve: "sound",
                        mime: file.type,
                    });
                server.send(
                    build_command("BROADCAST_SET", {
                        audio_time_point: 0,
                        stream_master: user,
                        audio_source: {
                            filename: file.name,
                            url: url,
                        },
                    })
                );
            }
        );
    };
    reader.readAsDataURL(file);
});

// WebSockets
var hostname = window.location.hostname;
server = new WebSocket(`ws://${hostname}:9000/`);

server.onclose = function (event) {
    alert(`WebSocket client failed: ws://${hostname}:9000/, with code: ${event.code}, reason: ${event.reason}`);
};

server.onmessage = function (event) {
    var { command, data } = decode_command(event.data);
    database.last_command = command;
    console.log(event.data);

    if (command == "BROADCAST_SET" || command == "INITIAL_SET") {
        if ("stream_master" in data) {
            database.stream_master = data.stream_master;
        }
        if ("audio_time_point" in data) {
            if (user != database.stream_master || command == "INITIAL_SET") {
                set_time(data.audio_time_point);
            }
        }
        if ("audio_paused" in data) {
            if (data.audio_paused) audioTag.pause();
            else audioTag.play();
        }
        if ("audio_source" in data) {
            if (!audioTag.paused) audioTag.pause();
            $(".select_label").html(
                `<i class="fas icon-doc-text"></i> Carregando ${data.audio_source.filename}...`
            );

            $("#audio source").attr(
                "src",
                window.location.origin + data.audio_source.url
            );
            audioTag.load();

            audioTag.oncanplaythrough = function () {
                audioTag.oncanplaythrough = null;
                $(".select_label").html(
                    `<i class="fas icon-doc-text"></i> ${data.audio_source.filename}`
                );

                if ("audio_time_point" in data) {
                    set_time(data.audio_time_point);
                }
                if ("audio_paused" in data) {
                    if (data.audio_paused) audioTag.pause();
                    else audioTag.play();
                }
            };
        }
    }
};

function calculate_synced_time_point(audio_time_point) {
    var synced_time_point = audio_time_point + time_diff_to_server;
    return synced_time_point;
}

function set_time(audio_time_point) {
    if (sync_time_with_server) {
        audio_time_point = calculate_synced_time_point(data);
    }

    if (audioTag.paused) {
        audioTag.currentTime = audio_time_point;
        return;
    }

    delay = audioTag.currentTime - audio_time_point;
    if (Math.abs(delay) >= max_accepted_delay) {
        audioTag.currentTime = audio_time_point + correctSeconds;
    }
}

// Close the connection when the window is closed
window.addEventListener("beforeunload", function () {
    if (user == database.stream_master)
        server.send(build_command("BROADCAST_SET", { audio_paused: true }));
});
