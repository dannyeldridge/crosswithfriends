import {SERVER_URL} from './constants';

export async function fetchGameProgress(gids: string[]): Promise<Record<string, number>> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/game-progress`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({gids}),
    });
    if (!resp.ok) return {};
    return await resp.json();
  } catch {
    return {};
  }
}
