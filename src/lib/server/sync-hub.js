const clients = new Set();

export function addSyncClient(send) {
  clients.add(send);
  return () => clients.delete(send);
}

export function publishSync(type) {
  for (const send of clients) {
    try {
      send(type);
    } catch {
      // ignore broken client
    }
  }
}