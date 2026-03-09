import {RoomEvent} from '@shared/roomEvents';
import _ from 'lodash';
import {pool} from './pool';

export async function getRoomEvents(rid: string) {
  const res = await pool.query('SELECT event_payload FROM room_events WHERE rid=$1 ORDER BY ts ASC', [rid]);
  const events = _.map(res.rows, 'event_payload');
  return events;
}

export async function addRoomEvent(rid: string, event: RoomEvent) {
  await pool.query(
    `
      INSERT INTO room_events (rid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
    [rid, event.uid, new Date(event.timestamp).toISOString(), event.type, event]
  );
}
