import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/logout',   requireAuth, ctrl.logout);
router.get('/me',        requireAuth, ctrl.me);
router.get('/verify',    ctrl.verify);   // used by other services

export default router;
