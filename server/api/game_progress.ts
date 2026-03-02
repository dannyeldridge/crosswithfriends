import express from 'express';
import {computeGamesProgress} from '../model/game_progress';

const router = express.Router();

// POST /api/game-progress — compute percent complete for a list of game IDs
router.post('/', async (req, res, next) => {
  try {
    const {gids} = req.body;
    if (!Array.isArray(gids) || gids.length === 0) {
      res.json({});
      return;
    }

    // Limit to 20 games to prevent abuse
    const limitedGids = gids.slice(0, 20);
    const progressMap = await computeGamesProgress(limitedGids);

    const result: Record<string, number> = {};
    progressMap.forEach((percent, gid) => {
      result[gid] = percent;
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
