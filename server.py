import asyncio
import json
import time
from typing import Union

import websockets
from rich.console import Console
from rich.theme import Theme
from websockets.exceptions import (
    ConnectionClosed,
    ConnectionClosedError,
    ConnectionClosedOK,
)

custom_theme = Theme(
    {
        "info": "dim cyan",
        "warning": "magenta",
        "error": "bold red",
        "verbose": "dim",
    }
)
console = Console(theme=custom_theme)

connections = {}
database = {
    "audio_time_point": 0,
    "audio_paused": 1,
    "stream_master": "cezar",
    "audio_source": {
        "url": "/ajax.php?serve=./sound&filename=sound.mp3",
        "filename": "sound.mp3"
    }
}


def build_command(command: str, data: Union[list, dict]):
    return json.dumps({"command": command, "data": data})


def decode_command(json_command: str):
    decoded = json.loads(json_command)
    return decoded["command"], decoded["data"]


# Handlers
async def on_new_connection(client, path):
    console.log(
        "New connection",
        {
            "client_id": client.id,
            "path": path,
            "remote_address": client.remote_address,
        },
    )

    await client.send(build_command("INITIAL_SET", database))
    console.log("Initial data set to", database, style="verbose")


async def on_closed_connection(client):
    console.log(
        "Connection closed",
        {
            "client_id": client.id,
            "path": client.path,
            "remote_address": client.remote_address,
            "close_code": client.close_code,
            "close_reason": client.close_reason,
        },
    )


async def on_message(client, data):
    command, data = decode_command(data)
    if command.startswith("BROADCAST"):
        await broadcast_for_users(
            build_command(command, data)  # , except_ids=[client.id]
        )
        database.update(data)
    elif command == "SET":
        database.update(data)
    elif command == "GET":
        await client.send(build_command("SET", database.get(data)))
    elif command == "GET_TIME":
        await client.send(build_command("SET_TIME", time.time()))


async def broadcast_for_users(data, except_ids: str = None):
    console.log("Starting broadcast", data, style="verbose")

    for id, client in connections.items():
        if except_ids and id in except_ids:
            continue
        await client.send(data)


# create handler for each new connection
async def connection_manager(client, path):
    if client not in connections:
        await on_new_connection(client, path)
        connections.update({client.id: client})

        await client.wait_closed()

        del connections[client.id]
        await on_closed_connection(client)


async def poll_messages():
    while True:
        for id in list(connections.keys()):
            if id not in connections:
                continue  # the client has been deleted
            client = connections[id]

            try:
                data = await client.recv()
            except (
                ConnectionClosed,
                ConnectionClosedError,
                ConnectionClosedOK,
            ) as e:
                console.log(
                    f"{e.__class__.__name__} caught in poll_messages:",
                    e,
                    style="error",
                )
                continue
            await on_message(client, data)
        await asyncio.sleep(0)


async def main():
    async with websockets.serve(connection_manager, "0.0.0.0", 9000):
        console.log("Server started!")
        await poll_messages()  # run forever


asyncio.run(main())
