import * as net from "net";

const server: net.Server = net.createServer();

server.on("connection", (clientToProxySocket: net.Socket) => {
  console.log("Client connected to proxy");
  clientToProxySocket.once("data", (data: Buffer) => {
    const dataStr: string = data.toString();
    let isTLSConnection: boolean = dataStr.indexOf("CONNECT") !== -1;

    let serverPort: number = 80;
    let serverAddress: string;

    console.log(dataStr);
    if (isTLSConnection) {
      serverPort = 443;
      serverAddress = dataStr
        .split("CONNECT")[1]
        .split(" ")[1]
        .split(":")[0];
    } else {
      serverAddress = dataStr.split("Host: ")[1].split("\r\n")[0];
    }
    console.log(serverAddress);

    // Creating a connection from proxy to destination server
    let proxyToServerSocket: net.Socket = net.createConnection(
      {
        host: serverAddress,
        port: serverPort,
      },
      () => {
        console.log("Proxy to server set up");
      }
    );

    if (isTLSConnection) {
      clientToProxySocket.write("HTTP/1.1 200 OK\r\n\r\n");
    } else {
      proxyToServerSocket.write(data);
    }

    clientToProxySocket.pipe(proxyToServerSocket);
    proxyToServerSocket.pipe(clientToProxySocket);

    proxyToServerSocket.on("error", (err: Error) => {
      console.log("Proxy to server error");
      console.log(err);
    });

    clientToProxySocket.on("error", (err: Error) => {
      console.log("Client to proxy error");
      console.log(err);
    });
  });
});

server.on("error", (err: Error) => {
  console.log("Some internal server error occurred");
  console.log(err);
});

server.on("close", () => {
  console.log("Client disconnected");
});

server.listen(
  {
    host: "0.0.0.0",
    port: 8080,
  },
  () => {
    console.log("Server listening on 0.0.0.0:8080");
  }
);
