import net from 'node:net';

/**
 * Sends raw ESC/POS bytes to a LAN thermal printer (ZyWell ZY301) over a TCP
 * socket (raw/JetDirect, default port 9100).
 */
export function printToLanPrinter(
  ip: string,
  port: number,
  data: Buffer,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(timeoutMs);

    socket.once('error', (err) => finish(err));
    socket.once('timeout', () =>
      finish(new Error(`Printer connection timed out after ${timeoutMs}ms (${ip}:${port})`)),
    );

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        // Half-close once the bytes are flushed to the printer.
        socket.end(() => finish());
      });
    });
  });
}
