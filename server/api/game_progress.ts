import express from 'express';
import {computeGamesProgress} from '../model/game_progress';

const router = express.Router();

/**
 * @openapi
 * /game-progress:
 *   post:
 *     tags: [Games]
 *     summary: Get game progress
 *     description: Compute percent complete for a list of game IDs (max 20).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gids]
 *             properties:
 *               gids:
 *                 type: array
 *                 items: {type: string}
 *                 maxItems: 20
 *     responses:
 *       200:
 *         description: Map of game ID to percent complete (0-100)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: {type: number}
 */
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
