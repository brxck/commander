import * as vscode from "vscode";
import * as net from "net";
import * as fs from "fs";

let server: any;
const SOCKETFILE = "/tmp/vscode_commander.sock";

export function activate(context: vscode.ExtensionContext) {
  function listener(socket: net.Socket) {
    socket.on("data", (message: Buffer) => {
      if (vscode.window.state.focused) {
        vscode.commands.executeCommand(String(message));
      } else {
        socket.write(message);
      }
    });
  }
  server = net.createServer(listener);

  server.on("error", function (e: any) {
    if (e.code == "EADDRINUSE") {
      var clientSocket = new net.Socket();
      clientSocket.on("error", function (e: any) {
        // handle error trying to talk to server
        if (e.code == "ECONNREFUSED") {
          // No other server listening
          fs.unlinkSync(SOCKETFILE);
          server.listen(SOCKETFILE, listener);
        }
      });
      clientSocket.on("data", (message: Buffer) => {
        console.log(message);
        if (vscode.window.state.focused) {
          vscode.commands.executeCommand(String(message));
        }
      });
      clientSocket.connect({ path: SOCKETFILE });
    }
  });

  server.listen(SOCKETFILE);
}

export function deactivate() {
  server.close();
}
