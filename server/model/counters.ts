import _ from 'lodash';
import {pool} from './pool';

export async function incrementGid(): Promise<string> {
  const {rows} = await pool.query(
    `
      SELECT nextval('gid_counter')
    `
  );
  return _.first(rows)!.nextval as string;
}

export async function incrementPid(): Promise<string> {
  const {rows} = await pool.query(
    `
      SELECT nextval('pid_counter')
    `
  );
  return _.first(rows)!.nextval as string;
}
