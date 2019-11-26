import * as vscode from "vscode";
import * as net from "net";
import * as fs from "fs";

let server: net.Server;
const SOCKETFILE = "/tmp/vscode_commander.sock";
const connections: { [index: string]: net.Socket } = {};

function onConnect(socket: net.Socket) {
  // Track all connections
  const id = Date.now();
  connections[id] = socket;
  socket
    .on("end", function () {
      delete connections[id];
    })
    .on("data", onData);
}

function onData(msg: Buffer) {
  const message = String(msg);
  if (message === "__exit__") {
    // Server exited; passing of the torch
    activate();
  } else if (vscode.window.state.focused) {
    vscode.commands.executeCommand(String(message));
  } else if (server.listening) {
    // Server re-emits unused command to all clients
    emit(message);
  }
}

function resetOrConnect(e: NodeJS.ErrnoException) {
  if (e.code == "EADDRINUSE") {
    const clientSocket = new net.Socket();
    clientSocket.on("error", function (e: NodeJS.ErrnoException) {
      if (e.code == "ECONNREFUSED") {
        // No other server listening; reset socket and serve
        fs.unlinkSync(SOCKETFILE);
        server.on("connection", onConnect);
      }
    });
    // Server exists, become client
    clientSocket.on("data", onData);
    clientSocket.connect({ path: SOCKETFILE });
  }
}

function emit(message: Buffer | string) {
  Object.values(connections).forEach((connection) => {
    connection.write(message);
  });
}

export function activate() {
  server = net
    .createServer()
    .on("connection", onConnect)
    .on("error", resetOrConnect);
  server.listen(SOCKETFILE);
}

export function deactivate() {
  emit("__exit__");
  server.close();
}
