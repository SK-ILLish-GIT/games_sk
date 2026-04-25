import { Router } from 'express';
import * as ctrl from '../controllers/leaderboard.controller';

const router = Router();

router.post('/scores',                    ctrl.submitScore);
router.get('/leaderboard/global',         ctrl.getGlobalLeaderboard);
router.get('/leaderboard/:gameId',        ctrl.getLeaderboard);
router.get('/leaderboard/:gameId/me',     ctrl.getMyRank);

export default router;
