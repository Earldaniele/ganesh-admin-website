/** Load the saved library even when discovering additional media fails. */
export async function refreshMedia(sync: () => Promise<void>, load: () => Promise<void>) {
  try {
    await sync();
  } finally {
    await load();
  }
}
